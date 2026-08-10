import type { ScanResult } from './types';
import { shortenAddress } from './formatters';

// ─────────────────────────────────────────────────────────────
// Alert types — the dev-dump watcher plus four extended signals.
// Detection here is PURE (no I/O): compare a watch-time baseline
// snapshot against a fresh ScanResult. The web route + cron own the
// DB / scan / push wiring; this module owns the "did it trip?" logic.
// ─────────────────────────────────────────────────────────────

export type AlertType =
  | 'dev_dump'
  | 'lp_pull'
  | 'authority_reenabled'
  | 'price_drop'
  | 'big_holder_sell';

/** Trigger thresholds. Tuned to catch rugs without alert fatigue. */
export const ALERT_THRESHOLDS = {
  /** LP pull: % of baseline liquidity that must disappear. */
  lpPullDropPct: 40,
  /** Ignore LP-pull on dust pools (baseline liquidity below this $). */
  lpPullMinLiquidityUsd: 3_000,
  /** Price drop: % below baseline price. */
  priceDropPct: 50,
  /** Big holder sell: supply-% a single top holder must shed. */
  bigHolderSellDropPct: 3,
  /** Only track baseline holders that started with at least this supply-%. */
  bigHolderMinPct: 2,
} as const;

/**
 * Watch-time reference snapshot, stored on the watchlist row (jsonb).
 * Detection compares the live scan against THIS fixed reference, so a
 * slow bleed still trips once it crosses a threshold.
 */
export interface WatchBaseline {
  liquidityUsd: number;
  mintActive: boolean;
  freezeActive: boolean;
  priceUsd: number | null;
  devPercent: number;
  /** Top non-LP holders at watch time (address + supply-%). */
  topHolders: { address: string; pct: number }[];
  capturedAt: string;
}

export interface DetectedAlert {
  type: AlertType;
  title: string;
  body: string;
  detail: Record<string, unknown>;
  /**
   * Monotonic value used to suppress duplicate alerts of the same type.
   * For 'once' types it is 1; otherwise lower = worse (liquidity, price, pct),
   * and a new alert only fires when it drops below the previously alerted value.
   */
  dedupeValue: number;
  dedupeMode: 'lower-is-worse' | 'once';
}

/** Capture a baseline snapshot from a completed scan (top 10 non-LP holders). */
export function snapshotBaseline(scan: ScanResult, nowMs: number): WatchBaseline {
  const topHolders = (scan.topHolders || [])
    .filter((h) => !h.isLiquidityPool)
    .slice(0, 10)
    .map((h) => ({ address: h.address, pct: h.pct }));
  return {
    liquidityUsd: scan.liquidity.usd,
    mintActive: scan.authorities.mintActive,
    freezeActive: scan.authorities.freezeActive,
    priceUsd: scan.market.priceUsd,
    devPercent: scan.devWallet.percentHeld,
    topHolders,
    capturedAt: new Date(nowMs).toISOString(),
  };
}

/**
 * Compare a fresh scan against the baseline and return every alert that trips.
 * Pure + deterministic. The caller applies per-type dedupe using dedupeValue.
 */
export function detectAlerts(baseline: WatchBaseline, scan: ScanResult): DetectedAlert[] {
  const out: DetectedAlert[] = [];
  const sym = scan.meta.symbol ? `$${scan.meta.symbol}` : shortenAddress(scan.tokenAddress);

  // 1) LP pull — liquidity collapsed vs a non-dust baseline.
  if (baseline.liquidityUsd >= ALERT_THRESHOLDS.lpPullMinLiquidityUsd) {
    const now = scan.liquidity.usd;
    const dropPct = ((baseline.liquidityUsd - now) / baseline.liquidityUsd) * 100;
    if (dropPct >= ALERT_THRESHOLDS.lpPullDropPct) {
      out.push({
        type: 'lp_pull',
        title: '🚨 Liquidity pulled',
        body: `${sym} liquidity fell ${Math.round(dropPct)}% (from $${fmtCompact(baseline.liquidityUsd)} to $${fmtCompact(now)}). Possible rug in progress.`,
        detail: { baselineLiquidityUsd: baseline.liquidityUsd, currentLiquidityUsd: now, dropPct },
        dedupeValue: Math.round(now),
        dedupeMode: 'lower-is-worse',
      });
    }
  }

  // 2) Authority re-enabled — mint or freeze flipped back on (off → on).
  const reenabled: string[] = [];
  if (!baseline.mintActive && scan.authorities.mintActive) reenabled.push('mint');
  if (!baseline.freezeActive && scan.authorities.freezeActive) reenabled.push('freeze');
  if (reenabled.length > 0) {
    const canMint = reenabled.includes('mint');
    const canFreeze = reenabled.includes('freeze');
    const consequence = [canMint ? 'mint new supply' : '', canFreeze ? 'freeze your wallet' : '']
      .filter(Boolean)
      .join(' and ');
    out.push({
      type: 'authority_reenabled',
      title: '🚨 Authority re-enabled',
      body: `${sym} ${reenabled.join(' + ')} authority was turned back ON. The team can now ${consequence}.`,
      detail: { reenabled },
      dedupeValue: 1,
      dedupeMode: 'once',
    });
  }

  // 3) Price drop — price fell hard vs the baseline price.
  if (baseline.priceUsd && baseline.priceUsd > 0 && scan.market.priceUsd != null) {
    const now = scan.market.priceUsd;
    const dropPct = ((baseline.priceUsd - now) / baseline.priceUsd) * 100;
    if (dropPct >= ALERT_THRESHOLDS.priceDropPct) {
      out.push({
        type: 'price_drop',
        title: '📉 Big price drop',
        body: `${sym} is down ${Math.round(dropPct)}% since you started watching.`,
        detail: { baselinePriceUsd: baseline.priceUsd, currentPriceUsd: now, dropPct },
        // Scale to an int so tiny sub-cent prices still dedupe monotonically.
        dedupeValue: Math.round(now * 1e9),
        dedupeMode: 'lower-is-worse',
      });
    }
  }

  // 4) Big holder sell — a tracked top holder shed a chunk of supply.
  const liveByAddr = new Map(scan.topHolders.map((h) => [h.address, h.pct]));
  let worst: { address: string; before: number; after: number; drop: number } | null = null;
  for (const h of baseline.topHolders) {
    if (h.pct < ALERT_THRESHOLDS.bigHolderMinPct) continue;
    const after = liveByAddr.get(h.address) ?? 0; // absent ⇒ fully exited
    const drop = h.pct - after;
    if (drop >= ALERT_THRESHOLDS.bigHolderSellDropPct && (!worst || drop > worst.drop)) {
      worst = { address: h.address, before: h.pct, after, drop };
    }
  }
  if (worst) {
    out.push({
      type: 'big_holder_sell',
      title: '🐋 Whale sell-off',
      body: `A top holder of ${sym} dropped from ${worst.before.toFixed(1)}% to ${worst.after.toFixed(1)}% of supply (${shortenAddress(worst.address)}).`,
      detail: { address: worst.address, beforePct: worst.before, afterPct: worst.after, dropPct: worst.drop },
      // One holder can only sell so much; dedupe on their remaining %.
      dedupeValue: Math.round(worst.after * 100),
      dedupeMode: 'lower-is-worse',
    });
  }

  return out;
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}
