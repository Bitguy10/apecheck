import { NextResponse } from 'next/server';
import type { ApiError } from '@apecheck/core';

const CODE_STATUS: Record<ApiError['code'], number> = {
  INVALID_ADDRESS: 400,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  UPSTREAM_ERROR: 502,
  INTERNAL: 500,
  UNAUTHORIZED: 401,
  CONFLICT: 409,
};

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function fail(code: ApiError['code'], message?: string): NextResponse {
  const body: ApiError = { code, error: message || code };
  return NextResponse.json(body, { status: CODE_STATUS[code] });
}

export function requireAuth(userId: string | null): asserts userId is string {
  if (!userId) {
    throw new AuthError();
  }
}

export class AuthError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'AuthError';
  }
}
