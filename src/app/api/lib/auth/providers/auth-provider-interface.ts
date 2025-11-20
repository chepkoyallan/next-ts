// Auth provider interface for extensibility
import { AuthUser } from '../../types/api';

export interface AuthProvider {
  name: string;
  authenticate(credentials: AuthCredentials): Promise<AuthResult>;
  validateToken(token: string): Promise<AuthUser | null>;
  refreshToken(refreshToken: string): Promise<TokenPair>;
  revokeToken(token: string): Promise<boolean>;
}

export interface AuthCredentials {
  email?: string;
  password?: string;
  token?: string; // For OAuth
  provider?: string; // google, github, etc.
}

export interface AuthResult {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
