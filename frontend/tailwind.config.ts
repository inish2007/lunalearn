import type { Config } from 'tailwindcss';
const config: Config = { content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'], theme: { extend: { colors: { canvas: '#F8F7FF', card: '#FFFFFF', primary: '#6C4CE8', deep: '#4B2DB8', accent: '#A78BFA', highlight: '#D8CCFF', ink: '#1F1733', muted: '#6F6680' }, boxShadow: { soft: '0 12px 32px rgba(75,45,184,.08)', float: '0 18px 45px rgba(75,45,184,.15)' }, borderRadius: { '4xl': '2rem' } } }, plugins: [] };
export default config;
