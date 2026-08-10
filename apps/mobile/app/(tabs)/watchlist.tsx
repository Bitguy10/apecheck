import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { WatchlistItem } from '@apecheck/core';
import { DEV_DUMP_THRESHOLD_PERCENT, shortenAddress, timeAgo } from '@apecheck/core';
import { useAuth } from '../../src/context/AuthContext';
import { getWatchlist, removeWatch, setAlertEnabled } from '../../src/lib/data';
import { AuthSheet } from '../../src/components/AuthSheet';
import { C } from '../../src/lib/theme';

export default function WatchlistScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const load = useCallback(async () => {
    if (!session) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      setItems(await getWatchlist());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  async function toggle(item: WatchlistItem) {
    const next = !item.alertEnabled;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, alertEnabled: next } : i)));
    try {
      await setAlertEnabled(item.id, next);
    } catch {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, alertEnabled: !next } : i)));
    }
  }

  async function remove(item: WatchlistItem) {
    const snapshot = items;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    try {
      await removeWatch(item.id);
    } catch {
      setItems(snapshot);
    }
  }

  if (!session && !loading) {
    return (
      <View className="flex-1 items-center justify-center bg-jungle-black p-8">
        <Text className="text-3xl">🔒</Text>
        <Text className="mt-2 font-display text-lg font-bold text-text-primary">Sign in to track tokens</Text>
        <Text className="mt-1 text-center text-sm text-text-secondary">
          Your watchlist and dev-dump alerts are tied to your account.
        </Text>
        <Pressable onPress={() => setAuthOpen(true)} className="mt-4 rounded-lg bg-signal-green px-5 py-2.5 active:opacity-90">
          <Text className="font-display font-bold text-jungle-black">Sign in</Text>
        </Pressable>
        <AuthSheet visible={authOpen} onClose={() => setAuthOpen(false)} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-jungle-black"
      contentContainerClassName="p-4 pb-16"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={C['signal-green']}
        />
      }
    >
      <Text className="mb-4 font-mono text-[11px] text-text-muted">dump alerts @ {DEV_DUMP_THRESHOLD_PERCENT}% dev sell</Text>

      {items.length === 0 && !loading ? (
        <View className="rounded-lg border border-dashed border-border bg-panel/40 p-8">
          <Text className="text-center text-3xl">👀</Text>
          <Text className="mt-2 text-center font-display text-lg font-bold text-text-primary">Nothing watched yet</Text>
          <Text className="mt-1 text-center text-sm text-text-secondary">
            Scan a token, then tap “watch” to get alerted if the dev wallet dumps.
          </Text>
        </View>
      ) : (
        <View className="gap-2">
          {items.map((item) => (
            <View key={item.id} className="rounded-lg border border-border bg-panel/60 p-4">
              <Pressable onPress={() => router.push(`/token/${item.tokenAddress}`)} className="active:opacity-70">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="font-display text-sm font-semibold text-text-primary" numberOfLines={1}>
                      {item.meta?.name || 'Unknown token'} {item.meta?.symbol ? <Text className="text-text-muted">${item.meta.symbol}</Text> : null}
                    </Text>
                    <Text className="mt-0.5 font-mono text-[11px] text-text-muted">
                      {shortenAddress(item.tokenAddress, 6, 6)} · watched {timeAgo(item.createdAt, Date.now())}
                    </Text>
                  </View>
                  {typeof item.meta?.riskScore === 'number' && (
                    <View className="items-end">
                      <Text className="font-mono text-[9px] uppercase tracking-widest text-text-muted">risk</Text>
                      <Text className="font-display text-lg font-bold text-text-primary">{item.meta.riskScore}</Text>
                    </View>
                  )}
                </View>
              </Pressable>

              <View className="mt-3 flex-row items-center justify-end gap-2 border-t border-border/50 pt-3">
                <Pressable
                  onPress={() => toggle(item)}
                  className={`flex-row items-center gap-1.5 rounded-md border px-2.5 py-1.5 active:opacity-70 ${
                    item.alertEnabled ? 'border-signal-green/50 bg-signal-green/10' : 'border-border'
                  }`}
                >
                  <View className={`h-1.5 w-1.5 rounded-full ${item.alertEnabled ? 'bg-signal-green' : 'bg-text-muted'}`} />
                  <Text className={`font-mono text-[11px] ${item.alertEnabled ? 'text-signal-green' : 'text-text-muted'}`}>
                    {item.alertEnabled ? 'alerts on' : 'alerts off'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => remove(item)} className="rounded-md border border-border px-2.5 py-1.5 active:opacity-70">
                  <Text className="font-mono text-[11px] text-text-muted">remove</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
