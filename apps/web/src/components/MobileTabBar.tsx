'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Mobile-only bottom navigation — a compact frosted-glass pill floating above
 * the content (hidden at sm+, where the top Nav takes over). Fully rounded with
 * no sharp corners; each icon+label pair gets its own soft-rounded active state.
 * <main> carries pb-24 so content never hides behind it.
 */
const TABS = [
  { href: '/', label: 'home', icon: '🍌' },
  { href: '/tracker', label: 'tracker', icon: '👛' },
  { href: '/watchlist', label: 'watchlist', icon: '⭐' },
  { href: '/alerts', label: 'alerts', icon: '🔔' },
];

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 sm:hidden"
    >
      <div className="flex items-center gap-1 rounded-full border border-border/60 bg-jungle-black/70 px-1.5 py-1.5 shadow-glow-purple backdrop-blur-xl">
        {TABS.map((t) => {
          const active = isActive(pathname, t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-w-[3.75rem] flex-col items-center gap-0.5 rounded-full px-3 py-1.5 font-mono text-[10px] transition-colors ${
                active
                  ? 'bg-signal-green/10 text-signal-green'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <span className="text-base leading-none">{t.icon}</span>
              <span className="leading-none tracking-tight">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
