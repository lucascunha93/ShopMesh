import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Fraunces', 'serif'],
      },
      colors: {
        ink: '#173d35',
        moss: '#456b5a',
        leaf: '#c8d85b',
        coral: '#d96c4f',
        paper: '#f7f8f3',
        mist: '#e8eee8',
      },
    },
  },
  plugins: [],
} satisfies Config;
