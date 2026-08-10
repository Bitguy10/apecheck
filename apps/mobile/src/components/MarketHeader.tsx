import { View, Text } from 'react-native';
import { formatUsd, formatTokenPrice, formatSignedPercent } from '@apecheck/core';
import type { MarketInfo } from '@apecheck/core';

function Cell({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'up' | 'down' }) {
  const color = tone === 'up' ? 'text-signal-green' : tone === 'down' ? 'text-rug-red' : 'text-text-primary';
  return (
    <View className="w-[31%]">
      <Text className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{label}</Text>
      <Text className={`mt-0.5 font-display text-base font-bold ${color}`}>{value}</Text>
    </View>
  );
}

/** Price / market-cap / FDV / 24h change / volume header strip. */
export function MarketHeader({ market }: { market: MarketInfo }) {
  const change = market.priceChange24hPct;
  const changeTone = change == null ? 'default' : change >= 0 ? 'up' : 'down';

  const hasAny =
    market.priceUsd != null || market.marketCapUsd != null || market.fdvUsd != null || market.volume24hUsd > 0;
  if (!hasAny) return null;

  return (
    <View className="rounded-xl border border-border bg-panel/60 p-4">
      <View className="flex-row flex-wrap justify-between gap-y-3">
        <Cell label="Price" value={formatTokenPrice(market.priceUsd)} />
        <Cell label="24h" value={formatSignedPercent(change)} tone={changeTone} />
        <Cell label="Market cap" value={market.marketCapUsd != null ? formatUsd(market.marketCapUsd) : '—'} />
        <Cell label="FDV" value={market.fdvUsd != null ? formatUsd(market.fdvUsd) : '—'} />
        <Cell label="Vol 24h" value={market.volume24hUsd > 0 ? formatUsd(market.volume24hUsd) : '—'} />
      </View>
    </View>
  );
}
