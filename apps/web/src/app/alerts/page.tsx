'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { AlertItem } from '@apecheck/core';
import { shortenAddress, timeAgo } from '@apecheck/core';

const ALERT_META: Record<string, { icon: string; label: string }> = {
  dev_dump: { icon: '🚨', label: 'Dev wallet dump' },
  lp_pull: { icon: '🚨', label: 'Liquidity pulled' },
  authority_reenabled: { icon: '🚨', label: 'Authority re-enabled' },
  price_drop: { icon: '📉', label: 'Big price drop' },
  big_holder_sell: { icon: '🐋', label: 'Whale sell-off' },
};

import { api, ApiClientError } from '@/lib/api';
import { WebPushToggle } from '@/components/WebPushToggle';
import { TelegramLink } from '@/components/TelegramLink';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const list = await api.getAlerts();
        setAlerts(list);
        setNow(Date.now());
      } catch (e) {
        if (e instanceof ApiClientError && e.status === 401) setNeedsAuth(true);
        else setError(e instanceof Error ? e.message : 'Failed to load alerts.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="py-6">
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="font-display text-2xl font-bold text-text-primary">Alerts</h1>
        <Link href="/watchlist" className="font-mono text-[11px] text-text-muted hover:text-signal-green">
          → manage watchlist
        </Link>
      </div>
      <p className="mb-4 font-mono text-[11px] text-text-muted">rug &amp; dump notifications, newest first</p>

      {!loading && !needsAuth && (
        <>
          <WebPushToggle />
          <TelegramLink />
        </>
      )}

      {loading && (
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-panel/40" />
          ))}
        </div>
      )}

      {!loading && needsAuth && (
        <Empty
          icon="🔒"
          title="Sign in to see alerts"
          body="Alerts are tied to your account."
          cta={<Link href="/login?next=/alerts" className="text-signal-green hover:underline">→ sign in / sign up</Link>}
        />
      )}

      {!loading && error && <Empty icon="💥" title="Couldn’t load alerts" body={error} />}

      {!loading && !needsAuth && !error && alerts.length === 0 && (
        <Empty
          icon="🔕"
          title="No alerts yet — good news"
          body="When a watched token rugs — dev dump, LP pull, authority flip, price crash or a whale sell — it’ll show up here (and push to your device)."
        />
      )}

      {!loading && alerts.length > 0 && (
        <ul className="mt-3 space-y-2">
          {alerts.map((a) => {
            const meta = ALERT_META[a.alertType] ?? { icon: '🚨', label: 'Alert' };
            const title = a.title || meta.label;
            const body =
              a.body ||
              (a.percentDropped != null ? `Dev dumped ${a.percentDropped.toFixed(1)}% of holdings.` : '');
            return (
              <li key={a.id} className="rounded-lg border border-rug-red/30 bg-rug-red/5 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-lg leading-none">{meta.icon}</span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/token/${a.tokenAddress}`}
                      className="font-display text-sm font-bold text-rug-red hover:underline"
                    >
                      {title}
                    </Link>
                    {body && <p className="mt-0.5 text-xs text-text-secondary">{body}</p>}
                    <div className="mt-1 font-mono text-[11px] text-text-muted">
                      {shortenAddress(a.tokenAddress, 6, 6)}
                      {now > 0 && <> · {timeAgo(a.triggeredAt, now)}</>}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Empty({ icon, title, body, cta }: { icon: string; title: string; body: string; cta?: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-dashed border-border bg-panel/40 p-8 text-center">
      <div className="text-3xl">{icon}</div>
      <h2 className="mt-2 font-display text-lg font-bold text-text-primary">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-text-secondary">{body}</p>
      {cta && <div className="mt-3 font-mono text-xs">{cta}</div>}
    </div>
  );
}
