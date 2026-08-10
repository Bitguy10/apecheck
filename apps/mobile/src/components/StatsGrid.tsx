import { View, Text } from 'react-native';
import { formatUsd, formatNumber, formatPercent, formatAge, shortenAddress } from '@apecheck/core';
import type { ScanResult } from '@apecheck/core';
import { CopyChip } from './CopyChip';
import { toneClass } from '../lib/theme';

type Tone = keyof typeof toneClass;

function Stat({ label, value, tone = 'default', sub }: { label: string; value: string; tone?: Tone; sub?: React.ReactNode }) {
  return (
    <View className="w-[48%] rounded-lg border border-border bg-panel-2 p-3">
      <Text className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{label}</Text>
      <Text className={`mt-1 font-display text-lg font-bold ${toneClass[tone]}`}>{value}</Text>
      {typeof sub === 'string' ? <Text className="mt-0.5 text-[11px] text-text-secondary">{sub}</Text> : sub}
    </View>
  );
}

/** Holder / dev / liquidity / authority quick-stats grid. */
export function StatsGrid({ scan }: { scan: ScanResult }) {
  const dev = scan.devWallet;
  const devTone: Tone = dev.percentHeld > 30 ? 'bad' : dev.percentHeld > 5 ? 'warn' : 'good';
  const topTone: Tone = scan.holders.topHolderPercent > 60 ? 'bad' : scan.holders.topHolderPercent > 20 ? 'warn' : 'good';

  return (
    <View className="flex-row flex-wrap justify-between gap-y-2">
      <Stat
        label="Dev wallet"
        value={formatPercent(dev.percentHeld)}
        tone={devTone}
        sub={
          dev.address ? (
            <View className="mt-1">
              <CopyChip value={dev.address} display={shortenAddress(dev.address, 4, 4)} />
            </View>
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
        sub={scan.liquidity.burned ? '🔥 LP burned' : scan.liquidity.locked ? '🔒 LP locked' : '⚠️ LP unlocked'}
      />
      <Stat label="Mint auth" value={scan.authorities.mintActive ? 'ACTIVE' : 'renounced'} tone={scan.authorities.mintActive ? 'bad' : 'good'} />
      <Stat label="Freeze auth" value={scan.authorities.freezeActive ? 'ACTIVE' : 'renounced'} tone={scan.authorities.freezeActive ? 'bad' : 'good'} />
      <Stat label="Token age" value={formatAge(scan.ageHours)} sub="since launch" />
      <Stat label="LP locked" value={formatPercent(scan.liquidity.lockedFraction * 100, 0)} sub="of pool" />
    </View>
  );
}
