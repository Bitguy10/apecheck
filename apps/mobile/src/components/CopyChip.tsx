import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { shortenAddress } from '@apecheck/core';

/** Tap-to-copy contract address chip. */
export function CopyChip({ value, display }: { value: string; display?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <Pressable
      onPress={copy}
      className="flex-row items-center gap-1.5 self-start rounded-md border border-border bg-panel px-2 py-1 active:opacity-70"
    >
      <Text className="font-mono text-xs text-text-secondary">{display ?? shortenAddress(value, 5, 5)}</Text>
      <Text className={`font-mono text-xs ${copied ? 'text-signal-green' : 'text-text-muted'}`}>
        {copied ? '✓ copied' : '⧉'}
      </Text>
    </Pressable>
  );
}
