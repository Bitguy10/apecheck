import { View, Text, Pressable, Linking } from 'react-native';
import { shortenAddress, formatPercent } from '@apecheck/core';
import type { TopHolder, LaunchAnalysis } from '@apecheck/core';

function TagPill({ tag }: { tag: string }) {
  const isLp = tag === 'LP';
  return (
    <View
      className={`rounded px-1.5 py-0.5 ${
        isLp ? 'border border-solana-purple/40 bg-solana-purple/10' : 'border border-rug-red/40 bg-rug-red/10'
      }`}
    >
      <Text className={`font-mono text-[9px] uppercase tracking-wider ${isLp ? 'text-solana-purple' : 'text-rug-red'}`}>
        {tag}
      </Text>
    </View>
  );
}

/** Top holder concentration list. Tap a wallet to open it on Solscan for tracking. */
export function TopHoldersTable({ holders, launch }: { holders: TopHolder[]; launch: LaunchAnalysis }) {
  if (!holders || holders.length === 0) {
    return (
      <View>
        <Text className="mb-2 font-mono text-xs uppercase tracking-widest text-text-muted">top holders</Text>
        <View className="rounded-lg border border-border bg-panel/60 px-4 py-6">
          <Text className="text-center text-xs text-text-muted">Holder distribution unavailable for this token.</Text>
        </View>
      </View>
    );
  }

  const maxPct = Math.max(...holders.map((h) => h.pct), 1);

  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="font-mono text-xs uppercase tracking-widest text-text-muted">top holders</Text>
        <Text className="font-mono text-[10px] text-text-muted">tap to track on solscan</Text>
      </View>

      <View className="overflow-hidden rounded-lg border border-border bg-panel/60">
        {holders.map((h) => (
          <Pressable
            key={h.rank + h.address}
            onPress={() => Linking.openURL(`https://solscan.io/account/${h.address}`).catch(() => {})}
            className="flex-row items-center gap-3 border-b border-border/40 px-3 py-2 active:opacity-70"
          >
            <Text className="w-5 text-right font-mono text-[11px] text-text-muted">{h.rank}</Text>

            <View className="min-w-0 flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="font-mono text-xs text-text-secondary">{shortenAddress(h.address, 5, 5)}</Text>
                {h.tag ? <TagPill tag={h.tag} /> : null}
              </View>
              {/* concentration bar */}
              <View className="mt-1 h-1 w-full overflow-hidden rounded-full bg-panel-2">
                <View
                  className={`h-full rounded-full ${
                    h.isLiquidityPool ? 'bg-solana-purple/50' : h.insider ? 'bg-rug-red/60' : 'bg-signal-green/50'
                  }`}
                  style={{ width: `${Math.max(3, (h.pct / maxPct) * 100)}%` }}
                />
              </View>
            </View>

            <Text className="w-14 text-right font-display text-sm font-bold text-text-primary">{formatPercent(h.pct)}</Text>
          </Pressable>
        ))}
      </View>

      {/* Launch / insider analysis note */}
      <View
        className={`mt-2 rounded-lg border px-3 py-2 ${
          launch.bundledSuspected
            ? 'border-rug-red/40 bg-rug-red/5'
            : launch.insiderCount > 0
              ? 'border-warning-amber/30 bg-warning-amber/5'
              : 'border-border bg-panel-2'
        }`}
      >
        <Text
          className={`text-[11px] ${
            launch.bundledSuspected ? 'text-rug-red' : launch.insiderCount > 0 ? 'text-warning-amber' : 'text-text-secondary'
          }`}
        >
          <Text className="font-mono uppercase tracking-wider">launch: </Text>
          {launch.note}
        </Text>
      </View>
    </View>
  );
}
