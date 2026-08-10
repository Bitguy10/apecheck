import { View, Text } from 'react-native';
import type { ScoreBreakdownItem } from '@apecheck/core';

const STATUS: Record<ScoreBreakdownItem['status'], { icon: string; className: string }> = {
  pass: { icon: '✓', className: 'text-signal-green' },
  warn: { icon: '!', className: 'text-warning-amber' },
  fail: { icon: '✗', className: 'text-rug-red' },
  unknown: { icon: '?', className: 'text-text-muted' },
};

/** Terminal-log rendering of a score breakdown. */
export function BreakdownLog({
  title,
  items,
  accent = 'green',
}: {
  title: string;
  items: ScoreBreakdownItem[];
  accent?: 'green' | 'purple';
}) {
  const accentClass = accent === 'purple' ? 'text-solana-purple' : 'text-signal-green';
  return (
    <View className="overflow-hidden rounded-lg border border-border bg-panel/60">
      <View className="border-b border-border/60 px-4 py-2">
        <Text className={`font-mono text-[11px] uppercase tracking-widest ${accentClass}`}>{'> '}{title}</Text>
      </View>
      {items.map((item, i) => {
        const s = STATUS[item.status];
        return (
          <View
            key={item.key}
            className={`flex-row gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border/40' : ''}`}
          >
            <Text className={`font-mono text-sm font-bold ${s.className}`}>[{s.icon}]</Text>
            <View className="flex-1">
              <View className="flex-row items-baseline justify-between">
                <Text className="font-display text-sm font-semibold text-text-primary">{item.label}</Text>
                <Text className="font-mono text-xs text-text-muted">
                  <Text className={s.className}>{item.points}</Text>/{item.maxPoints}
                </Text>
              </View>
              <Text className="mt-0.5 text-xs leading-snug text-text-secondary">{item.detail}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
