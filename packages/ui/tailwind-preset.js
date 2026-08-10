/**
 * CommonJS Tailwind preset — required directly by tailwind.config.js in web + mobile.
 * Kept in plain JS so no TS loader is needed inside Tailwind config resolution.
 * Values mirror src/tokens.ts (the canonical TS source).
 */
const colors = {
  'jungle-black': '#0D0F0C',
  panel: '#141911',
  'panel-2': '#1B2117',
  border: '#2A3323',
  'border-glow': '#3D4A32',
  'solana-purple': '#9945FF',
  'solana-purple-dim': '#6B2FB3',
  'signal-green': '#14F195',
  'warning-amber': '#FFB020',
  'rug-red': '#FF3B5C',
  'banana-yellow': '#F5D547',
  'text-primary': '#E8F0E2',
  'text-secondary': '#9BA896',
  'text-muted': '#5F6B58',
  'text-inverse': '#0D0F0C',
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors,
      fontFamily: {
        display: ['Space Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'Courier New', 'monospace'],
      },
      borderRadius: { sm: '6px', md: '10px', lg: '16px', xl: '22px' },
      boxShadow: {
        'glow-purple': '0 0 20px rgba(153, 69, 255, 0.45), 0 0 40px rgba(153, 69, 255, 0.2)',
        'glow-green': '0 0 20px rgba(20, 241, 149, 0.45), 0 0 40px rgba(20, 241, 149, 0.2)',
        'glow-amber': '0 0 20px rgba(255, 176, 32, 0.45), 0 0 40px rgba(255, 176, 32, 0.2)',
        'glow-red': '0 0 20px rgba(255, 59, 92, 0.45), 0 0 40px rgba(255, 59, 92, 0.2)',
        'glow-banana': '0 0 24px rgba(245, 213, 71, 0.5), 0 0 48px rgba(245, 213, 71, 0.22)',
      },
      keyframes: {
        'cursor-blink': { '0%, 49%': { opacity: '1' }, '50%, 100%': { opacity: '0' } },
        'scan-line': { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(100%)' } },
        'pulse-glow': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
      },
      animation: {
        'cursor-blink': 'cursor-blink 1s step-end infinite',
        'scan-line': 'scan-line 2s linear infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
    },
  },
};
