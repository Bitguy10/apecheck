import { View, Text } from 'react-native';
import { POTENTIAL_DISCLAIMER } from '@apecheck/core';
import type { RiskBand } from '@apecheck/core';
import { bandColor, bandBorderClass } from '../lib/theme';

/**
 * Risk + Potential as two SEPARATE badges, side by side — never merged.
 * That separation is a hard product requirement.
 */
export function ScoreBadges({
  riskScore,
  riskBand,
  riskBandLabel,
  potentialScore,
}: {
  riskScore: number;
  riskBand: RiskBand;
  riskBandLabel: string;
  potentialScore: number;
}) {
  const color = bandColor(riskBand);
  return (
    <View className="flex-row gap-3">
      {/* Risk */}
      <View className={`flex-1 rounded-lg border ${bandBorderClass[riskBand]} bg-panel-2 p-4`}>
        <Text className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Risk Score</Text>
        <View className="mt-1 flex-row items-end">
          <Text className="font-display text-4xl font-bold" style={{ color }}>
            {riskScore}
          </Text>
          <Text className="mb-1 ml-1 font-mono text-xs text-text-muted">/100</Text>
        </View>
        <Text className="mt-1 text-sm font-semibold" style={{ color }}>
          {riskBandLabel}
        </Text>
        <Text className="mt-1 text-[11px] text-text-secondary">higher = safer</Text>
      </View>

      {/* Potential */}
      <View className="flex-1 rounded-lg border border-solana-purple/40 bg-panel-2 p-4">
        <Text className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Potential</Text>
        <View className="mt-1 flex-row items-end">
          <Text className="font-display text-4xl font-bold text-solana-purple">{potentialScore}</Text>
          <Text className="mb-1 ml-1 font-mono text-xs text-text-muted">/100</Text>
        </View>
        <Text className="mt-1 text-sm font-semibold text-solana-purple">Upside Signal</Text>
        <Text className="mt-1 text-[11px] leading-tight text-text-secondary">{POTENTIAL_DISCLAIMER}</Text>
      </View>
    </View>
  );
}
