// Request validation utilities using Zod
import { z } from 'zod';
import { NextRequest } from 'next/server';

import { PaginationParams } from '../types/api';

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // ID validation
  id: z.string().min(1, 'ID is required'),
  uuid: z.string().uuid('Invalid UUID format'),

  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  }),

  // Common fields
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(1000, 'Description too long').optional(),

  // Dates
  dateString: z.string().datetime('Invalid date format'),
  dateRange: z
    .object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
    })
    .refine(
      (data) => new Date(data.startDate) <= new Date(data.endDate),
      'Start date must be before end date'
    ),
};

/**
 * Parse and validate request body
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Request validation failed', error.issues);
    }
    throw new ValidationError('Invalid JSON in request body');
  }
}

/**
 * Parse and validate query parameters
 */
export function validateQueryParams<T>(request: NextRequest, schema: z.ZodSchema<T>): T {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Query parameter validation failed', error.issues);
    }
    throw new ValidationError('Invalid query parameters');
  }
}

/**
 * Parse and validate route parameters
 */
export function validateRouteParams<T>(params: Record<string, string>, schema: z.ZodSchema<T>): T {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Route parameter validation failed', error.issues);
    }
    throw new ValidationError('Invalid route parameters');
  }
}

/**
 * Extract and validate pagination parameters
 */
export function extractPaginationParams(request: NextRequest): PaginationParams {
  return validateQueryParams(request, commonSchemas.pagination);
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  public readonly code = 'VALIDATION_ERROR';

  public readonly statusCode = 400;

  public readonly details: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

/**
 * Sanitize input to prevent XSS and injection attacks
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .trim();
}

/**
 * Validate file upload
 */
export const fileUploadSchema = z.object({
  name: z.string().min(1, 'File name is required'),
  size: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
  type: z
    .string()
    .refine(
      (type) => ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'].includes(type),
      'Unsupported file type'
    ),
});

/**
 * Create a schema for array validation with pagination
 */
export function createArraySchema<T>(itemSchema: z.ZodSchema<T>) {
  return z.object({
    items: z.array(itemSchema),
    pagination: commonSchemas.pagination.optional(),
  });
}

/**
 * Validate environment variables
 */
export function validateEnvVar(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}
