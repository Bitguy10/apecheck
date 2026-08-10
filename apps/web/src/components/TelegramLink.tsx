'use client';

import { useEffect, useState } from 'react';
import type { TelegramLinkStatus } from '@/app/api/telegram/link/route';
import { api } from '@/lib/api';

/** Connect-Telegram control: mints a deep link the user taps to bind their chat. */
export function TelegramLink() {
  const [status, setStatus] = useState<TelegramLinkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .getTelegramStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  async function connect() {
    setBusy(true);
    try {
      setStatus(await api.createTelegramLink());
    } catch {
      /* leave prior state */
    } finally {
      setBusy(false);
    }
  }

  if (loading || !status) return null;

  // Bot not configured on this deployment — hide the control entirely.
  if (!status.botConfigured && !status.linked) return null;

  if (status.linked) {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-signal-green/40 bg-signal-green/5 px-4 py-2.5 font-mono text-[11px] text-signal-green">
        <span>✈️</span>
        Telegram connected{status.username ? ` (@${status.username})` : ''} — alerts will DM you here.
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-lg border border-border bg-panel/60 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[11px] text-text-secondary">
          {'>'} get rug alerts in Telegram
        </div>
        {status.deepLink ? (
          <a
            href={status.deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-signal-green/50 bg-signal-green/10 px-3 py-1.5 font-mono text-[11px] font-semibold text-signal-green transition-colors hover:bg-signal-green/20"
          >
            ✈️ open Telegram to link
          </a>
        ) : (
          <button
            onClick={connect}
            disabled={busy}
            className="rounded-md border border-signal-green/50 bg-signal-green/10 px-3 py-1.5 font-mono text-[11px] font-semibold text-signal-green transition-colors hover:bg-signal-green/20 disabled:opacity-50"
          >
            {busy ? 'generating…' : '✈️ connect Telegram'}
          </button>
        )}
      </div>
      {status.linkCode && (
        <p className="mt-2 font-mono text-[10px] text-text-muted">
          or DM the bot: <span className="text-text-secondary">/start {status.linkCode}</span>
        </p>
      )}
    </div>
  );
}
