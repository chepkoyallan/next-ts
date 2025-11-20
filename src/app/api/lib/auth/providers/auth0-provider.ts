// Auth0 Authentication Provider
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';

import { AuthUser } from '../../types/api';
import { logger } from '../../utils/logger';
import { UserService } from '../../services/user-service-prisma';
import { TokenPair, AuthResult, AuthProvider, AuthCredentials } from './auth-provider-interface';

export class Auth0Provider implements AuthProvider {
  name = 'auth0';

  private jwksClient: JwksClient;

  private clientSecret?: string;

  private redirectUri?: string;

  private audience?: string;

  constructor(
    private domain: string,
    private clientId: string,
    options?: {
      clientSecret?: string;
      redirectUri?: string;
      audience?: string;
    }
  ) {
    this.clientSecret = options?.clientSecret || process.env.AUTH0_CLIENT_SECRET;
    this.redirectUri = options?.redirectUri || process.env.AUTH0_REDIRECT_URI;
    this.audience = options?.audience || process.env.AUTH0_AUDIENCE;

    // Initialize JWKS client for token verification
    this.jwksClient = new JwksClient({
      jwksUri: `https://${this.domain}/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 600000, // 10 minutes
    });
  }

  /**
   * Get Auth0 authorization URL
   */
  getAuthorizationUrl(state: string, responseType = 'code'): string {
    const params = new URLSearchParams({
      response_type: responseType,
      client_id: this.clientId,
      redirect_uri: this.redirectUri || '',
      scope: 'openid profile email',
      state,
      ...(this.audience && { audience: this.audience }),
    });

    return `https://${this.domain}/authorize?${params.toString()}`;
  }

  /**
   * Authenticate user with Auth0 authorization code
   */
  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    try {
      if (!credentials.token) {
        throw new Error('Authorization code is required');
      }

      if (!this.clientSecret || !this.redirectUri) {
        throw new Error('Auth0 client secret and redirect URI are required');
      }

      // Exchange authorization code for tokens
      const tokenResponse = await axios.post(`https://${this.domain}/oauth/token`, {
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: credentials.token,
        redirect_uri: this.redirectUri,
      });

      const { refresh_token, id_token, expires_in } = tokenResponse.data;

      // Decode and verify ID token
      const decoded = jwt.decode(id_token, { complete: true }) as any;

      if (!decoded || !decoded.payload) {
        throw new Error('Invalid ID token');
      }

      const auth0User = decoded.payload;

      // Find or create user in our database
      let user = await UserService.findByEmail(auth0User.email);

      if (!user) {
        // Create new user from Auth0 profile
        user = await UserService.create({
          email: auth0User.email,
          name: auth0User.name || auth0User.email.split('@')[0],
          password: Math.random().toString(36).slice(-16), // Random password
          role: 'user',
        });

        logger.info('User created from Auth0', {
          userId: user.id,
          email: user.email,
          auth0Id: auth0User.sub,
        });
      }

      // Generate our JWT tokens
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET environment variable is not set');
      }

      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        roles: Array.isArray(user.role) ? user.role : [user.role],
        permissions: user.permissions,
      };

      const jwtToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          roles: authUser.roles,
          permissions: user.permissions,
          provider: 'auth0',
          auth0Id: auth0User.sub,
        },
        jwtSecret,
        {
          expiresIn: '24h',
          issuer: 'icodeai-api',
          audience: 'icodeai-users',
        }
      );

      logger.info('Auth0 authentication successful', {
        userId: user.id,
        email: user.email,
        auth0Id: auth0User.sub,
      });

      return {
        user: authUser,
        accessToken: jwtToken,
        refreshToken: refresh_token,
        expiresIn: expires_in || 86400,
      };
    } catch (error) {
      logger.error('Auth0 authentication failed', error as Error);
      throw error;
    }
  }

  /**
   * Validate Auth0 access token
   */
  async validateToken(token: string): Promise<AuthUser | null> {
    try {
      // Decode token header to get key id
      const decoded = jwt.decode(token, { complete: true }) as any;

      if (!decoded || !decoded.header || !decoded.header.kid) {
        return null;
      }

      // Get signing key from Auth0 JWKS
      const key = await this.jwksClient.getSigningKey(decoded.header.kid);
      const signingKey = key.getPublicKey();

      // Verify token
      const verified = jwt.verify(token, signingKey, {
        audience: this.audience,
        issuer: `https://${this.domain}/`,
        algorithms: ['RS256'],
      }) as any;

      // Find user in our database
      const user = await UserService.findByEmail(verified.email || verified.sub);

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        roles: Array.isArray(user.role) ? user.role : [user.role],
        permissions: user.permissions,
      };
    } catch (error) {
      logger.warn('Auth0 token validation failed', { error: (error as Error).message });
      return null;
    }
  }

  /**
   * Refresh Auth0 access token
   */
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      if (!this.clientSecret) {
        throw new Error('Auth0 client secret is required');
      }

      const tokenResponse = await axios.post(`https://${this.domain}/oauth/token`, {
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
      });

      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      logger.info('Auth0 token refreshed successfully');

      return {
        accessToken: access_token,
        refreshToken: refresh_token || refreshToken,
        expiresIn: expires_in || 86400,
      };
    } catch (error) {
      logger.error('Auth0 token refresh failed', error as Error);
      throw new Error('Failed to refresh Auth0 token');
    }
  }

  /**
   * Revoke Auth0 token
   */
  async revokeToken(token: string): Promise<boolean> {
    try {
      if (!this.clientSecret) {
        logger.warn('Auth0 client secret not configured for token revocation');
        return false;
      }

      await axios.post(`https://${this.domain}/oauth/revoke`, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        token,
      });

      logger.info('Auth0 token revoked successfully');
      return true;
    } catch (error) {
      logger.warn('Auth0 token revocation failed', { error: (error as Error).message });
      return false;
    }
  }
}
