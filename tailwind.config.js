/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}', './services/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        deep: {
          900: '#0B1120',
          800: '#151E32',
          700: '#2A3B55',
        }
      }
    },
  },
  plugins: [],
}
