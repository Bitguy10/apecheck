'use client';

import { useEffect, useRef, useState } from 'react';
import type { ScanResult } from '@apecheck/core';
import { shortenAddress, timeAgo } from '@apecheck/core';
import { api, ApiClientError } from '@/lib/api';
import { addRecentScan } from '@/lib/recent-scans';
import { RiskGauge } from './RiskGauge';
import { ScoreBadges } from './ScoreBadges';
import { StatsGrid } from './StatsGrid';
import { MarketHeader } from './MarketHeader';
import { TopHoldersTable } from './TopHoldersTable';
import { SafetyChecks } from './SafetyChecks';
import { LiveEmbeds } from './LiveEmbeds';
import { BreakdownLog } from './BreakdownLog';
import { SocialsPanel } from './SocialsPanel';
import { BuyPanel } from './BuyPanel';
import { WatchButton } from './WatchButton';
import { ShareButton } from './ShareButton';
import { CopyButton } from './CopyButton';

const AUTO_REFRESH_MS = 30_000;

const SCAN_STEPS = [
  'connecting to solana rpc…',
  'reading mint & freeze authority…',
  'pulling rugcheck report…',
  'checking LP lock / burn…',
  'measuring dev wallet holdings…',
  'counting holders & concentration…',
  'verifying socials & domain age…',
  'routing DEX liquidity via jupiter…',
  'scoring risk + potential…',
];

