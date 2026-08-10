/**
 * Shared HTTP helper for all API clients.
 * - Uses global fetch (Node 18+, Vercel serverless, React Native all provide it).
 * - Timeout + single retry with backoff.
 * - Never throws for expected upstream failures; returns a typed Result so the
 *   scan engine can degrade gracefully when a free-tier source is down/rate-limited.
 */

export interface FetchOk<T> {
  ok: true;
  data: T;
  status: number;
}
export interface FetchErr {
  ok: false;
  status: number;
  error: string;
  rateLimited: boolean;
}
export type FetchResult<T> = FetchOk<T> | FetchErr;

export interface FetchJsonOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Label used in error messages / logs. */
  source?: string;
}

const DEFAULT_TIMEOUT = 8000;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function fetchJson<T>(url: string, opts: FetchJsonOptions = {}): Promise<FetchResult<T>> {
  const { headers = {}, timeoutMs = DEFAULT_TIMEOUT, retries = 1, method = 'GET', body, source = 'upstream' } = opts;

  let lastErr = 'unknown error';
  let lastStatus = 0;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);
      lastStatus = res.status;

      if (res.status === 429) {
        // Rate limited — back off then retry once more.
        if (attempt < retries) {
          await sleep(500 * (attempt + 1));
          continue;
        }
        return { ok: false, status: 429, error: `${source} rate limited`, rateLimited: true };
      }

      if (!res.ok) {
        lastErr = `${source} responded ${res.status}`;
        // 5xx: retry; 4xx: don't.
        if (res.status >= 500 && attempt < retries) {
          await sleep(300 * (attempt + 1));
          continue;
        }
        return { ok: false, status: res.status, error: lastErr, rateLimited: false };
      }

      const data = (await res.json()) as T;
      return { ok: true, data, status: res.status };
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort = err instanceof Error && err.name === 'AbortError';
      lastErr = isAbort ? `${source} timed out` : `${source} network error`;
      if (attempt < retries) {
        await sleep(300 * (attempt + 1));
        continue;
      }
    }
  }

  return { ok: false, status: lastStatus, error: lastErr, rateLimited: false };
}

/** Convenience: unwrap a result to data-or-null. */
export function dataOrNull<T>(r: FetchResult<T>): T | null {
  return r.ok ? r.data : null;
}
