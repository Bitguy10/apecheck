import { colors, riskBands } from '@apecheck/ui/tokens';
import type { RiskBand } from '@apecheck/core';

/** Flat color access for inline styles / SVG (NativeWind classes cover most cases). */
export const C = colors;

export const bandColor = (band: RiskBand): string => riskBands[band].color;

/** Tailwind text-color class for a risk band. */
export const bandTextClass: Record<RiskBand, string> = {
  low: 'text-signal-green',
  medium: 'text-warning-amber',
  high: 'text-rug-red',
};

export const bandBorderClass: Record<RiskBand, string> = {
  low: 'border-signal-green/50',
  medium: 'border-warning-amber/50',
  high: 'border-rug-red/50',
};

/** Tone → text color class for stats. */
export const toneClass = {
  default: 'text-text-primary',
  good: 'text-signal-green',
  warn: 'text-warning-amber',
  bad: 'text-rug-red',
} as const;
