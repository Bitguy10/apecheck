import type { WalletScan } from '@apecheck/core';
import { isValidSolanaAddress, normalizeAddress } from '@apecheck/core';
import { getUserId } from '@/lib/supabase-server';
import { runWalletScan } from '@/lib/wallet-scan';
import { ok, fail } from '@/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/wallet-scan — scan a Solana wallet (or dev wallet).
 * Body: { walletAddress: string }
 *
 * The scan assembly lives in @/lib/wallet-scan (runWalletScan) and is shared
 * with the Telegram bot. This route validates the address, runs the scan, and
 * records per-user history. All third-party keys stay server-side.
 */
export async function POST(req: Request) {
  let body: { walletAddress?: string };
  try {
    body = await req.json();
  } catch {
    return fail('BAD_REQUEST', 'Request body must be JSON.');
  }

  const walletAddress = normalizeAddress(body.walletAddress || '');
  if (!isValidSolanaAddress(walletAddress)) {
    return fail('INVALID_ADDRESS', 'Enter a valid Solana wallet address.');
  }

  try {
    const result = await runWalletScan(walletAddress, Date.now());

    // Best-effort: record per-user wallet-scan history (RLS-scoped client).
    void recordWalletHistory(walletAddress, result);

    return ok(result);
  } catch (err) {
    console.error('[wallet-scan] unexpected error', err);
    return fail('INTERNAL', 'Wallet scan failed. Please try again.');
  }
}

async function recordWalletHistory(walletAddress: string, scan: WalletScan): Promise<void> {
  try {
    const userId = await getUserId();
    if (!userId) return;
    const { getServerSupabase } = await import('@/lib/supabase-server');
    const supabase = getServerSupabase();
    await supabase.from('wallet_scan_history').insert({
      user_id: userId,
      wallet_address: walletAddress,
      summary: {
        totalValueUsd: scan.totalValueUsd,
        allTimePnlUsd: scan.allTime.pnl.totalUsd,
        volumeUsd: scan.allTime.volumeUsd,
        winRatePct: scan.allTime.pnl.winRatePct,
        holdingsCount: scan.holdingsCount,
      },
    });
  } catch {
    /* non-fatal */
  }
}
