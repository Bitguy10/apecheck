import { View, Text } from 'react-native';
import { BUY_SAFETY_DISCLAIMER } from '@apecheck/core';

/** Persistent, non-dismissible safety line shown near every buy action. */
export function SafetyDisclaimer() {
  return (
    <View className="mt-3 flex-row items-start gap-2 rounded-md border border-warning-amber/30 bg-warning-amber/5 px-3 py-2">
      <Text className="text-warning-amber">⚠️</Text>
      <Text className="flex-1 text-[11px] leading-snug text-warning-amber/90">{BUY_SAFETY_DISCLAIMER}</Text>
    </View>
  );
}
