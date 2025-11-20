// Authentication middleware
import { verify } from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

import { TokenBlacklist } from '@app/cache';

import { AuthUser, AuthContext } from '../types/api';
import { createErrorResponse } from '../utils/response';
import { isHeadlessMode, HEADLESS_MOCK_USER } from '../headless-mode';

/**
 * JWT Authentication middleware
 */
export async function authMiddleware(
  request: NextRequest,
  requiredPermissions?: string[]
): Promise<{ user: AuthUser; token: string; tokenPayload?: any } | NextResponse> {
  try {
    // In headless mode, bypass authentication and return mock superuser
    if (isHeadlessMode()) {
      return {
        user: HEADLESS_MOCK_USER as AuthUser,
        token: 'headless-mode-token',
        tokenPayload: HEADLESS_MOCK_USER,
      };
    }

    // Extract token from Authorization header OR cookie
    let token: string | undefined;

    // Try Authorization header first
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // If no Authorization header, try cookie
    if (!token) {
      const { cookies } = request;
      token = cookies.get('accessToken')?.value || cookies.get('auth-token')?.value;
    }

    if (!token) {
      return createErrorResponse('UNAUTHORIZED', {
        message: 'No authentication token provided',
      });
    }

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is not set');
    }

    const decoded = verify(token, jwtSecret) as any;

    // ✅ SECURITY: Check if token is blacklisted (revoked)
    if (decoded.jti && (await TokenBlacklist.isBlacklisted(decoded.jti))) {
      return createErrorResponse('UNAUTHORIZED', {
        message: 'Token has been revoked. Please log in again.',
      });
    }

    // Create user object from token payload
    const { roles: decodedRoles, role: decodedRole } = decoded;
    let roles: string[];
    if (Array.isArray(decodedRoles)) {
      roles = decodedRoles;
    } else if (decodedRole) {
      roles = [decodedRole];
    } else {
      roles = ['viewer'];
    }

    const user: AuthUser = {
      id: decoded.userId,
      email: decoded.email,
      roles,
      permissions: decoded.permissions || [],
    };

    // Check required permissions
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasPermission = requiredPermissions.every((permission) =>
        user.permissions.includes(permission)
      );

      if (!hasPermission) {
        return createErrorResponse('FORBIDDEN');
      }
    }

    return { user, token, tokenPayload: decoded };
  } catch (error) {
    console.error('Authentication error:', error);
    return createErrorResponse('INVALID_TOKEN');
  }
}

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export async function optionalAuthMiddleware(request: NextRequest): Promise<AuthContext> {
  try {
    const authResult = await authMiddleware(request);

    if (authResult instanceof NextResponse) {
      // Authentication failed, but that's okay for optional auth
      return { isAuthenticated: false };
    }

    return {
      user: authResult.user,
      token: authResult.token,
      tokenPayload: authResult.tokenPayload,
      isAuthenticated: true,
    };
  } catch {
    return { isAuthenticated: false };
  }
}

/**
 * Role-based access control
 */
export function requireRole(allowedRoles: string[]) {
  return async (
    request: NextRequest
  ): Promise<{ user: AuthUser; token: string; tokenPayload?: any } | NextResponse> => {
    const authResult = await authMiddleware(request);

    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const hasAllowedRole = authResult.user.roles.some((userRole) =>
      allowedRoles.includes(userRole)
    );

    if (!hasAllowedRole) {
      return createErrorResponse('FORBIDDEN');
    }

    return authResult;
  };
}

/**
 * API Key authentication middleware
 */
export async function apiKeyMiddleware(request: NextRequest): Promise<boolean | NextResponse> {
  try {
    const apiKey = request.headers.get('x-api-key');

    if (!apiKey) {
      return createErrorResponse('UNAUTHORIZED');
    }

    // Validate API key (implement your own logic)
    const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];

    if (!validApiKeys.includes(apiKey)) {
      return createErrorResponse('INVALID_TOKEN');
    }

    return true;
  } catch (error) {
    console.error('API Key authentication error:', error);
    return createErrorResponse('UNAUTHORIZED');
  }
}

/**
 * Create authentication context for request
 */
export async function createAuthContext(request: NextRequest): Promise<AuthContext> {
  return optionalAuthMiddleware(request);
}
