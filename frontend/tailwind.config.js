/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#0a0a12',
          panel: '#0f0f1b',
          card: '#13132a',
          border: '#1e1e3a',
          accent: '#00d4ff',
          green: '#00e676',
          red: '#ff5252',
          orange: '#ff9100',
          yellow: '#ffd740',
          muted: '#6b6b80',
          text: '#d4d4e8',
          dim: '#8a8aa8',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
