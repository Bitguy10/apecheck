import { useState } from 'react';
import { View, Text, Pressable, Linking, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import type { ScanResult } from '@apecheck/core';
import { C } from '../lib/theme';

type Tab = 'chart' | 'trades' | 'bubbles';

/**
 * Live embeds using free official pages rendered in a WebView:
 *  - Chart & Trades: GeckoTerminal pool embed (swaps=1 shows the live buy/sell feed).
 *  - Bubble Map:     Bubblemaps token map (holder connectivity + concentration).
 * The WebView only mounts once a tab is opened (heavy third-party pages).
 */
export function LiveEmbeds({ scan }: { scan: ScanResult }) {
  const [tab, setTab] = useState<Tab | null>(null);
  const pair = scan.market.primaryPair;
  const address = scan.tokenAddress;

  const geckoBase = pair
    ? `https://www.geckoterminal.com/solana/pools/${pair.pairAddress}?embed=1&info=0&grayscale=0&light_chart=0`
    : null;
  const chartUrl = geckoBase ? `${geckoBase}&swaps=0` : null;
  const tradesUrl = geckoBase ? `${geckoBase}&swaps=1` : null;
  const bubbleUrl = `https://app.bubblemaps.io/sol/token/${address}`;

  const tabs: { key: Tab; label: string; available: boolean }[] = [
    { key: 'chart', label: '📈 Chart', available: !!chartUrl },
    { key: 'trades', label: '💱 Trades', available: !!tradesUrl },
    { key: 'bubbles', label: '🫧 Bubble map', available: true },
  ];

  const activeUrl = tab === 'chart' ? chartUrl : tab === 'trades' ? tradesUrl : tab === 'bubbles' ? bubbleUrl : null;

  return (
    <View>
      <Text className="mb-2 font-mono text-xs uppercase tracking-widest text-text-muted">live markets</Text>

      <View className="mb-2 flex-row flex-wrap gap-2">
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            disabled={!t.available}
            onPress={() => setTab((cur) => (cur === t.key ? null : t.key))}
            className={`rounded-md border px-3 py-1.5 ${
              tab === t.key ? 'border-signal-green/60 bg-signal-green/10' : 'border-border'
            } ${!t.available ? 'opacity-40' : 'active:opacity-70'}`}
          >
            <Text className={`font-mono text-[11px] ${tab === t.key ? 'text-signal-green' : 'text-text-secondary'}`}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === null ? (
        <View className="rounded-lg border border-dashed border-border bg-panel/40 px-4 py-8">
          <Text className="text-center text-xs text-text-muted">
            Select a view above to load the live chart, trade feed, or holder bubble map.
          </Text>
        </View>
      ) : (
        <View className="h-[420px] overflow-hidden rounded-lg border border-border bg-panel">
          {activeUrl && (
            <WebView
              source={{ uri: activeUrl }}
              className="flex-1"
              originWhitelist={['https://*']}
              startInLoadingState
              renderLoading={() => (
                <View className="absolute inset-0 items-center justify-center bg-panel">
                  <ActivityIndicator color={C['signal-green']} />
                </View>
              )}
              // Keep users inside the embed; open external navigations in the system browser.
              onShouldStartLoadWithRequest={(req) => {
                if (req.url === activeUrl || req.url.startsWith('about:')) return true;
                if (req.navigationType === 'click') {
                  Linking.openURL(req.url).catch(() => {});
                  return false;
                }
                return true;
              }}
            />
          )}
        </View>
      )}

      {tab === 'bubbles' && (
        <Pressable onPress={() => Linking.openURL(bubbleUrl).catch(() => {})} className="mt-1">
          <Text className="text-center font-mono text-[10px] text-solana-purple">open in Bubblemaps ↗</Text>
        </Pressable>
      )}
      {(tab === 'chart' || tab === 'trades') && pair && (
        <Text className="mt-1 text-center font-mono text-[10px] text-text-muted">via GeckoTerminal · {pair.dexId}</Text>
      )}
    </View>
  );
}
