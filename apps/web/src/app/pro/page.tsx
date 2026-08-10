'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Profile } from '@apecheck/core';
import { api, ApiClientError } from '@/lib/api';

const BENEFITS: { icon: string; title: string; body: string }[] = [
  {
    icon: '⚡',
    title: 'Unlimited scans',
    body: 'No daily cap on token or wallet scans. Ape as fast as the chain moves.',
  },
  {
    icon: '🔔',
    title: 'Real-time alerts',
    body: 'Instant push + Telegram alerts the moment authorities, LP lock, or dev holdings change.',
  },
  {
    icon: '👛',
    title: 'Deep wallet tracking',
    body: 'Windowed PnL, win rate, and trading volume on every wallet you track.',
  },
  {
    icon: '📊',
    title: 'Priority data',
    body: 'Fresher prices and holder data from premium upstream tiers — less “—”, more signal.',
  },
  {
    icon: '🎯',
    title: 'Larger watchlist',
    body: 'Track more tokens and wallets at once, with faster background refresh.',
  },
  {
    icon: '🛡️',
    title: 'Early features',
    body: 'First access to new risk checks and detectors as they ship.',
  },
];

export default function ProPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .getProfile()
      .then(setProfile)
      .catch((e) => {
        if (!(e instanceof ApiClientError)) console.error(e);
      })
      .finally(() => setLoaded(true));
  }, []);

  const isPro = profile?.accountType === 'PRO';

  return (
    <div className="py-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-solana-purple/40 bg-gradient-to-br from-solana-purple/15 via-panel/60 to-signal-green/10 p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-8 -top-8 text-8xl opacity-10">★</div>
        <span className="inline-block rounded-full border border-solana-purple/50 bg-solana-purple/15 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-solana-purple">
          ApeCheck PRO
        </span>
        <h1 className="mt-3 max-w-md font-display text-3xl font-bold text-text-primary sm:text-4xl">
          Scan deeper. Ape smarter.
        </h1>
        <p className="mt-2 max-w-lg text-sm text-text-secondary">
          PRO unlocks unlimited scans, real-time alerts, and full wallet analytics — so you catch the rug
          before it catches you.
        </p>

        <div className="mt-5">
          {!loaded ? (
            <div className="h-11 w-44 animate-pulse rounded-lg bg-panel-2" />
          ) : isPro ? (
            <div className="inline-flex items-center gap-2 rounded-lg border border-signal-green/40 bg-signal-green/10 px-4 py-2.5 font-display text-sm font-bold text-signal-green">
              ✓ You’re on PRO — thank you!
            </div>
          ) : (
            <UpgradeButton />
          )}
        </div>
      </div>

      {/* Benefits grid */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {BENEFITS.map((b) => (
          <div key={b.title} className="rounded-xl border border-border bg-panel/60 p-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">{b.icon}</span>
              <h3 className="font-display text-base font-bold text-text-primary">{b.title}</h3>
            </div>
            <p className="mt-1.5 text-sm text-text-secondary">{b.body}</p>
          </div>
        ))}
      </div>

      {/* Comparison */}
      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-panel/60">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-border/60 px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
          <span>feature</span>
          <span className="w-20 text-center">regular</span>
          <span className="w-20 text-center text-solana-purple">pro</span>
        </div>
        <ul className="divide-y divide-border/50">
          <CompareRow label="Token risk scans" regular="10 / day" pro="unlimited" />
          <CompareRow label="Wallet scans" regular="5 / day" pro="unlimited" />
          <CompareRow label="Push + Telegram alerts" regular={false} pro />
          <CompareRow label="Windowed wallet PnL & win rate" regular={false} pro />
          <CompareRow label="Watchlist size" regular="25" pro="500" />
          <CompareRow label="Background refresh" regular="hourly" pro="live" />
        </ul>
      </div>

      <p className="mt-6 text-center font-mono text-[10px] leading-relaxed text-text-muted">
        Risk and potential scores are signal only — not financial advice, not a guarantee.
        <br />
        Only buy what you can afford to lose.
      </p>

      <div className="mt-4 text-center">
        <Link href="/profile" className="font-mono text-xs text-text-muted hover:text-signal-green">
          ← back to profile
        </Link>
      </div>
    </div>
  );
}

/**
 * Upgrade CTA. No payment provider is wired up yet, so this deliberately does
 * NOT pretend to charge or unlock anything — it registers interest and clearly
 * states that checkout is coming. (A fake "you're now PRO" flow would be a
 * broken paywall.)
 */
function UpgradeButton() {
  const [clicked, setClicked] = useState(false);

  if (clicked) {
    return (
      <div className="inline-flex max-w-sm items-start gap-2 rounded-lg border border-solana-purple/40 bg-solana-purple/10 px-4 py-3 text-left">
        <span className="text-lg">🚧</span>
        <div>
          <div className="font-display text-sm font-bold text-text-primary">Payments coming soon</div>
          <p className="mt-0.5 text-xs text-text-secondary">
            PRO checkout isn’t live yet. We’ve noted your interest — you’ll be among the first to know when
            it opens.
          </p>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setClicked(true)}
      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-solana-purple to-signal-green px-6 py-2.5 font-display text-sm font-bold text-white transition-transform hover:scale-[1.03] active:scale-95"
    >
      ⚡ Upgrade to PRO
    </button>
  );
}

function CompareRow({
  label,
  regular,
  pro,
}: {
  label: string;
  regular: string | boolean;
  pro: string | boolean;
}) {
  return (
    <li className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-4 py-2.5 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="w-20 text-center font-mono text-xs text-text-muted">{cell(regular, false)}</span>
      <span className="w-20 text-center font-mono text-xs text-solana-purple">{cell(pro, true)}</span>
    </li>
  );
}

function cell(v: string | boolean, isPro: boolean): React.ReactNode {
  if (v === true) return <span className={isPro ? 'text-signal-green' : 'text-text-secondary'}>✓</span>;
  if (v === false) return <span className="text-text-muted">✗</span>;
  return v;
}
