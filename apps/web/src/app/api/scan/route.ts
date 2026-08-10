import { runScan, ScanError, isValidSolanaAddress } from '@apecheck/core';
import { getAdminSupabase, getUserId } from '@/lib/supabase-server';
import { createSupabaseScanCache } from '@/lib/scan-cache';
import { scanConfig } from '@/lib/env';
import { ok, fail } from '@/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/scan — main scan. Checks the global cache first, then runs the engine.
 * Body: { tokenAddress: string, forceRefresh?: boolean }
 */
export async function POST(req: Request) {
  let body: { tokenAddress?: string; forceRefresh?: boolean };
  try {
    body = await req.json();
  } catch {
    return fail('INVALID_ADDRESS', 'Request body must be JSON.');
  }

  const tokenAddress = (body.tokenAddress || '').trim();
  if (!isValidSolanaAddress(tokenAddress)) {
    return fail('INVALID_ADDRESS', 'Enter a valid Solana contract address.');
  }

  const nowMs = Date.now();

  try {
    const admin = getAdminSupabase();
    const cache = createSupabaseScanCache(admin, nowMs);

    const result = await runScan(tokenAddress, {
      config: scanConfig(),
      cache,
      forceRefresh: !!body.forceRefresh,
      nowMs,
    });

    // Best-effort: record per-user scan history (RLS-scoped client).
    void recordHistory(tokenAddress);

    return ok(result);
  } catch (err) {
    if (err instanceof ScanError) {
      switch (err.code) {
        case 'INVALID_ADDRESS':
          return fail('INVALID_ADDRESS', err.message);
        case 'NOT_FOUND':
          return fail('NOT_FOUND', err.message);
        case 'RATE_LIMITED':
          return fail('RATE_LIMITED', err.message);
        default:
          return fail('UPSTREAM_ERROR', err.message);
      }
    }
    console.error('[scan] unexpected error', err);
    return fail('INTERNAL', 'Scan failed. Please try again.');
  }
}

async function recordHistory(tokenAddress: string): Promise<void> {
  try {
    const userId = await getUserId();
    if (!userId) return;
    const { getServerSupabase } = await import('@/lib/supabase-server');
    const supabase = getServerSupabase();
    await supabase.from('scan_history').insert({ user_id: userId, token_address: tokenAddress });
  } catch {
    /* non-fatal */
  }
}
