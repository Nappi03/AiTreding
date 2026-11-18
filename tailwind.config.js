/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bloomberg: {
          bg: '#070a0f',
          surface: '#0d131f',
          card: '#111827',
          border: '#1f293d',
          borderLight: '#2d3b55',
          amber: '#f59e0b',
          amberGlow: '#fbbf24',
          cyan: '#06b6d4',
          green: '#10b981',
          red: '#f43f5e',
          textMuted: '#94a3b8',
          textBright: '#f8fafc',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
