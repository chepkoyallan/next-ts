// Standardized API response utilities
import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';

import { API_ERRORS, ApiErrorCode } from '../constants/errors';
import { ApiError, ApiResponse, PaginatedResponse } from '../types/api';

const API_VERSION = '1.0.0';

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  statusCode: number = 200,
  requestId?: string
): NextResponse<ApiResponse<T>> {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: requestId || nanoid(),
      version: API_VERSION,
    },
  };

  return NextResponse.json(response, { status: statusCode });
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  errorCode: ApiErrorCode,
  details?: any,
  requestId?: string
): NextResponse<ApiResponse> {
  const errorDef = API_ERRORS[errorCode];

  const response: ApiResponse = {
    success: false,
    error: {
      code: errorDef.code,
      message: errorDef.message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: requestId || nanoid(),
      version: API_VERSION,
    },
  };

  return NextResponse.json(response, { status: errorDef.statusCode });
}

/**
 * Create a custom error response
 */
export function createCustomErrorResponse(
  error: ApiError,
  requestId?: string
): NextResponse<ApiResponse> {
  const response: ApiResponse = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: requestId || nanoid(),
      version: API_VERSION,
    },
  };

  return NextResponse.json(response, { status: error.statusCode });
}

/**
 * Create a paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  requestId?: string
): NextResponse<ApiResponse<PaginatedResponse<T>>> {
  const totalPages = Math.ceil(total / limit);

  const paginatedData: PaginatedResponse<T> = {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };

  return createSuccessResponse(paginatedData, 200, requestId);
}

/**
 * Handle and format API errors
 */
export function handleApiError(error: unknown, requestId?: string): NextResponse<ApiResponse> {
  console.error('API Error:', error);

  // Handle known API errors
  if (isApiError(error)) {
    return createCustomErrorResponse(error, requestId);
  }

  // Handle validation errors (e.g., from Zod)
  if (error instanceof Error && error.name === 'ZodError') {
    return createErrorResponse('VALIDATION_ERROR', error.message, requestId);
  }

  // Handle generic errors
  if (error instanceof Error) {
    return createCustomErrorResponse(
      {
        code: 'INTERNAL_SERVER_ERROR',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        statusCode: 500,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      requestId
    );
  }

  // Fallback for unknown errors
  return createErrorResponse('INTERNAL_SERVER_ERROR', undefined, requestId);
}

/**
 * Type guard to check if error is an ApiError
 */
function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'statusCode' in error
  );
}

/**
 * Create a method not allowed response
 */
export function createMethodNotAllowedResponse(
  allowedMethods: string[],
  requestId?: string
): NextResponse<ApiResponse> {
  const response = createErrorResponse(
    'METHOD_NOT_ALLOWED',
    {
      allowedMethods,
    },
    requestId
  );

  response.headers.set('Allow', allowedMethods.join(', '));
  return response;
}
