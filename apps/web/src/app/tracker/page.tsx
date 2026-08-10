'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { WalletScan, WalletScanHistoryItem } from '@apecheck/core';
import { isValidSolanaAddress, normalizeAddress, shortenAddress, formatUsd, timeAgo } from '@apecheck/core';
import { api, ApiClientError } from '@/lib/api';
import { useWalletScan, WalletScanning, WalletResult } from '@/components/WalletScanView';

const LOCAL_KEY = 'apecheck.walletHistory';

/**
 * Tracker tab — scan any Solana wallet (or dev wallet) for holdings, portfolio
 * value, and PnL / win rate / trading volume. Scanned wallets are remembered:
 * signed-in users get server-side history; anonymous users keep it locally.
 */
export default function TrackerPage() {
  const [value, setValue] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [history, setHistory] = useState<WalletScanHistoryItem[]>([]);
  const [authed, setAuthed] = useState(false);

  const refreshHistory = useCallback(async () => {
    try {
      const server = await api.getWalletScanHistory();
      if (server.length) {
        setAuthed(true);
        setHistory(server);
        return;
      }
    } catch (e) {
      if (!(e instanceof ApiClientError && e.status === 401)) {
        /* ignore; fall through to local */
      }
    }
    setHistory(readLocalHistory());
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const onScanned = useCallback(
    (scan: WalletScan) => {
      // Mirror to local history (covers anonymous users + instant UI update).
      writeLocalHistory(scan);
      refreshHistory();
    },
    [refreshHistory],
  );

  const { scan, error, loading, run } = useWalletScan(onScanned);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const addr = normalizeAddress(value);
    if (!isValidSolanaAddress(addr)) {
      setInputError('That doesn’t look like a valid Solana wallet address.');
      return;
    }
    setInputError(null);
    setCurrent(addr);
    run(addr);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function scanFromHistory(addr: string) {
    setValue(addr);
    setCurrent(addr);
    run(addr);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="py-6">
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="font-display text-2xl font-bold text-text-primary">Tracker</h1>
        <span className="font-mono text-[11px] text-text-muted">wallet & dev-wallet scanner</span>
      </div>
      <p className="mb-4 max-w-lg text-sm text-text-secondary">
        Scan a Solana wallet to see its token holdings, balances, all-time PnL, trading volume and more.
      </p>

      {/* Search */}
      <form onSubmit={submit} className="w-full">
        <div className="group relative flex items-center gap-2 rounded-xl border border-border bg-panel-2/80 px-4 py-4 transition-all focus-within:border-solana-purple/70 focus-within:shadow-glow-purple">
          <span className="select-none font-mono text-solana-purple">◎</span>
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (inputError) setInputError(null);
            }}
            spellCheck={false}
            autoComplete="off"
            placeholder="paste a solana wallet address"
            aria-label="Solana wallet address"
            className="w-full bg-transparent font-mono text-sm text-text-primary outline-none placeholder:text-text-muted sm:text-base"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-solana-purple px-3 py-1.5 font-display text-sm font-bold text-white transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {loading ? '…' : 'TRACK'}
          </button>
        </div>
        {inputError && <p className="mt-2 font-mono text-xs text-rug-red">{inputError}</p>}
      </form>

      {/* Result */}
      <div className="mt-4">
        {loading && current && <WalletScanning address={current} />}
        {!loading && error && current && (
          <div className="py-8">
            <div className="mx-auto max-w-md rounded-lg border border-rug-red/40 bg-rug-red/5 p-6 text-center">
              <div className="text-3xl">{error.code === 'INVALID_ADDRESS' ? '🤔' : '💥'}</div>
              <h2 className="mt-2 font-display text-lg font-bold text-rug-red">
                {error.code === 'INVALID_ADDRESS' ? 'Invalid wallet' : 'Scan failed'}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">{error.message}</p>
              {error.code !== 'INVALID_ADDRESS' && (
                <button
                  onClick={() => run(current)}
                  className="mt-4 rounded-md bg-solana-purple px-4 py-2 font-display text-sm font-bold text-white hover:scale-105"
                >
                  ↻ Try again
                </button>
              )}
            </div>
          </div>
        )}
        {!loading && !error && scan && <WalletResult scan={scan} />}
      </div>

      {/* History */}
      <section className="mt-8">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-mono text-xs uppercase tracking-widest text-text-muted">scanned wallets</h2>
          {!authed && (
            <Link href="/login?next=/tracker" className="font-mono text-[10px] text-text-muted hover:text-signal-green">
              sign in to sync →
            </Link>
          )}
        </div>
        <WalletHistoryTable items={history} onPick={scanFromHistory} />
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// History table — columns mirror the reference tracker layout.
// ─────────────────────────────────────────────────────────────

function WalletHistoryTable({
  items,
  onPick,
}: {
  items: WalletScanHistoryItem[];
  onPick: (address: string) => void;
}) {
  const [now, setNow] = useState(0);
  useEffect(() => setNow(Date.now()), [items]);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-panel/40 p-6 text-center">
        <p className="font-mono text-xs text-text-muted">{'>'} no wallets scanned yet. paste an address above to start.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-panel/60">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/60 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            <th className="px-4 py-2.5 text-left font-normal">wallet</th>
            <th className="px-3 py-2.5 text-right font-normal">value</th>
            <th className="px-3 py-2.5 text-right font-normal">all-time pnl</th>
            <th className="px-3 py-2.5 text-right font-normal">volume</th>
            <th className="px-3 py-2.5 text-right font-normal">win rate</th>
            <th className="px-4 py-2.5 text-right font-normal">scanned</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {items.map((it) => {
            const s = it.summary;
            return (
              <tr
                key={it.id}
                onClick={() => onPick(it.walletAddress)}
                className="cursor-pointer transition-colors hover:bg-panel-2"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-panel-2 text-[10px]">👛</span>
                    <span className="font-mono text-xs text-text-primary">{shortenAddress(it.walletAddress, 4, 4)}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-right font-mono text-xs text-text-primary">{usd(s?.totalValueUsd)}</td>
                <td className={`px-3 py-3 text-right font-mono text-xs ${pnlClass(s?.allTimePnlUsd)}`}>{signedUsd(s?.allTimePnlUsd)}</td>
                <td className="px-3 py-3 text-right font-mono text-xs text-text-secondary">{usd(s?.volumeUsd)}</td>
                <td className="px-3 py-3 text-right font-mono text-xs text-text-secondary">
                  {s?.winRatePct != null ? `${s.winRatePct.toFixed(0)}%` : '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[10px] text-text-muted">
                  {now > 0 ? timeAgo(it.scannedAt, now) : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function usd(v: number | null | undefined): string {
  return v == null ? '—' : formatUsd(v);
}
function signedUsd(v: number | null | undefined): string {
  if (v == null) return '—';
  const s = formatUsd(Math.abs(v));
  return v < 0 ? `-${s}` : `+${s}`;
}
function pnlClass(v: number | null | undefined): string {
  if (v == null) return 'text-text-muted';
  return v >= 0 ? 'text-signal-green' : 'text-rug-red';
}

// ─────────────────────────────────────────────────────────────
// Local (anonymous) wallet history — mirrors mobile behavior.
// ─────────────────────────────────────────────────────────────

function readLocalHistory(): WalletScanHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as WalletScanHistoryItem[]) : [];
  } catch {
    return [];
  }
}

function writeLocalHistory(scan: WalletScan): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: WalletScanHistoryItem = {
      id: scan.walletAddress,
      walletAddress: scan.walletAddress,
      scannedAt: scan.scannedAt,
      summary: {
        totalValueUsd: scan.totalValueUsd,
        allTimePnlUsd: scan.allTime.pnl.totalUsd,
        volumeUsd: scan.allTime.volumeUsd,
        winRatePct: scan.allTime.pnl.winRatePct,
        holdingsCount: scan.holdingsCount,
      },
    };
    const existing = readLocalHistory().filter((h) => h.walletAddress !== scan.walletAddress);
    const next = [entry, ...existing].slice(0, 20);
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota errors */
  }
}
