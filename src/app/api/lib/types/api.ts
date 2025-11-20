// Core API types and interfaces
import { NextRequest, NextResponse } from 'next/server';

// Standard API Response structure
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

// API Error types
export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: any;
}

// Request context
export interface RequestContext {
  requestId: string;
  timestamp: string;
  userAgent?: string;
  ip?: string;
  userId?: string;
  sessionId?: string;
}

// Database connection types
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  pool?: {
    min: number;
    max: number;
  };
}

// Pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// API Handler type
export type ApiHandler = (
  request: NextRequest,
  context?: { params?: Record<string, string> }
) => Promise<NextResponse>;

// Middleware types
export interface MiddlewareContext {
  request: NextRequest;
  response?: NextResponse;
  context: RequestContext;
}

export type Middleware = (
  context: MiddlewareContext,
  next: () => Promise<NextResponse>
) => Promise<NextResponse>;

// Auth types
export interface AuthUser {
  id: string;
  email: string;
  organizationId?: string;
  roles: string[]; // Changed from single role to multiple roles
  permissions: string[];
  metadata?: Record<string, any>;
}

export interface AuthContext {
  user?: AuthUser;
  token?: string;
  tokenPayload?: {
    jti?: string;
    exp?: number;
    iat?: number;
    type?: string;
    [key: string]: any;
  };
  isAuthenticated: boolean;
  rbacContext?: {
    effectivePermissions: string[];
    highestRole: string;
    canManageUsers: boolean;
  };
}
