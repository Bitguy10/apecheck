import type { WalletScan, Holding, WalletMetrics } from '@apecheck/core';
import { isValidSolanaAddress, normalizeAddress } from '@apecheck/core';
import {
  createSolanaRpc,
  getSolanaTrackerData,
  getSolanaTrackerPrice,
  type TrackerHolding,
} from '@apecheck/api-clients';
import { getUserId } from '@/lib/supabase-server';
import { env } from '@/lib/env';
import { ok, fail } from '@/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * POST /api/wallet-scan — scan a Solana wallet (or dev wallet).
 * Body: { walletAddress: string }
 *
 * Holdings + SOL balance + wallet age + created-token count come from on-chain
 * RPC (always available). PnL / win rate / trading volume come from Solana
 * Tracker; if that source has no key or is down, those fields are null and a
 * warning is surfaced — the scan still returns holdings. All keys stay server-side.
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

  const nowMs = Date.now();
  const warnings: string[] = [];

  try {
    const rpc = createSolanaRpc(env.solanaRpcUrl());
    const trackerKey = env.solanaTrackerApiKey();

    const [solBalance, rpcAccounts, walletAgeDays, createdTokenCount, tracker, solPriceUsd] = await Promise.all([
      rpc.getBalance(walletAddress),
      rpc.getAllTokenAccounts(walletAddress),
      rpc.getWalletAgeDays(walletAddress, nowMs),
      rpc.getCreatedTokenCount(walletAddress),
      getSolanaTrackerData(walletAddress, trackerKey),
      getSolanaTrackerPrice(SOL_MINT, trackerKey),
    ]);

    if (!tracker.available) {
      warnings.push(
        tracker.error?.includes('key')
          ? 'PnL, win rate, and trading volume are unavailable — no Solana Tracker API key is configured.'
          : 'PnL, win rate, and trading volume are temporarily unavailable (tracker source unreachable).',
      );
    }

    // Prefer tracker holdings (they carry live USD value); fall back to raw RPC
    // balances when the tracker is unavailable so the list is never empty.
    const holdings: Holding[] = tracker.available && tracker.holdings.length
      ? tracker.holdings.map(fromTrackerHolding)
      : (rpcAccounts || []).map((a) => ({
          mint: a.mint,
          name: null,
          symbol: null,
          imageUrl: null,
          amount: a.amount,
          priceUsd: null,
          valueUsd: null,
        }));

    if (!tracker.available && rpcAccounts) {
      warnings.push('Token USD values are unavailable without the tracker source; showing raw balances.');
    }

    const solValueUsd = solBalance != null && solPriceUsd != null ? solBalance * solPriceUsd : null;
    const holdingsValueUsd = tracker.available
      ? tracker.totalValueUsd
      : holdings.every((h) => h.valueUsd == null)
        ? null
        : holdings.reduce((sum, h) => sum + (h.valueUsd ?? 0), 0);
    const totalValueUsd =
      holdingsValueUsd == null && solValueUsd == null ? null : (holdingsValueUsd ?? 0) + (solValueUsd ?? 0);

    const allTime: WalletMetrics = {
      pnl: {
        totalUsd: tracker.pnl.totalUsd,
        realizedUsd: tracker.pnl.realizedUsd,
        unrealizedUsd: tracker.pnl.unrealizedUsd,
        investedUsd: tracker.pnl.investedUsd,
        roiPct: tracker.pnl.roiPct,
        winRatePct: tracker.pnl.winRatePct,
        wins: tracker.pnl.wins,
        losses: tracker.pnl.losses,
      },
      volumeUsd: tracker.pnl.volumeUsd,
      trades: tracker.pnl.trades,
    };

    // Solana Tracker's public tier returns all-time PnL only (no trailing
    // window), so we surface a single honest All-time card rather than
    // mislabeling all-time numbers as a 30/90-day window.

    const result: WalletScan = {
      walletAddress,
      solBalance,
      solPriceUsd,
      totalValueUsd,
      holdings,
      holdingsCount: holdings.length,
      allTime,
      walletAgeDays,
      createdTokenCount,
      metricsAvailable: tracker.available,
      warnings,
      cached: false,
      scannedAt: new Date(nowMs).toISOString(),
    };

    // Best-effort: record per-user wallet-scan history (RLS-scoped client).
    void recordWalletHistory(walletAddress, result);

    return ok(result);
  } catch (err) {
    console.error('[wallet-scan] unexpected error', err);
    return fail('INTERNAL', 'Wallet scan failed. Please try again.');
  }
}

function fromTrackerHolding(t: TrackerHolding): Holding {
  return {
    mint: t.mint,
    name: t.name,
    symbol: t.symbol,
    imageUrl: t.imageUrl,
    amount: t.amount,
    priceUsd: t.priceUsd,
    valueUsd: t.valueUsd,
  };
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
