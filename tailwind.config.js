/** @type {import('tailwindcss').Config} */
const tailwindConfig = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
    './state/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#121316',
        foreground: '#F4F4F5',
        brand: {
          DEFAULT: '#2CB7A5',
          dark: '#24998A',
          light: 'rgba(44, 183, 165, 0.15)',
        },
        surface: {
          DEFAULT: '#18191D',
          card: '#141414',
          raised: '#1F2025',
          border: 'rgba(255, 255, 255, 0.1)',
        },
        ink: '#16241F',
        paper: '#EFF1E4',
        paperRaised: '#FFFFFF',
        flare: '#2CB7A5',
        flareDark: '#24998A',
        rust: '#EF4444',
        moss: '#2CB7A5',
        mossLight: 'rgba(44, 183, 165, 0.2)',
      },
      fontFamily: {
        display: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        body: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      borderRadius: {
        stamp: '4px',
        premium: '1rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};

export default tailwindConfig;
