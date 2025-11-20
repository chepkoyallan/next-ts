// OAuth2 Authentication Provider (Generic implementation for OAuth2 flow)
import axios from 'axios';
import jwt from 'jsonwebtoken';

import { AuthUser } from '../../types/api';
import { logger } from '../../utils/logger';
import { UserService } from '../../services/user-service-prisma';
import { TokenPair, AuthResult, AuthProvider, AuthCredentials } from './auth-provider-interface';

interface OAuth2Config {
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  revokeUrl?: string;
}

export class OAuth2Provider implements AuthProvider {
  name = 'oauth2';

  private config: OAuth2Config;

  constructor(
    private clientId: string,
    private clientSecret: string,
    private redirectUri: string,
    config?: Partial<OAuth2Config>
  ) {
    // Default to generic OAuth2 endpoints (can be overridden)
    this.config = {
      authorizationUrl: config?.authorizationUrl || process.env.OAUTH2_AUTHORIZATION_URL || '',
      tokenUrl: config?.tokenUrl || process.env.OAUTH2_TOKEN_URL || '',
      userInfoUrl: config?.userInfoUrl || process.env.OAUTH2_USER_INFO_URL || '',
      scope: config?.scope || 'openid profile email',
      revokeUrl: config?.revokeUrl || process.env.OAUTH2_REVOKE_URL,
    };
  }

  /**
   * Get authorization URL for OAuth2 flow
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.config.scope,
      state,
    });

    return `${this.config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    try {
      if (!credentials.token) {
        throw new Error('Authorization code is required');
      }

      // Exchange authorization code for access token
      const tokenResponse = await axios.post(
        this.config.tokenUrl,
        {
          grant_type: 'authorization_code',
          code: credentials.token,
          redirect_uri: this.redirectUri,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      // Get user info from OAuth provider
      const userInfoResponse = await axios.get(this.config.userInfoUrl, {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      const oauthUser = userInfoResponse.data;

      // Find or create user in our database
      let user = await UserService.findByEmail(oauthUser.email);

      if (!user) {
        // Create new user from OAuth profile
        user = await UserService.create({
          email: oauthUser.email,
          name: oauthUser.name || oauthUser.email.split('@')[0],
          password: Math.random().toString(36).slice(-16), // Random password (user can't login with it)
          role: 'user',
        });

        logger.info('User created from OAuth2', {
          userId: user.id,
          email: user.email,
          provider: credentials.provider || 'oauth2',
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
          provider: 'oauth2',
        },
        jwtSecret,
        {
          expiresIn: '24h',
          issuer: 'icodeai-api',
          audience: 'icodeai-users',
        }
      );

      logger.info('OAuth2 authentication successful', {
        userId: user.id,
        email: user.email,
        provider: credentials.provider || 'oauth2',
      });

      return {
        user: authUser,
        accessToken: jwtToken,
        refreshToken: refresh_token,
        expiresIn: expires_in || 3600,
      };
    } catch (error) {
      logger.error('OAuth2 authentication failed', error as Error, {
        provider: credentials.provider,
      });
      throw error;
    }
  }

  /**
   * Validate OAuth2 access token
   */
  async validateToken(token: string): Promise<AuthUser | null> {
    try {
      // Try to get user info with the token
      const userInfoResponse = await axios.get(this.config.userInfoUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const oauthUser = userInfoResponse.data;

      // Find user in our database
      const user = await UserService.findByEmail(oauthUser.email);

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
      logger.warn('OAuth2 token validation failed', { error: (error as Error).message });
      return null;
    }
  }

  /**
   * Refresh OAuth2 access token
   */
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const tokenResponse = await axios.post(
        this.config.tokenUrl,
        {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      logger.info('OAuth2 token refreshed successfully');

      return {
        accessToken: access_token,
        refreshToken: refresh_token || refreshToken, // Some providers don't return new refresh token
        expiresIn: expires_in || 3600,
      };
    } catch (error) {
      logger.error('OAuth2 token refresh failed', error as Error);
      throw new Error('Failed to refresh OAuth2 token');
    }
  }

  /**
   * Revoke OAuth2 token
   */
  async revokeToken(token: string): Promise<boolean> {
    try {
      if (!this.config.revokeUrl) {
        logger.warn('OAuth2 revoke URL not configured');
        return false;
      }

      await axios.post(
        this.config.revokeUrl,
        {
          token,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      logger.info('OAuth2 token revoked successfully');
      return true;
    } catch (error) {
      logger.warn('OAuth2 token revocation failed', { error: (error as Error).message });
      return false;
    }
  }
}
