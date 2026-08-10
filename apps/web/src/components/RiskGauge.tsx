import { riskBands } from '@apecheck/ui/tokens';
import type { RiskBand } from '@apecheck/core';

interface RiskGaugeProps {
  score: number; // 0–100
  band: RiskBand;
  size?: number;
}

const BAND_COLOR: Record<RiskBand, string> = {
  low: riskBands.low.color,
  medium: riskBands.medium.color,
  high: riskBands.high.color,
};

/**
 * The signature ApeCheck element: a banana-shaped risk gauge that glows along its
 * arc (red → amber → green) with a small ape silhouette as the needle.
 * Higher score = needle swings right, toward the green (safe) end.
 */
export function RiskGauge({ score, band, size = 240 }: RiskGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const w = size;
  const h = size * 0.62;
  const cx = w / 2;
  const cy = h * 0.92;
  const r = w * 0.36;

  // score 0 → 180° (left), score 100 → 0° (right)
  const theta = (180 - (clamped / 100) * 180) * (Math.PI / 180);
  const needleLen = r * 0.82;
  const nx = cx + needleLen * Math.cos(theta);
  const ny = cy - needleLen * Math.sin(theta);

  const color = BAND_COLOR[band];

  // Arc path helper (semicircle track).
  const arc = (radius: number) =>
    `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`;

  return (
    <div className="flex flex-col items-center" style={{ width: w }}>
      <svg width={w} height={h + 10} viewBox={`0 0 ${w} ${h + 10}`} role="img" aria-label={`Risk score ${clamped} of 100`}>
        <defs>
          <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF3B5C" />
            <stop offset="50%" stopColor="#FFB020" />
            <stop offset="100%" stopColor="#14F195" />
          </linearGradient>
          <filter id="gauge-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track */}
        <path d={arc(r)} fill="none" stroke="#1B2117" strokeWidth={size * 0.09} strokeLinecap="round" />
        {/* Colored, glowing arc */}
        <path
          d={arc(r)}
          fill="none"
          stroke="url(#gauge-grad)"
          strokeWidth={size * 0.06}
          strokeLinecap="round"
          filter="url(#gauge-glow)"
          opacity={0.95}
        />

        {/* Needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth={size * 0.018} strokeLinecap="round" filter="url(#gauge-glow)" />
        <circle cx={cx} cy={cy} r={size * 0.03} fill={color} />
        {/* Ape needle head */}
        <text x={nx} y={ny} fontSize={size * 0.12} textAnchor="middle" dominantBaseline="central">
          🦍
        </text>

        {/* Score readout */}
        <text
          x={cx}
          y={cy - size * 0.02}
          textAnchor="middle"
          fontFamily="'Space Grotesk', sans-serif"
          fontWeight="700"
          fontSize={size * 0.2}
          fill={color}
        >
          {clamped}
        </text>
        <text x={cx} y={cy + size * 0.06} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize={size * 0.05} fill="#5F6B58">
          / 100
        </text>
      </svg>
    </div>
  );
}
