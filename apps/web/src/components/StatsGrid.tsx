import { formatUsd, formatNumber, formatPercent, formatAge, shortenAddress } from '@apecheck/core';
import type { ScanResult } from '@apecheck/core';
import { CopyButton } from './CopyButton';

function Stat({
  label,
  value,
  tone = 'default',
  sub,
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'good' | 'warn' | 'bad';
  sub?: React.ReactNode;
}) {
  const toneColor =
    tone === 'good'
      ? 'text-signal-green'
      : tone === 'warn'
        ? 'text-warning-amber'
        : tone === 'bad'
          ? 'text-rug-red'
          : 'text-text-primary';
  return (
    <div className="rounded-lg border border-border bg-panel-2 p-3">
      <div className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{label}</div>
      <div className={`mt-1 font-display text-lg font-bold ${toneColor}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-text-secondary">{sub}</div>}
    </div>
  );
}

/** Holder / dev-wallet / liquidity / authority quick-stats grid. */
export function StatsGrid({ scan }: { scan: ScanResult }) {
  const dev = scan.devWallet;
  const devTone = dev.percentHeld > 30 ? 'bad' : dev.percentHeld > 5 ? 'warn' : 'good';
  const topTone =
    scan.holders.topHolderPercent > 60 ? 'bad' : scan.holders.topHolderPercent > 20 ? 'warn' : 'good';

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Stat
        label="Dev wallet"
        value={formatPercent(dev.percentHeld)}
        tone={devTone}
        sub={
          dev.address ? (
            <CopyButton value={dev.address} display={shortenAddress(dev.address, 4, 4)} className="mt-0.5" />
          ) : (
            'not identified'
          )
        }
      />
      <Stat label="Top-10 holders" value={formatPercent(scan.holders.topHolderPercent)} tone={topTone} sub="combined supply" />
      <Stat label="Holders" value={formatNumber(scan.holders.count)} sub="unique wallets" />
      <Stat
        label="Liquidity"
        value={formatUsd(scan.liquidity.usd)}
        tone={scan.liquidity.usd < 5000 ? 'warn' : 'default'}
        sub={
          scan.liquidity.burned
            ? '🔥 LP burned'
            : scan.liquidity.locked
              ? '🔒 LP locked'
              : '⚠️ LP unlocked'
        }
      />
      <Stat
        label="Mint auth"
        value={scan.authorities.mintActive ? 'ACTIVE' : 'renounced'}
        tone={scan.authorities.mintActive ? 'bad' : 'good'}
      />
      <Stat
        label="Freeze auth"
        value={scan.authorities.freezeActive ? 'ACTIVE' : 'renounced'}
        tone={scan.authorities.freezeActive ? 'bad' : 'good'}
      />
      <Stat label="Token age" value={formatAge(scan.ageHours)} sub="since launch" />
      <Stat label="LP locked" value={formatPercent(scan.liquidity.lockedFraction * 100, 0)} sub="of pool" />
    </div>
  );
}
