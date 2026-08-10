/**
 * Shared formatters + validators used across web, mobile, and API routes.
 */

// ─────────────────────────────────────────────────────────────
// Solana address validation
// ─────────────────────────────────────────────────────────────

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Lightweight base58 length/charset check (no crypto dep). */
export function isValidSolanaAddress(address: string): boolean {
  if (typeof address !== 'string') return false;
  const trimmed = address.trim();
  return BASE58_RE.test(trimmed);
}

export function normalizeAddress(address: string): string {
  return address.trim();
}

// ─────────────────────────────────────────────────────────────
// Address display
// ─────────────────────────────────────────────────────────────

/** 7A3f...9kQz style truncation for terminal-log display. */
export function shortenAddress(address: string, lead = 4, tail = 4): string {
  if (!address) return '';
  if (address.length <= lead + tail + 3) return address;
  return `${address.slice(0, lead)}...${address.slice(-tail)}`;
}

// ─────────────────────────────────────────────────────────────
// Money / numbers
// ─────────────────────────────────────────────────────────────

export function formatUsd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

export function formatPercent(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

/** Signed percent for price change, e.g. "+12.4%" / "-8.1%". */
export function formatSignedPercent(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)}%`;
}

/**
 * Price formatter for tokens whose price can span cents → nano-dollars.
 * Uses subscript-style leading-zero compression for very small prices,
 * e.g. 0.00000234 → "$0.0₅234".
 */
export function formatTokenPrice(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n) || n < 0) return '—';
  if (n === 0) return '$0';
  if (n >= 1) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  // Count leading zeros after the decimal point.
  const exp = Math.floor(Math.log10(n)); // negative
  const leadingZeros = -exp - 1;
  const sub = String(leadingZeros)
    .split('')
    .map((d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])
    .join('');
  const significant = Math.round(n / Math.pow(10, exp - 3)); // 4 significant digits
  return `$0.0${sub}${significant}`;
}

// ─────────────────────────────────────────────────────────────
// Time
// ─────────────────────────────────────────────────────────────

export function formatAge(ageHours: number | null | undefined): string {
  if (ageHours == null || Number.isNaN(ageHours)) return '—';
  if (ageHours < 1) return `${Math.round(ageHours * 60)}m`;
  if (ageHours < 24) return `${Math.round(ageHours)}h`;
  const days = ageHours / 24;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

/** "2m ago", "3h ago", "5d ago" from an ISO timestamp. */
export function timeAgo(iso: string, nowMs: number): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((nowMs - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}
