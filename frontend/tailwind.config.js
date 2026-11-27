/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pastel: {
          bg: '#FAF8F5',
          card: '#FFFFFF',
          rose: '#FFF4F2',
          sage: '#F1F5F2',
          lavender: '#F4F1F9',
          peach: '#FFF6EE',
          text: '#2C303E',
          muted: '#525866',
          accentRose: '#E08E89',
          accentRoseText: '#9B3B36',
          accentRoseCta: '#B5433E',
          accentViolet: '#8B78E6',
          accentTeal: '#5A9E96',
          border: '#EFECE6',
          arenaDark: '#121622',
          arenaEditorGutter: '#181E2E'
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif']
      }
    },
  },
  plugins: [],
}
