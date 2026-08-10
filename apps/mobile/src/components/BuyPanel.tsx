import { useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { getPrimaryBuy, getBuyInstructions, formatUsd } from '@apecheck/core';
import type { ScanResult } from '@apecheck/core';
import { SafetyDisclaimer } from './SafetyDisclaimer';
import { CopyChip } from './CopyChip';

function Steps({ steps }: { steps: string[] }) {
  return (
    <View className="mt-2 gap-1.5">
      {steps.map((step, i) => (
        <View key={i} className="flex-row gap-2">
          <Text className="font-mono text-xs text-signal-green">{i + 1}.</Text>
          <Text className="flex-1 text-xs text-text-secondary">{step}</Text>
        </View>
      ))}
    </View>
  );
}

function open(url: string | null) {
  if (url) Linking.openURL(url).catch(() => {});
}

/** Buy flow: Jupiter primary + expandable per-DEX cards with instructions. */
export function BuyPanel({ scan }: { scan: ScanResult }) {
  const address = scan.tokenAddress;
  const primary = getPrimaryBuy(address);
  const dexCards = scan.dexListings.filter((l) => l.dexName.toLowerCase() !== 'jupiter');
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <View className="gap-3">
      {/* Primary: Jupiter */}
      <View className="rounded-lg border border-solana-purple/50 bg-panel-2 p-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="font-mono text-[10px] uppercase tracking-widest text-solana-purple">recommended</Text>
            <Text className="font-display text-lg font-bold text-text-primary">Buy with Jupiter</Text>
            <Text className="text-xs text-text-secondary">{primary.notes}</Text>
          </View>
          <Text className="text-2xl">🪐</Text>
        </View>
        <Pressable
          onPress={() => open(primary.deepLink)}
          className="mt-3 rounded-lg bg-solana-purple py-3 active:opacity-90"
        >
          <Text className="text-center font-display text-base font-bold text-white">Buy Now — best aggregated price →</Text>
        </Pressable>
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="font-mono text-[10px] text-text-muted">slippage: {primary.slippage}</Text>
          <CopyChip value={address} />
        </View>
        <SafetyDisclaimer />
      </View>

      {/* Individual DEXs */}
      {dexCards.length > 0 && (
        <View>
          <Text className="mb-2 font-mono text-xs uppercase tracking-widest text-text-muted">or buy directly on a DEX</Text>
          <View className="gap-2">
            {dexCards.map((listing) => {
              const instr = getBuyInstructions(listing.dexName, address);
              const key = listing.dexName + listing.pairAddress;
              const isOpen = openKey === key;
              return (
                <View key={key} className="overflow-hidden rounded-lg border border-border bg-panel/60">
                  <Pressable
                    onPress={() => setOpenKey(isOpen ? null : key)}
                    className="flex-row items-center justify-between px-4 py-3 active:opacity-70"
                  >
                    <View>
                      <Text className="font-display text-sm font-bold text-text-primary">{instr.dexName}</Text>
                      <Text className="font-mono text-[11px] text-text-muted">
                        {listing.liquidityUsd > 0 ? `${formatUsd(listing.liquidityUsd)} liq` : 'via aggregator'} · slippage {instr.slippage}
                      </Text>
                    </View>
                    <Text className="font-mono text-xs text-signal-green">{isOpen ? '▾' : '▸'}</Text>
                  </Pressable>
                  {isOpen && (
                    <View className="border-t border-border/50 px-4 py-3">
                      <Text className="text-[11px] text-text-secondary">{instr.notes}</Text>
                      <Steps steps={instr.steps} />
                      {instr.deepLink && (
                        <Pressable
                          onPress={() => open(instr.deepLink)}
                          className="mt-3 self-start rounded-md border border-signal-green/50 bg-signal-green/10 px-3 py-1.5 active:opacity-70"
                        >
                          <Text className="text-xs font-semibold text-signal-green">Open {instr.dexName} →</Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}
