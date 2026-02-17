import { NextResponse } from 'next/server';

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}

export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true as const,
      data,
      meta: { timestamp: new Date().toISOString() },
    },
    { status }
  );
}

export function apiError(
  message: string,
  code: string,
  status = 500,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false as const,
      error: { message, code, ...(details !== undefined ? { details } : {}) },
    },
    { status }
  );
}

export function unauthorized(message = 'Unauthorized') {
  return apiError(message, 'UNAUTHORIZED', 401);
}

export function forbidden(message = 'Forbidden') {
  return apiError(message, 'FORBIDDEN', 403);
}

export function notFound(message = 'Not found') {
  return apiError(message, 'NOT_FOUND', 404);
}

export function badRequest(message: string, details?: unknown) {
  return apiError(message, 'BAD_REQUEST', 400, details);
}

export function serverError(message = 'Something went wrong. Please try again later.') {
  return apiError(message, 'INTERNAL_ERROR', 500);
}
