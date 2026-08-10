import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { isValidSolanaAddress, normalizeAddress } from '@apecheck/core';
import { C } from '../lib/theme';

/** Terminal-style paste-address input. Calls onScan with a validated address. */
export function SearchBar({ onScan, busy }: { onScan: (address: string) => void; busy?: boolean }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function paste() {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setValue(text.trim());
      setError(null);
    }
  }

  function submit() {
    const addr = normalizeAddress(value);
    if (!isValidSolanaAddress(addr)) {
      setError('That doesn’t look like a valid Solana address.');
      return;
    }
    setError(null);
    onScan(addr);
  }

  return (
    <View>
      <View className="rounded-xl border border-border bg-panel-2 p-3">
        <View className="flex-row items-center">
          <Text className="mr-2 font-mono text-signal-green">{'>'}</Text>
          <TextInput
            value={value}
            onChangeText={(t) => {
              setValue(t);
              setError(null);
            }}
            placeholder="paste token address…"
            placeholderTextColor={C['text-muted']}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            onSubmitEditing={submit}
            returnKeyType="search"
            className="flex-1 font-mono text-sm text-text-primary"
          />
          <Pressable onPress={paste} className="ml-2 rounded-md border border-border px-2 py-1 active:opacity-70">
            <Text className="font-mono text-[11px] text-text-secondary">paste</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={submit}
        disabled={busy}
        className="mt-3 flex-row items-center justify-center rounded-xl bg-signal-green py-3.5 active:opacity-90 disabled:opacity-60"
      >
        {busy ? (
          <ActivityIndicator color={C['jungle-black']} />
        ) : (
          <Text className="font-display text-base font-bold text-jungle-black">🦍 Scan for rugs</Text>
        )}
      </Pressable>

      {error && <Text className="mt-2 text-center text-xs text-rug-red">{error}</Text>}
    </View>
  );
}
