'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthButton } from './AuthButton';

const TABS = [
  { href: '/scan', label: 'scan' },
  { href: '/tracker', label: 'tracker' },
  { href: '/watchlist', label: 'watchlist' },
  { href: '/alerts', label: 'alerts' },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="content-layer sticky top-0 z-20 border-b border-border/60 bg-jungle-black/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="group flex items-center gap-2">
          <span className="text-xl transition-transform group-hover:rotate-12">🍌</span>
          <span className="font-display text-lg font-bold tracking-tight text-text-primary">
            Ape<span className="text-signal-green text-glow-green">Check</span>
          </span>
        </Link>
        <nav className="flex items-center gap-0.5 font-mono text-xs sm:gap-1">
          {TABS.map((t) => (
            <NavLink key={t.href} href={t.href} label={t.label} active={isActive(pathname, t.href)} />
          ))}
          <AuthButton />
        </nav>
      </div>
    </header>
  );
}

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-2 py-1.5 transition-colors sm:px-2.5 ${
        active
          ? 'bg-panel text-signal-green'
          : 'text-text-secondary hover:bg-panel hover:text-signal-green'
      }`}
    >
      {label}
    </Link>
  );
}
