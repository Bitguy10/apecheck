import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import type { WatchlistItem } from '@apecheck/core';
import { useAuth } from '../context/AuthContext';
import { isWatched, addWatch, removeWatch, setAlertEnabled } from '../lib/data';

/** Add/remove watch + dev-dump alert toggle. Prompts sign-in when logged out. */
export function WatchToggle({ tokenAddress, onNeedAuth }: { tokenAddress: string; onNeedAuth: () => void }) {
  const { session } = useAuth();
  const [item, setItem] = useState<WatchlistItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    if (!session) {
      setReady(true);
      return;
    }
    isWatched(tokenAddress).then((w) => {
      if (active) {
        setItem(w);
        setReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, [tokenAddress, session]);

  async function toggleWatch() {
    if (!session) return onNeedAuth();
    if (busy) return;
    setBusy(true);
    try {
      if (item) {
        await removeWatch(item.id);
        setItem(null);
      } else {
        setItem(await addWatch(tokenAddress));
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  async function toggleAlert() {
    if (!item || busy) return;
    const next = !item.alertEnabled;
    setItem({ ...item, alertEnabled: next });
    setBusy(true);
    try {
      await setAlertEnabled(item.id, next);
    } catch {
      setItem({ ...item, alertEnabled: !next });
    } finally {
      setBusy(false);
    }
  }

  if (session && !ready) {
    return <View className="h-12 rounded-lg border border-border bg-panel-2" />;
  }

  return (
    <View className="flex-row items-center gap-2">
      <Pressable
        onPress={toggleWatch}
        disabled={busy}
        className={`flex-1 rounded-lg border py-3 active:opacity-80 ${
          item ? 'border-banana-yellow/60 bg-banana-yellow/10' : 'border-border bg-panel-2'
        }`}
      >
        <Text className={`text-center font-display text-sm font-bold ${item ? 'text-banana-yellow' : 'text-text-primary'}`}>
          {item ? '★ Watching' : '☆ Add to watchlist'}
        </Text>
      </Pressable>
      {item && (
        <Pressable
          onPress={toggleAlert}
          disabled={busy}
          className={`rounded-lg border px-3 py-3 active:opacity-80 ${
            item.alertEnabled ? 'border-signal-green/50 bg-signal-green/10' : 'border-border bg-panel'
          }`}
        >
          <Text className={`text-sm font-semibold ${item.alertEnabled ? 'text-signal-green' : 'text-text-muted'}`}>
            {item.alertEnabled ? '🔔' : '🔕'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
