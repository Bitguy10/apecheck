const preset = require('@apecheck/ui/tailwind-preset');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [preset],
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: { extend: {} },
  plugins: [],
};
