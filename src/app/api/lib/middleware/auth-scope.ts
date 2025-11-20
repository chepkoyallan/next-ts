/**
 * Auth Scope Helpers
 * Extract user context from authenticated requests
 */

import { verify } from 'jsonwebtoken';
import { NextRequest } from 'next/server';

/**
 * Get authenticated user context from request
 * Throws error if not authenticated
 */
export async function getUserContext(
  request: NextRequest
): Promise<{ userId: string; email: string }> {
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
    throw new Error('Authentication required');
  }

  // Verify JWT token
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  try {
    const decoded = verify(token, jwtSecret) as any;

    return {
      userId: decoded.userId || decoded.id,
      email: decoded.email,
    };
  } catch {
    throw new Error('Invalid or expired token');
  }
}
