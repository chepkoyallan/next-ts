/**
 * Server-side JWT utilities
 * For use in API routes only (not client-side)
 */

import jwt from 'jsonwebtoken';

// ----------------------------------------------------------------------

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-in-production';

export interface JwtPayload {
  userId: string;
  email: string;
  exp: number;
  iat: number;
}

/**
 * Verify and decode a JWT token (server-side)
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Sign a JWT token (server-side)
 */
export function signToken(payload: Omit<JwtPayload, 'exp' | 'iat'>, expiresIn = '24h'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as any);
}

/**
 * Decode token without verification (use with caution)
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch {
    return null;
  }
}
