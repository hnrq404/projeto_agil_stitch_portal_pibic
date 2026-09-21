/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7ff',
          600: '#0b5ed7',
          700: '#0a4fb5',
          900: '#0a2a5e',
        },
      },
    },
  },
  plugins: [],
};
