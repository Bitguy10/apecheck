import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { AlertItem } from '@apecheck/core';
import { shortenAddress, timeAgo } from '@apecheck/core';
import { useAuth } from '../../src/context/AuthContext';
import { getAlerts } from '../../src/lib/data';
import { AuthSheet } from '../../src/components/AuthSheet';
import { C } from '../../src/lib/theme';

const ALERT_META: Record<string, { icon: string; label: string }> = {
  dev_dump: { icon: '🚨', label: 'Dev wallet dump' },
  lp_pull: { icon: '🚨', label: 'Liquidity pulled' },
  authority_reenabled: { icon: '🚨', label: 'Authority re-enabled' },
  price_drop: { icon: '📉', label: 'Big price drop' },
  big_holder_sell: { icon: '🐋', label: 'Whale sell-off' },
};

export default function AlertsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const load = useCallback(async () => {
    if (!session) {
      setAlerts([]);
      setLoading(false);
      return;
    }
    try {
      setAlerts(await getAlerts());
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

  if (!session && !loading) {
    return (
      <View className="flex-1 items-center justify-center bg-jungle-black p-8">
        <Text className="text-3xl">🔒</Text>
        <Text className="mt-2 font-display text-lg font-bold text-text-primary">Sign in to see alerts</Text>
        <Text className="mt-1 text-center text-sm text-text-secondary">Alerts are tied to your account.</Text>
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
      <Text className="mb-4 font-mono text-[11px] text-text-muted">rug &amp; dump notifications, newest first</Text>

      {alerts.length === 0 && !loading ? (
        <View className="rounded-lg border border-dashed border-border bg-panel/40 p-8">
          <Text className="text-center text-3xl">🔕</Text>
          <Text className="mt-2 text-center font-display text-lg font-bold text-text-primary">No alerts yet — good news</Text>
          <Text className="mt-1 text-center text-sm text-text-secondary">
            When a watched token rugs — dev dump, LP pull, authority flip, price crash or a whale sell — it’ll show up here and push to your device.
          </Text>
        </View>
      ) : (
        <View className="gap-2">
          {alerts.map((a) => {
            const meta = ALERT_META[a.alertType] ?? { icon: '🚨', label: 'Alert' };
            const title = a.title || meta.label;
            const body =
              a.body || (a.percentDropped != null ? `Dev dumped ${a.percentDropped.toFixed(1)}% of holdings.` : '');
            return (
              <Pressable
                key={a.id}
                onPress={() => router.push(`/token/${a.tokenAddress}`)}
                className="rounded-lg border border-rug-red/30 bg-rug-red/5 p-4 active:opacity-70"
              >
                <View className="flex-row items-start gap-2">
                  <Text className="text-base leading-none">{meta.icon}</Text>
                  <View className="flex-1">
                    <Text className="font-display text-sm font-bold text-rug-red">{title}</Text>
                    {body ? <Text className="mt-0.5 text-xs text-text-secondary">{body}</Text> : null}
                    <Text className="mt-1 font-mono text-[11px] text-text-muted">
                      {shortenAddress(a.tokenAddress, 6, 6)} · {timeAgo(a.triggeredAt, Date.now())}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
