'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { WatchlistItem } from '@apecheck/core';
import { DEV_DUMP_THRESHOLD_PERCENT, shortenAddress, timeAgo } from '@apecheck/core';
import { api, ApiClientError } from '@/lib/api';
import { CopyButton } from '@/components/CopyButton';

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    setNeedsAuth(false);
    try {
      const list = await api.getWatchlist();
      setItems(list);
      setNow(Date.now());
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 401) setNeedsAuth(true);
      else setError(e instanceof Error ? e.message : 'Failed to load watchlist.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(item: WatchlistItem) {
    setBusy(item.id);
    const next = !item.alertEnabled;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, alertEnabled: next } : i)));
    try {
      await api.toggleAlert(item.id, next);
    } catch {
      // revert on failure
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, alertEnabled: !next } : i)));
    } finally {
      setBusy(null);
    }
  }

  async function remove(item: WatchlistItem) {
    setBusy(item.id);
    const snapshot = items;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    try {
      await api.removeWatch(item.id);
    } catch {
      setItems(snapshot);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="py-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="font-display text-2xl font-bold text-text-primary">Watchlist</h1>
        <span className="font-mono text-[11px] text-text-muted">dump alerts @ {DEV_DUMP_THRESHOLD_PERCENT}% dev sell</span>
      </div>

      {loading && <SkeletonList />}

      {!loading && needsAuth && (
        <EmptyPanel
          icon="🔒"
          title="Sign in to track tokens"
          body="Your watchlist and dev-dump alerts are tied to your account."
          cta={<Link href="/login?next=/watchlist" className="text-signal-green hover:underline">→ sign in / sign up</Link>}
        />
      )}

      {!loading && error && <EmptyPanel icon="💥" title="Couldn’t load watchlist" body={error} />}

      {!loading && !needsAuth && !error && items.length === 0 && (
        <EmptyPanel
          icon="👀"
          title="Nothing watched yet"
          body="Scan a token, then hit “watch” to get alerted if the dev wallet starts dumping."
          cta={<Link href="/" className="text-signal-green hover:underline">→ scan a token</Link>}
        />
      )}

      {!loading && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-border bg-panel/60 p-4 transition-colors hover:border-border"
            >
              <div className="flex items-start justify-between gap-3">
                <Link href={`/token/${item.tokenAddress}`} className="min-w-0 flex-1 group">
                  <div className="truncate font-display text-sm font-semibold text-text-primary group-hover:text-signal-green">
                    {item.meta?.name || 'Unknown token'}{' '}
                    {item.meta?.symbol && <span className="text-text-muted">${item.meta.symbol}</span>}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-text-muted">
                    {shortenAddress(item.tokenAddress, 6, 6)}
                    {now > 0 && <> · watched {timeAgo(item.createdAt, now)}</>}
                  </div>
                </Link>
                {typeof item.meta?.riskScore === 'number' && (
                  <div className="text-right">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-text-muted">risk</div>
                    <div className="font-display text-lg font-bold text-text-primary">{item.meta.riskScore}</div>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/50 pt-3">
                <div className="min-w-0 font-mono text-[11px] text-text-muted">
                  {item.devWalletAddress ? (
                    <>dev <CopyButton value={item.devWalletAddress} display={shortenAddress(item.devWalletAddress, 4, 4)} /></>
                  ) : (
                    <span>dev wallet not identified</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggle(item)}
                    disabled={busy === item.id}
                    className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition-colors disabled:opacity-50 ${
                      item.alertEnabled
                        ? 'border-signal-green/50 bg-signal-green/10 text-signal-green'
                        : 'border-border text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${item.alertEnabled ? 'bg-signal-green animate-pulse-glow' : 'bg-text-muted'}`} />
                    {item.alertEnabled ? 'alerts on' : 'alerts off'}
                  </button>
                  <button
                    onClick={() => remove(item)}
                    disabled={busy === item.id}
                    className="rounded-md border border-border px-2.5 py-1.5 font-mono text-[11px] text-text-muted transition-colors hover:border-rug-red/60 hover:text-rug-red disabled:opacity-50"
                  >
                    remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-lg border border-border bg-panel/40" />
      ))}
    </div>
  );
}

function EmptyPanel({ icon, title, body, cta }: { icon: string; title: string; body: string; cta?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-panel/40 p-8 text-center">
      <div className="text-3xl">{icon}</div>
      <h2 className="mt-2 font-display text-lg font-bold text-text-primary">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-text-secondary">{body}</p>
      {cta && <div className="mt-3 font-mono text-xs">{cta}</div>}
    </div>
  );
}
