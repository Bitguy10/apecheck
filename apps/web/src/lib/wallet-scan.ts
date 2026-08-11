import type { WalletScan, Holding, WalletMetrics } from '@apecheck/core';
import {
  createSolanaRpc,
  getSolanaTrackerData,
  getSolanaTrackerPrice,
  type TrackerHolding,
} from '@apecheck/api-clients';
import { env } from './env';

const SOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * Core wallet-scan assembly, shared by the API route (POST /api/wallet-scan)
 * and the Telegram bot (/wallet + bare-address fallback). Server-only — reads
 * the RPC URL + Solana Tracker key from env; all keys stay server-side.
 *
 * Holdings + SOL balance + wallet age + created-token count come from on-chain
 * RPC (always available). PnL / win rate / volume come from Solana Tracker; if
 * that source has no key or is down, those fields are null and a warning is
 * surfaced — the scan still returns holdings so it's never empty.
 *
 * Callers are responsible for validating the address first (isValidSolanaAddress)
 * and for any per-user history recording (which needs the request-scoped client).
 */
export async function runWalletScan(walletAddress: string, nowMs: number): Promise<WalletScan> {
  const warnings: string[] = [];
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

  // Solana Tracker's public tier returns all-time PnL only (no trailing window),
  // so we surface a single honest All-time figure rather than mislabeling
  // all-time numbers as a 30/90-day window.

  return {
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
}

/**
 * True if the scanned account shows ANY on-chain footprint (SOL, tokens, age,
 * deployments, or tracker trade history). Used to distinguish a real wallet from
 * a valid-but-empty/nonexistent address when falling back from a failed token
 * scan — so we don't render an empty "wallet" card for a mistyped token address.
 */
export function walletHasActivity(scan: WalletScan): boolean {
  return (
    (scan.solBalance ?? 0) > 0 ||
    scan.holdings.length > 0 ||
    (scan.createdTokenCount ?? 0) > 0 ||
    scan.walletAgeDays != null ||
    (scan.metricsAvailable && (scan.allTime.pnl.totalUsd != null || (scan.allTime.trades ?? 0) > 0))
  );
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
