/**
 * ApeCheck Design Tokens — single source of truth for web (Tailwind) + mobile (NativeWind).
 * Dark, degen/crypto-native aesthetic. Neon glow, meme energy.
 */

export const colors = {
  // Base
  'jungle-black': '#0D0F0C', // base background
  'jungle-black-soft': '#14181300', // transparent variant helper
  'panel': '#141911', // slightly raised surfaces
  'panel-2': '#1B2117', // cards / inputs
  'border': '#2A3323', // subtle borders
  'border-glow': '#3D4A32',

  // Brand / accents
  'solana-purple': '#9945FF', // primary accent (Solana tie-in)
  'solana-purple-dim': '#6B2FB3',
  'signal-green': '#14F195', // safe / verified states ONLY
  'warning-amber': '#FFB020', // medium-risk state
  'rug-red': '#FF3B5C', // high-risk state (used sparingly)
  'banana-yellow': '#F5D547', // signature element accent ONLY

  // Text
  'text-primary': '#E8F0E2',
  'text-secondary': '#9BA896',
  'text-muted': '#5F6B58',
  'text-inverse': '#0D0F0C',
} as const;

/** Risk band colors keyed to score ranges. */
export const riskBands = {
  low: { color: colors['signal-green'], label: 'Low Risk', min: 80, max: 100 },
  medium: { color: colors['warning-amber'], label: 'Medium Risk', min: 50, max: 79 },
  high: { color: colors['rug-red'], label: 'High Risk / Likely Rug', min: 0, max: 49 },
} as const;

export const fonts = {
  display: 'Space Grotesk', // bold headings
  body: 'Inter', // body copy
  mono: 'JetBrains Mono', // data / addresses
} as const;

/** Font family stacks with fallbacks (web). */
export const fontStacks = {
  display: `'Space Grotesk', ui-sans-serif, system-ui, sans-serif`,
  body: `'Inter', ui-sans-serif, system-ui, sans-serif`,
  mono: `'JetBrains Mono', ui-monospace, 'Courier New', monospace`,
} as const;

export const fontSizes = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 38,
  '5xl': 48,
  '6xl': 64,
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

export const radii = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 16,
  xl: 22,
  full: 9999,
} as const;

/** Neon glow shadows (web box-shadow strings). Moderate — soft accent, not a halo. */
export const glows = {
  purple: `0 0 12px rgba(153, 69, 255, 0.25), 0 0 24px rgba(153, 69, 255, 0.1)`,
  green: `0 0 12px rgba(20, 241, 149, 0.25), 0 0 24px rgba(20, 241, 149, 0.1)`,
  amber: `0 0 12px rgba(255, 176, 32, 0.25), 0 0 24px rgba(255, 176, 32, 0.1)`,
  red: `0 0 12px rgba(255, 59, 92, 0.25), 0 0 24px rgba(255, 59, 92, 0.1)`,
  banana: `0 0 14px rgba(245, 213, 71, 0.28), 0 0 28px rgba(245, 213, 71, 0.12)`,
} as const;

export type ColorToken = keyof typeof colors;
export type RiskBandKey = keyof typeof riskBands;
