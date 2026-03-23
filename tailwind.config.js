/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        base: '#FAFAF7',
        moss: '#4A6741',
        ochre: '#C4893B',
        terracotta: '#B85C38',
        charcoal: '#2D2D2D',
        stone: '#8C8578',
        violet: '#7C5CBF',
        coral: '#E07A5F',
        'dark-base': '#1A1A18',
        'dark-surface': '#2A2A26',
      },
      fontFamily: {
        fraunces: ['Fraunces', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
