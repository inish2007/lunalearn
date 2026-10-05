import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--canvas)',
        card: 'var(--card)',
        primary: 'var(--primary)',
        deep: 'var(--deep)',
        accent: 'var(--accent)',
        highlight: 'var(--highlight)',
        ink: 'var(--ink)',
        muted: 'var(--muted)'
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        float: 'var(--shadow-float)',
        lunar: '0 0 30px rgba(142, 114, 255, 0.2)'
      },
      borderRadius: {
        '4xl': '2rem'
      }
    }
  },
  plugins: []
};

export default config;
