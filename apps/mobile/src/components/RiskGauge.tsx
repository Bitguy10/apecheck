import { View, Text } from 'react-native';
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import type { RiskBand } from '@apecheck/core';
import { bandColor } from '../lib/theme';

/** The signature banana risk gauge, rendered with react-native-svg. */
export function RiskGauge({ score, band, size = 220 }: { score: number; band: RiskBand; size?: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const w = size;
  const h = size * 0.62;
  const cx = w / 2;
  const cy = h * 0.92;
  const r = w * 0.36;

  const theta = (180 - (clamped / 100) * 180) * (Math.PI / 180);
  const needleLen = r * 0.82;
  const nx = cx + needleLen * Math.cos(theta);
  const ny = cy - needleLen * Math.sin(theta);
  const color = bandColor(band);

  const arc = (radius: number) => `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`;

  return (
    <View style={{ width: w, alignItems: 'center' }}>
      <Svg width={w} height={h + 12} viewBox={`0 0 ${w} ${h + 12}`}>
        <Defs>
          <LinearGradient id="gauge" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#FF3B5C" />
            <Stop offset="50%" stopColor="#FFB020" />
            <Stop offset="100%" stopColor="#14F195" />
          </LinearGradient>
        </Defs>

        <Path d={arc(r)} fill="none" stroke="#1B2117" strokeWidth={size * 0.09} strokeLinecap="round" />
        <Path d={arc(r)} fill="none" stroke="url(#gauge)" strokeWidth={size * 0.06} strokeLinecap="round" />

        <Line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth={size * 0.018} strokeLinecap="round" />
        <Circle cx={cx} cy={cy} r={size * 0.03} fill={color} />
        <SvgText x={nx} y={ny} fontSize={size * 0.12} textAnchor="middle">
          🦍
        </SvgText>

        <SvgText x={cx} y={cy - size * 0.02} textAnchor="middle" fontWeight="700" fontSize={size * 0.2} fill={color}>
          {String(clamped)}
        </SvgText>
        <SvgText x={cx} y={cy + size * 0.06} textAnchor="middle" fontSize={size * 0.05} fill="#5F6B58">
          / 100
        </SvgText>
      </Svg>
      <Text className="mt-1 font-mono text-[10px] text-text-muted">higher = safer</Text>
    </View>
  );
}
