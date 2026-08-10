import { colors, fontStacks, radii } from './tokens';

/**
 * Tailwind preset shared by web (Tailwind) and mobile (NativeWind).
 * Both apps do `presets: [require('@apecheck/ui/tailwind-preset')]`.
 */
export const apecheckPreset = {
  theme: {
    extend: {
      colors: {
        'jungle-black': colors['jungle-black'],
        panel: colors['panel'],
        'panel-2': colors['panel-2'],
        border: colors['border'],
        'border-glow': colors['border-glow'],
        'solana-purple': colors['solana-purple'],
        'solana-purple-dim': colors['solana-purple-dim'],
        'signal-green': colors['signal-green'],
        'warning-amber': colors['warning-amber'],
        'rug-red': colors['rug-red'],
        'banana-yellow': colors['banana-yellow'],
        'text-primary': colors['text-primary'],
        'text-secondary': colors['text-secondary'],
        'text-muted': colors['text-muted'],
        'text-inverse': colors['text-inverse'],
      },
      fontFamily: {
        display: fontStacks.display.split(',').map((s) => s.trim().replace(/'/g, '')),
        body: fontStacks.body.split(',').map((s) => s.trim().replace(/'/g, '')),
        mono: fontStacks.mono.split(',').map((s) => s.trim().replace(/'/g, '')),
      },
      borderRadius: {
        sm: `${radii.sm}px`,
        md: `${radii.md}px`,
        lg: `${radii.lg}px`,
        xl: `${radii.xl}px`,
      },
      boxShadow: {
        'glow-purple': '0 0 20px rgba(153, 69, 255, 0.45), 0 0 40px rgba(153, 69, 255, 0.2)',
        'glow-green': '0 0 20px rgba(20, 241, 149, 0.45), 0 0 40px rgba(20, 241, 149, 0.2)',
        'glow-amber': '0 0 20px rgba(255, 176, 32, 0.45), 0 0 40px rgba(255, 176, 32, 0.2)',
        'glow-red': '0 0 20px rgba(255, 59, 92, 0.45), 0 0 40px rgba(255, 59, 92, 0.2)',
        'glow-banana': '0 0 24px rgba(245, 213, 71, 0.5), 0 0 48px rgba(245, 213, 71, 0.22)',
      },
      keyframes: {
        'cursor-blink': {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      animation: {
        'cursor-blink': 'cursor-blink 1s step-end infinite',
        'scan-line': 'scan-line 2s linear infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
    },
  },
};

export default apecheckPreset;
