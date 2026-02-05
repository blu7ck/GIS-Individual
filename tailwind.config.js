/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        engineering: {
          bg: '#111315',
          panel: '#1A1D21',
          border: '#2A2E33',
          primary: '#3A82F7',
          warning: '#E3A008',
          error: '#E03131',
          text: {
            primary: '#FFFFFF',
            secondary: '#9CA3AF',
            muted: '#6B7280',
          }
        },
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      spacing: {
        '4.5': '1.125rem', // 18px
      },
      boxShadow: {
        'engineering': '0 1px 3px 0 rgba(0, 0, 0, 0.3)',
        'engineering-lg': '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
}

