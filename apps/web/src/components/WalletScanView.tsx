'use client';

import { useState } from 'react';
import type { WalletScan, Holding, WalletMetrics } from '@apecheck/core';
import { shortenAddress, formatUsd, formatNumber, formatSignedPercent, timeAgo } from '@apecheck/core';
import { api, ApiClientError } from '@/lib/api';
import { CopyButton } from './CopyButton';

const SCAN_STEPS = [
  'connecting to solana rpc…',
  'reading native SOL balance…',
  'enumerating SPL token accounts…',
  'pricing holdings…',
  'pulling realized + unrealized PnL…',
  'computing win rate & volume…',
  'checking wallet age & deployments…',
];

export function useWalletScan(
  /** Called after a successful scan so the page can refresh its history list. */
  onScanned?: (scan: WalletScan) => void,
) {
  const [scan, setScan] = useState<WalletScan | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(address: string) {
    setLoading(true);
    setError(null);
    setScan(null);
    try {
      const result = await api.scanWallet(address);
      setScan(result);
      onScanned?.(result);
    } catch (e) {
      setError(
        e instanceof ApiClientError
          ? { code: e.code, message: e.message }
          : { code: 'INTERNAL', message: 'Something went wrong.' },
      );
    } finally {
      setLoading(false);
    }
  }

  return { scan, error, loading, run };
}

// ─────────────────────────────────────────────────────────────
// Presentational pieces (used by the tracker page)
// ─────────────────────────────────────────────────────────────

export function WalletScanning({ address }: { address: string }) {
  return (
    <div className="py-6">
      <div className="mb-4 flex items-center gap-2 font-mono text-xs text-text-muted">
        <span className="h-2 w-2 animate-pulse-glow rounded-full bg-solana-purple" />
        scanning wallet {shortenAddress(address, 6, 6)}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-panel/60 p-4 font-mono text-sm">
        {SCAN_STEPS.map((s, i) => (
          <div key={i} className="log-print flex items-center gap-2 py-0.5">
            <span className="text-solana-purple">›</span>
            <span className="text-text-secondary">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WalletResult({ scan }: { scan: WalletScan }) {
  return (
    <div className="space-y-4 py-2">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-panel-2 text-xl">
          👛
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CopyButton value={scan.walletAddress} display={shortenAddress(scan.walletAddress, 6, 6)} />
            <span className="font-mono text-[10px] text-text-muted">{timeAgo(scan.scannedAt, Date.now())}</span>
          </div>
          <div className="mt-0.5 font-display text-2xl font-bold text-text-primary">
            {scan.totalValueUsd != null ? formatUsd(scan.totalValueUsd) : '—'}
            <span className="ml-1.5 font-mono text-xs font-normal text-text-muted">portfolio value</span>
          </div>
        </div>
      </div>

      {/* Warnings (data availability) */}
      {scan.warnings.length > 0 && (
        <div className="rounded-lg border border-warning-amber/30 bg-warning-amber/5 px-4 py-3">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-warning-amber">data notes</div>
          <ul className="space-y-0.5">
            {scan.warnings.map((w, i) => (
              <li key={i} className="text-xs text-warning-amber/90">• {w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="SOL balance" value={scan.solBalance != null ? `${formatNumber(scan.solBalance)} SOL` : '—'} sub={scan.solBalance != null && scan.solPriceUsd != null ? formatUsd(scan.solBalance * scan.solPriceUsd) : undefined} />
        <Stat label="tokens held" value={String(scan.holdingsCount)} />
        <Stat label="wallet age" value={scan.walletAgeDays != null ? `${scan.walletAgeDays}d` : 'unknown'} />
        <Stat label="tokens created" value={scan.createdTokenCount != null ? String(scan.createdTokenCount) : '—'} sub={scan.createdTokenCount ? 'dev wallet' : undefined} />
      </div>

      {/* Metrics: all-time vs 90d */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetricsCard title="All-time" metrics={scan.allTime} />
        <MetricsCard title="Last 90 days" metrics={scan.last90d} />
      </div>

      {/* Holdings */}
      <div>
        <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-text-muted">
          holdings {scan.holdingsCount > 0 && <span className="text-text-secondary">({scan.holdingsCount})</span>}
        </h2>
        <HoldingsTable holdings={scan.holdings} />
      </div>

      <p className="px-1 font-mono text-[10px] leading-relaxed text-text-muted">
        PnL, win rate, and trading volume are signal only — not financial advice, not a guarantee. Only ape what you can afford to lose.
      </p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-panel/60 px-3 py-2.5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{label}</div>
      <div className="mt-1 font-display text-lg font-bold text-text-primary">{value}</div>
      {sub && <div className="font-mono text-[10px] text-text-muted">{sub}</div>}
    </div>
  );
}

function MetricsCard({ title, metrics }: { title: string; metrics: WalletMetrics }) {
  const pnl = metrics.pnl;
  const pnlColor = pnl.totalUsd == null ? 'text-text-muted' : pnl.totalUsd >= 0 ? 'text-signal-green' : 'text-rug-red';
  return (
    <div className="rounded-xl border border-border bg-panel/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-sm font-bold text-text-primary">{title}</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">PnL</span>
      </div>
      <div className={`font-display text-2xl font-bold ${pnlColor}`}>{fmtUsdSigned(pnl.totalUsd)}</div>
      {pnl.roiPct != null && <div className={`font-mono text-xs ${pnlColor}`}>{formatSignedPercent(pnl.roiPct)} ROI</div>}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[11px]">
        <Row label="realized" value={fmtUsdSigned(pnl.realizedUsd)} />
        <Row label="unrealized" value={fmtUsdSigned(pnl.unrealizedUsd)} />
        <Row label="invested" value={pnl.investedUsd != null ? formatUsd(pnl.investedUsd) : '—'} />
        <Row label="volume" value={metrics.volumeUsd != null ? formatUsd(metrics.volumeUsd) : '—'} />
        <Row label="win rate" value={pnl.winRatePct != null ? `${pnl.winRatePct.toFixed(0)}%` : '—'} />
        <Row label="trades" value={metrics.trades != null ? String(metrics.trades) : '—'} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-text-muted">{label}</span>
      <span className="text-text-secondary">{value}</span>
    </div>
  );
}

function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  if (holdings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-panel/40 p-6 text-center">
        <p className="font-mono text-xs text-text-muted">{'>'} no SPL token holdings found in this wallet.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-panel/60">
      <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border/60 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-text-muted">
        <span>token</span>
        <span className="text-right">amount</span>
        <span className="text-right">value</span>
      </div>
      <ul className="divide-y divide-border/60">
        {holdings.map((h) => (
          <li key={h.mint} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              {h.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={h.imageUrl} alt="" className="h-6 w-6 shrink-0 rounded-full border border-border object-cover" />
              ) : (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-panel-2 text-[10px]">🪙</div>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm text-text-primary">
                  {h.symbol ? `$${h.symbol}` : shortenAddress(h.mint, 4, 4)}
                </div>
                {h.name && <div className="truncate font-mono text-[10px] text-text-muted">{h.name}</div>}
              </div>
            </div>
            <div className="text-right font-mono text-xs text-text-secondary">{formatNumber(h.amount)}</div>
            <div className="text-right font-mono text-xs text-text-primary">
              {h.valueUsd != null ? formatUsd(h.valueUsd) : '—'}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function fmtUsdSigned(v: number | null): string {
  if (v == null) return '—';
  const s = formatUsd(Math.abs(v));
  return v < 0 ? `-${s}` : `+${s}`;
}
