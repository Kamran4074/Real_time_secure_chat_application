/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme')

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // brand = indigo; change here to re-theme the whole app
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
      },
      keyframes: {
        'slide-in': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': { from: { opacity: '0', transform: 'scale(.95) translateY(4px)' }, to: { opacity: '1', transform: 'scale(1) translateY(0)' } },
      },
      animation: {
        'slide-in': 'slide-in .2s ease-out',
        'slide-in-right': 'slide-in-right .2s ease-out',
        'fade-in': 'fade-in .15s ease-out',
        'pop-in': 'pop-in .18s ease-out',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15,23,42,.04), 0 12px 32px -8px rgba(15,23,42,.12)',
      },
    },
  },
}
