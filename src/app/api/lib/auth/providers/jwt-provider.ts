// JWT Authentication Provider
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { AuthUser } from '../../types/api';
import { logger } from '../../utils/logger';
import { UserService } from '../../services/user-service-prisma';
import { TokenPair, AuthResult, AuthProvider, AuthCredentials } from './auth-provider-interface';

export class JWTAuthProvider implements AuthProvider {
  name = 'jwt';

  private initialized = false;

  private jwtSecret: string;

  private jwtExpiresIn: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || '';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';

    if (!this.jwtSecret || this.jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }

    this.initialized = true;
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    this.ensureInitialized();

    if (!credentials.email || !credentials.password) {
      throw new Error('Email and password are required');
    }

    try {
      // Find user by email
      const user = await UserService.findByEmail(credentials.email);
      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash);
      if (!isValidPassword) {
        throw new Error('Invalid email or password');
      }

      // Generate tokens
      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        roles: Array.isArray(user.role) ? user.role : [user.role],
        permissions: user.permissions,
      };

      const accessToken = this.generateAccessToken(authUser);
      const refreshToken = this.generateRefreshToken(authUser);

      logger.info('User authenticated successfully', { userId: user.id, email: user.email });

      return {
        user: authUser,
        accessToken,
        refreshToken,
        expiresIn: this.getTokenExpirationTime(),
      };
    } catch (error) {
      logger.error('Authentication failed', error as Error, { email: credentials.email });
      throw error;
    }
  }

  async validateToken(token: string): Promise<AuthUser | null> {
    this.ensureInitialized();

    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;

      // Check if token is expired
      if (decoded.exp && Date.now() >= decoded.exp * 1000) {
        return null;
      }

      // Return user data from token
      const { roles: decodedRoles, role: decodedRole } = decoded;
      let roles: string[];
      if (Array.isArray(decodedRoles)) {
        roles = decodedRoles;
      } else if (decodedRole) {
        roles = [decodedRole];
      } else {
        roles = ['viewer'];
      }

      return {
        id: decoded.userId,
        email: decoded.email,
        roles,
        permissions: decoded.permissions || [],
      };
    } catch (error) {
      logger.warn('Token validation failed', { error: (error as Error).message });
      return null;
    }
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    this.ensureInitialized();

    try {
      const decoded = jwt.verify(refreshToken, this.jwtSecret) as any;

      // Verify this is a refresh token
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      // Get fresh user data
      const user = await UserService.findById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        roles: Array.isArray(user.role) ? user.role : [user.role],
        permissions: user.permissions,
      };

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(authUser);
      const newRefreshToken = this.generateRefreshToken(authUser);

      logger.info('Token refreshed successfully', { userId: user.id });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: this.getTokenExpirationTime(),
      };
    } catch (error) {
      logger.error('Token refresh failed', error as Error);
      throw new Error('Invalid refresh token');
    }
  }

  async revokeToken(token: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      // In a production app, you would add this token to a blacklist
      // For now, we'll just validate it exists
      const decoded = jwt.verify(token, this.jwtSecret);

      if (decoded) {
        logger.info('Token revoked', { token: `${token.substring(0, 20)}...` });
        return true;
      }

      return false;
    } catch (error) {
      logger.warn('Token revocation failed', { error: (error as Error).message });
      return false;
    }
  }

  private generateAccessToken(user: AuthUser): string {
    const payload = {
      userId: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      type: 'access',
    };

    const options = {
      expiresIn: this.jwtExpiresIn as string,
      issuer: 'icodeai-api',
      audience: 'icodeai-users',
    };

    return jwt.sign(payload, this.jwtSecret, options as jwt.SignOptions);
  }

  private generateRefreshToken(user: AuthUser): string {
    const payload = {
      userId: user.id,
      email: user.email,
      type: 'refresh',
    };

    const options = {
      expiresIn: '7d' as string, // Refresh tokens last longer
      issuer: 'icodeai-api',
      audience: 'icodeai-users',
    };

    return jwt.sign(payload, this.jwtSecret, options as jwt.SignOptions);
  }

  private getTokenExpirationTime(): number {
    // Convert JWT expiration to seconds
    if (this.jwtExpiresIn.endsWith('h')) {
      return parseInt(this.jwtExpiresIn.slice(0, -1), 10) * 3600;
    }
    if (this.jwtExpiresIn.endsWith('d')) {
      return parseInt(this.jwtExpiresIn.slice(0, -1), 10) * 86400;
    }
    if (this.jwtExpiresIn.endsWith('m')) {
      return parseInt(this.jwtExpiresIn.slice(0, -1), 10) * 60;
    }
    return 86400; // Default 24 hours
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('JWT provider not initialized');
    }
  }
}
