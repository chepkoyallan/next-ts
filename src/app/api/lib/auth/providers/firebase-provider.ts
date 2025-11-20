// Firebase Authentication Provider
import jwt from 'jsonwebtoken';
import * as admin from 'firebase-admin';

import { AuthUser } from '../../types/api';
import { logger } from '../../utils/logger';
import { UserService } from '../../services/user-service-prisma';
import { TokenPair, AuthResult, AuthProvider, AuthCredentials } from './auth-provider-interface';

export class FirebaseAuthProvider implements AuthProvider {
  name = 'firebase';

  private initialized = false;

  private app: admin.app.App | null = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize Firebase Admin SDK
   */
  private initialize(): void {
    try {
      if (this.initialized) {
        return;
      }

      const projectId = process.env.FIREBASE_PROJECT_ID;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

      if (!projectId || !privateKey || !clientEmail) {
        logger.warn('Firebase credentials not configured');
        return;
      }

      // Check if Firebase is already initialized
      if (admin.apps.length > 0) {
        this.app = admin.apps[0] as admin.app.App;
      } else {
        // Initialize Firebase Admin
        this.app = admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            privateKey: privateKey.replace(/\\n/g, '\n'), // Handle escaped newlines
            clientEmail,
          }),
        });
      }

      this.initialized = true;
      logger.info('Firebase Admin SDK initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Firebase Admin SDK', error as Error);
      throw error;
    }
  }

  /**
   * Authenticate user with Firebase ID token
   */
  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    this.ensureInitialized();

    try {
      if (!credentials.token) {
        throw new Error('Firebase ID token is required');
      }

      // Verify Firebase ID token
      const decodedToken = await admin.auth().verifyIdToken(credentials.token);

      const { uid, email, name } = decodedToken;

      if (!email) {
        throw new Error('Email not provided by Firebase authentication');
      }

      // Find or create user in our database
      let user = await UserService.findByEmail(email);

      if (!user) {
        // Create new user from Firebase profile
        user = await UserService.create({
          email,
          name: name || email.split('@')[0],
          password: Math.random().toString(36).slice(-16), // Random password
          role: 'user',
        });

        logger.info('User created from Firebase', {
          userId: user.id,
          email,
          firebaseUid: uid,
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
          provider: 'firebase',
          firebaseUid: uid,
        },
        jwtSecret,
        {
          expiresIn: '24h',
          issuer: 'icodeai-api',
          audience: 'icodeai-users',
        }
      );

      logger.info('Firebase authentication successful', {
        userId: user.id,
        email,
        firebaseUid: uid,
      });

      return {
        user: authUser,
        accessToken: jwtToken,
        refreshToken: credentials.token, // Firebase token can be used as refresh token
        expiresIn: 3600, // Firebase tokens typically expire in 1 hour
      };
    } catch (error) {
      logger.error('Firebase authentication failed', error as Error);
      throw error;
    }
  }

  /**
   * Validate Firebase ID token
   */
  async validateToken(token: string): Promise<AuthUser | null> {
    this.ensureInitialized();

    try {
      // Verify Firebase ID token
      const decodedToken = await admin.auth().verifyIdToken(token);

      const { email } = decodedToken;

      if (!email) {
        return null;
      }

      // Find user in our database
      const user = await UserService.findByEmail(email);

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
      logger.warn('Firebase token validation failed', { error: (error as Error).message });
      return null;
    }
  }

  /**
   * Refresh Firebase token
   * Note: Firebase handles token refresh on the client side
   * This method is provided for interface compliance
   */
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    this.ensureInitialized();

    try {
      // Verify the token is still valid
      const decodedToken = await admin.auth().verifyIdToken(refreshToken);

      if (!decodedToken) {
        throw new Error('Invalid refresh token');
      }

      logger.info('Firebase token refresh requested', {
        uid: decodedToken.uid,
      });

      // Firebase tokens are refreshed client-side
      // Return the same token (client should handle refresh)
      return {
        accessToken: refreshToken,
        refreshToken,
        expiresIn: 3600,
      };
    } catch (error) {
      logger.error('Firebase token refresh failed', error as Error);
      throw new Error('Failed to refresh Firebase token. Please re-authenticate.');
    }
  }

  /**
   * Revoke Firebase user tokens
   */
  async revokeToken(token: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      // Verify token to get user ID
      const decodedToken = await admin.auth().verifyIdToken(token);

      // Revoke all refresh tokens for the user
      await admin.auth().revokeRefreshTokens(decodedToken.uid);

      logger.info('Firebase tokens revoked successfully', {
        uid: decodedToken.uid,
      });

      return true;
    } catch (error) {
      logger.warn('Firebase token revocation failed', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Ensure Firebase is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Firebase Admin SDK not initialized. Check your configuration.');
    }
  }

  /**
   * Get Firebase Auth instance
   */
  getAuth(): admin.auth.Auth {
    this.ensureInitialized();
    return admin.auth(this.app || undefined);
  }
}
