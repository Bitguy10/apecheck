import type { ScanResult } from '@apecheck/core';
import { config } from './config';

export class ApiClientError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/**
 * Run a scan via the web API (server-side keys stay on the server).
 * This endpoint is public — no auth required to scan.
 */
export async function scanToken(tokenAddress: string, forceRefresh = false): Promise<ScanResult> {
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenAddress, forceRefresh }),
    });
  } catch {
    throw new ApiClientError('UPSTREAM_ERROR', 'Network error. Check your connection.', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiClientError(data.code || 'INTERNAL', data.error || `Scan failed (${res.status})`, res.status);
  }
  return data as ScanResult;
}
