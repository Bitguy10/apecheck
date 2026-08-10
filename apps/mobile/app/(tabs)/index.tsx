import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { shortenAddress, timeAgo } from '@apecheck/core';
import { SearchBar } from '../../src/components/SearchBar';
import { AuthSheet } from '../../src/components/AuthSheet';
import { useAuth } from '../../src/context/AuthContext';
import { getRecentScans, type RecentScan } from '../../src/lib/recent-scans';
import { bandTextClass } from '../../src/lib/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { email, signOut } = useAuth();
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const [authOpen, setAuthOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getRecentScans().then(setRecent);
    }, []),
  );

  return (
    <ScrollView className="flex-1 bg-jungle-black" contentContainerClassName="p-4 pb-16">
      {/* Account row */}
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5 rounded-full border border-border bg-panel px-3 py-1">
          <View className="h-1.5 w-1.5 rounded-full bg-signal-green" />
          <Text className="font-mono text-[11px] text-text-secondary">scan before you ape</Text>
        </View>
        {email ? (
          <Pressable onPress={signOut} className="rounded-md border border-border px-2.5 py-1.5 active:opacity-70">
            <Text className="font-mono text-[11px] text-text-secondary">{email.split('@')[0].slice(0, 8)} · out</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setAuthOpen(true)}
            className="rounded-md border border-signal-green/40 bg-signal-green/10 px-2.5 py-1.5 active:opacity-70"
          >
            <Text className="font-mono text-[11px] text-signal-green">sign in</Text>
          </Pressable>
        )}
      </View>

      {/* Hero */}
      <View className="mb-6 mt-2">
        <Text className="font-display text-4xl font-bold text-text-primary">
          Don’t get <Text className="text-rug-red">rugged</Text>.
        </Text>
        <Text className="mt-2 text-sm text-text-secondary">
          Paste a fresh token’s contract address for an instant rug-risk read: authorities, LP lock, dev holdings,
          holders, socials — and where to buy.
        </Text>
      </View>

      {/* Search */}
      <SearchBar onScan={(addr) => router.push(`/token/${addr}`)} />

      {/* Recent scans */}
      <Text className="mb-2 mt-8 font-mono text-xs uppercase tracking-widest text-text-muted">recent scans</Text>
      {recent.length === 0 ? (
        <View className="rounded-lg border border-dashed border-border bg-panel/40 p-6">
          <Text className="text-center font-mono text-xs text-text-muted">{'>'} no recent scans yet. paste an address above.</Text>
        </View>
      ) : (
        <View className="overflow-hidden rounded-lg border border-border bg-panel/60">
          {recent.map((s, i) => (
            <Pressable
              key={s.tokenAddress}
              onPress={() => router.push(`/token/${s.tokenAddress}`)}
              className={`flex-row items-center justify-between px-4 py-3 active:bg-panel-2 ${i > 0 ? 'border-t border-border/60' : ''}`}
            >
              <View className="flex-1">
                <Text className="font-display text-sm font-semibold text-text-primary" numberOfLines={1}>
                  {s.name || 'Unknown'} {s.symbol ? <Text className="text-text-muted">${s.symbol}</Text> : null}
                </Text>
                <Text className="font-mono text-[11px] text-text-muted">{shortenAddress(s.tokenAddress, 6, 6)}</Text>
              </View>
              <View className="items-end">
                <Text className={`font-display text-lg font-bold ${bandTextClass[s.riskBand] ?? 'text-text-secondary'}`}>
                  {s.riskScore}
                </Text>
                <Text className="font-mono text-[10px] text-text-muted">{timeAgo(s.scannedAt, Date.now())}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <AuthSheet visible={authOpen} onClose={() => setAuthOpen(false)} />
    </ScrollView>
  );
}
