import { View, Text, Pressable, Linking } from 'react-native';
import { formatPercent, shortenAddress, formatAge } from '@apecheck/core';
import type { SellCheck, DevReputation } from '@apecheck/core';

// Full class strings per verdict (NativeWind can't see interpolated names).
const VERDICT = {
  bad: { box: 'border-rug-red/40 bg-rug-red/5', text: 'text-rug-red', icon: '🚫', label: 'HONEYPOT RISK' },
  good: { box: 'border-signal-green/40 bg-signal-green/5', text: 'text-signal-green', icon: '✅', label: 'SELLABLE' },
  unknown: { box: 'border-warning-amber/40 bg-warning-amber/5', text: 'text-warning-amber', icon: '❓', label: 'UNKNOWN' },
} as const;

function verdictKey(sellable: boolean | null): keyof typeof VERDICT {
  if (sellable === false) return 'bad';
  if (sellable === true) return 'good';
  return 'unknown';
}

/** "Can I sell?" honeypot simulation + dev-wallet reputation. */
export function SafetyChecks({ sellCheck, dev }: { sellCheck: SellCheck; dev: DevReputation }) {
  const v = VERDICT[verdictKey(sellCheck.sellable)];

  return (
    <View className="gap-2">
      {/* Can I sell? */}
      <View className={`rounded-lg border p-3 ${v.box}`}>
        <View className="flex-row items-center gap-2">
          <Text className="text-lg">{v.icon}</Text>
          <View>
            <Text className="font-mono text-[10px] uppercase tracking-widest text-text-muted">can i sell?</Text>
            <Text className={`font-display text-sm font-bold ${v.text}`}>{v.label}</Text>
          </View>
        </View>
        <Text className="mt-2 text-[11px] text-text-secondary">{sellCheck.note}</Text>
        {sellCheck.impliedTaxPct != null && sellCheck.impliedTaxPct > 0 && (
          <Text className="mt-1 font-mono text-[11px] text-warning-amber">
            implied tax/loss: {formatPercent(sellCheck.impliedTaxPct)}
          </Text>
        )}
      </View>

      {/* Dev reputation */}
      <View className={`rounded-lg border p-3 ${dev.freshWallet ? 'border-warning-amber/40 bg-warning-amber/5' : 'border-border bg-panel-2'}`}>
        <View className="flex-row items-center gap-2">
          <Text className="text-lg">{dev.freshWallet ? '🆕' : '👤'}</Text>
          <View>
            <Text className="font-mono text-[10px] uppercase tracking-widest text-text-muted">dev wallet</Text>
            <Text className="font-display text-sm font-bold text-text-primary">
              {dev.walletAgeDays != null ? `${formatAge(dev.walletAgeDays * 24)} old` : 'age unknown'}
            </Text>
          </View>
        </View>
        <Text className="mt-2 text-[11px] text-text-secondary">{dev.note}</Text>
        <View className="mt-1 flex-row items-center gap-3">
          {dev.priorTokenCount != null && (
            <Text className="font-mono text-[11px] text-text-muted">prior tokens: {dev.priorTokenCount}</Text>
          )}
          {dev.wallet && (
            <Pressable onPress={() => Linking.openURL(`https://solscan.io/account/${dev.wallet}`).catch(() => {})}>
              <Text className="font-mono text-[11px] text-text-secondary">{shortenAddress(dev.wallet, 4, 4)} ↗</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
