'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { AccountType } from '@apecheck/core';
import { getBrowserSupabase } from '@/lib/supabase-client';
import { api } from '@/lib/api';

/**
 * Account control in the nav. Signed out → a "sign in" link. Signed in → a
 * "My Account" dropdown (avatar + email + tier badge, Profile, Logout).
 * QR login is intentionally omitted.
 */
export function AuthButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [tier, setTier] = useState<AccountType>('REGULAR');
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Pull the account tier for the badge once we know the user is signed in.
  useEffect(() => {
    if (!email) {
      setTier('REGULAR');
      return;
    }
    let active = true;
    api.getProfile()
      .then((p) => active && setTier(p.accountType))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [email]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Close the menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function signOut() {
    await getBrowserSupabase().auth.signOut();
    setEmail(null);
    setOpen(false);
    router.push('/');
    router.refresh();
  }

  if (!email) {
    const next = pathname && pathname !== '/login' ? `?next=${encodeURIComponent(pathname)}` : '';
    return (
      <Link
        href={`/login${next}`}
        className="rounded-md border border-signal-green/40 bg-signal-green/10 px-2.5 py-1.5 text-signal-green transition-colors hover:bg-signal-green/20"
      >
        sign in
      </Link>
    );
  }

  const initial = email.trim().charAt(0).toUpperCase() || '?';
  const handle = email.split('@')[0];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border border-border px-1.5 py-1 text-text-secondary transition-colors hover:border-solana-purple/60 hover:text-text-primary"
        aria-haspopup="menu"
        aria-expanded={open}
        title={email}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-solana-purple/20 font-display text-[11px] font-bold text-solana-purple">
          {initial}
        </span>
        <span className="hidden max-w-[90px] truncate sm:inline">{handle}</span>
        <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-panel shadow-glow-purple"
        >
          <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-solana-purple/20 font-display text-sm font-bold text-solana-purple">
              {initial}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-text-primary">{handle}</div>
              <div className="truncate font-mono text-[10px] text-text-muted">{email}</div>
            </div>
          </div>

          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">account</span>
            <TierBadge tier={tier} />
          </div>

          <div className="border-t border-border/60 py-1">
            <Link
              href="/profile"
              role="menuitem"
              className="flex items-center justify-between px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-panel-2 hover:text-text-primary"
            >
              <span className="flex items-center gap-2">👤 Profile</span>
              <span className="text-text-muted">›</span>
            </Link>
            <button
              onClick={signOut}
              role="menuitem"
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-text-secondary transition-colors hover:bg-rug-red/10 hover:text-rug-red"
            >
              ⎋ Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TierBadge({ tier }: { tier: AccountType }) {
  if (tier === 'PRO') {
    return (
      <span className="rounded-full border border-solana-purple/50 bg-solana-purple/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-solana-purple">
        ★ pro
      </span>
    );
  }
  return (
    <span className="rounded-full border border-border bg-panel-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
      regular
    </span>
  );
}
