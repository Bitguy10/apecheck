'use client';

import { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import type { WatchlistItem } from '@apecheck/core';

export function WatchButton({ tokenAddress }: { tokenAddress: string }) {
  const [item, setItem] = useState<WatchlistItem | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .getWatchlist()
      .then((list) => {
        if (!active) return;
        setAuthed(true);
        setItem(list.find((w) => w.tokenAddress === tokenAddress) ?? null);
      })
      .catch((e) => {
        if (!active) return;
        if (e instanceof ApiClientError && e.status === 401) setAuthed(false);
        else setAuthed(true);
      });
    return () => {
      active = false;
    };
  }, [tokenAddress]);

  async function toggleWatch() {
    if (busy) return;
    setBusy(true);
    try {
      if (item) {
        await api.removeWatch(item.id);
        setItem(null);
      } else {
        const added = await api.addWatch(tokenAddress);
        setItem(added);
      }
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 401) setAuthed(false);
    } finally {
      setBusy(false);
    }
  }

  async function toggleAlert() {
    if (!item || busy) return;
    setBusy(true);
    const next = !item.alertEnabled;
    setItem({ ...item, alertEnabled: next });
    try {
      await api.toggleAlert(item.id, next);
    } catch {
      setItem({ ...item, alertEnabled: !next }); // revert
    } finally {
      setBusy(false);
    }
  }

  if (authed === false) {
    return (
      <div className="rounded-lg border border-border bg-panel/60 px-4 py-3 text-center font-mono text-xs text-text-muted">
        sign in (top right) to watchlist this token & get dev-dump alerts
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={toggleWatch}
        disabled={busy || authed === null}
        className={`flex-1 rounded-lg border px-4 py-2.5 font-display text-sm font-bold transition-colors disabled:opacity-50 ${
          item
            ? 'border-banana-yellow/60 bg-banana-yellow/10 text-banana-yellow'
            : 'border-border bg-panel-2 text-text-primary hover:border-banana-yellow/60'
        }`}
      >
        {item ? '★ Watching' : '☆ Add to watchlist'}
      </button>
      {item && (
        <button
          onClick={toggleAlert}
          disabled={busy}
          className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
            item.alertEnabled
              ? 'border-signal-green/50 bg-signal-green/10 text-signal-green'
              : 'border-border bg-panel text-text-muted'
          }`}
          title="Toggle dev-wallet-dump alert"
        >
          {item.alertEnabled ? '🔔 Dump alert ON' : '🔕 Dump alert OFF'}
        </button>
      )}
    </div>
  );
}