export function ScanResultView({ address }: { address: string }) {
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startedRef = useRef(false);

  async function run(forceRefresh = false) {
    setLoading(true);
    setError(null);
    setScan(null);
    try {
      const result = await api.scan(address, forceRefresh);
      setScan(result);
      addRecentScan({
        tokenAddress: result.tokenAddress,
        name: result.meta.name,
        symbol: result.meta.symbol,
        riskScore: result.riskScore,
        riskBand: result.riskBand,
        scannedAt: result.scannedAt,
      });
    } catch (e) {
      const err = e instanceof ApiClientError ? { code: e.code, message: e.message } : { code: 'INTERNAL', message: 'Something went wrong.' };
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  // Silent background refresh — updates data in place without the scanning animation.
  async function refreshInBackground() {
    setRefreshing(true);
    try {
      const result = await api.scan(address, true);
      setScan(result);
    } catch {
      /* keep the last good result on a transient refresh failure */
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  // Feature 2 — live auto-refresh while enabled and the tab is visible.
  useEffect(() => {
    if (!live || loading || error) return;
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') refreshInBackground();
    };
    const id = setInterval(tick, AUTO_REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, loading, error, address]);

  if (loading) return <ScanningState address={address} />;
  if (error) return <ErrorState address={address} error={error} onRetry={() => run(true)} />;
  if (!scan) return null;

  return (
    <div className="space-y-4 py-2">
      {/* Header */}
      <div className="flex items-center gap-3">
        {scan.meta.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={scan.meta.imageUrl} alt="" className="h-12 w-12 rounded-full border border-border object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-panel-2 text-xl">🪙</div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-bold text-text-primary">
            {scan.meta.name || 'Unknown token'} {scan.meta.symbol && <span className="text-text-muted">${scan.meta.symbol}</span>}
          </h1>
          <div className="mt-0.5 flex items-center gap-2">
            <CopyButton value={scan.tokenAddress} display={shortenAddress(scan.tokenAddress, 6, 6)} />
            <span className="font-mono text-[10px] text-text-muted">
              {scan.cached ? 'cached' : 'live'} · {timeAgo(scan.scannedAt, Date.now())}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={() => setLive((v) => !v)}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
              live
                ? 'border-signal-green/60 bg-signal-green/10 text-signal-green'
                : 'border-border text-text-secondary hover:border-signal-green/40'
            }`}
            title="Auto-refresh every 30s"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-pulse-glow bg-signal-green' : 'bg-text-muted'}`} />
            {live ? (refreshing ? 'updating…' : 'live') : 'go live'}
          </button>
          <button
            onClick={() => run(true)}
            className="rounded-md border border-border px-2.5 py-1.5 font-mono text-[11px] text-text-secondary hover:border-signal-green/60 hover:text-signal-green"
            title="Re-scan (bypass cache)"
          >
            ↻ rescan
          </button>
        </div>
      </div>

      {/* Market header — price / MC / FDV / 24h / volume */}
      <MarketHeader market={scan.market} />

      {/* Gauge + badges */}
      <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-panel/40 py-4">
        <RiskGauge score={scan.riskScore} band={scan.riskBand} />
      </div>
      <ScoreBadges
        riskScore={scan.riskScore}
        riskBand={scan.riskBand}
        riskBandLabel={scan.riskBandLabel}
        potentialScore={scan.potentialScore}
      />

      {/* Warnings */}
      {scan.warnings.length > 0 && <WarningBanner warnings={scan.warnings} />}

      {/* Watch + share */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1">
          <WatchButton tokenAddress={scan.tokenAddress} />
        </div>
        <ShareButton scan={scan} />
      </div>

      {/* Live embeds — chart / trades / bubble map */}
      <LiveEmbeds scan={scan} />

      {/* Safety checks — honeypot + dev reputation */}
      <SafetyChecks sellCheck={scan.sellCheck} dev={scan.devReputation} />

      {/* Stats */}
      <StatsGrid scan={scan} />

      {/* Top holder distribution */}
      <TopHoldersTable holders={scan.topHolders} launch={scan.launch} />

      {/* Breakdowns (terminal logs) */}
      <BreakdownLog title="risk analysis" items={scan.riskBreakdown} accent="green" />
      <BreakdownLog title="potential signal" items={scan.potentialBreakdown} accent="purple" />
      <p className="px-1 text-[11px] text-text-muted">{scan.potentialDisclaimer}</p>

      {/* Socials */}
      <SocialsPanel socials={scan.socials} />

      {/* Buy */}
      <div>
        <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-text-muted">where to buy</h2>
        <BuyPanel scan={scan} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-states
// ─────────────────────────────────────────────────────────────

function ScanningState({ address }: { address: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, SCAN_STEPS.length - 1)), 420);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="py-8">
      <div className="mb-4 flex items-center gap-2 font-mono text-xs text-text-muted">
        <span className="h-2 w-2 animate-pulse-glow rounded-full bg-signal-green" />
        scanning {shortenAddress(address, 6, 6)}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-panel/60 p-4 font-mono text-sm">
        {SCAN_STEPS.slice(0, step + 1).map((s, i) => (
          <div key={i} className="log-print flex items-center gap-2 py-0.5">
            <span className="text-signal-green">{i < step ? '✓' : '›'}</span>
            <span className={i < step ? 'text-text-secondary' : 'text-text-primary'}>{s}</span>
            {i === step && <span className="terminal-cursor" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function WarningBanner({ warnings }: { warnings: string[] }) {
  return (
    <div className="rounded-lg border border-warning-amber/30 bg-warning-amber/5 px-4 py-3">
      <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-warning-amber">data notes</div>
      <ul className="space-y-0.5">
        {warnings.map((w, i) => (
          <li key={i} className="text-xs text-warning-amber/90">
            • {w}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ErrorState({
  address,
  error,
  onRetry,
}: {
  address: string;
  error: { code: string; message: string };
  onRetry: () => void;
}) {
  const isNotFound = error.code === 'NOT_FOUND';
  const isInvalid = error.code === 'INVALID_ADDRESS';
  return (
    <div className="py-10">
      <div className="mx-auto max-w-md rounded-lg border border-rug-red/40 bg-rug-red/5 p-6 text-center">
        <div className="text-3xl">{isNotFound ? '👻' : isInvalid ? '🤔' : '💥'}</div>
        <h2 className="mt-2 font-display text-lg font-bold text-rug-red">
          {isNotFound ? 'Token not found' : isInvalid ? 'Invalid address' : 'Scan failed'}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">{error.message}</p>
        <p className="mt-2 font-mono text-[11px] text-text-muted">{shortenAddress(address, 8, 8)}</p>
        {!isInvalid && (
          <button
            onClick={onRetry}
            className="mt-4 rounded-md bg-signal-green px-4 py-2 font-display text-sm font-bold text-jungle-black hover:scale-105"
          >
            ↻ Try again
          </button>
        )}
      </div>
    </div>
  );
}
