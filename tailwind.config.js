/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
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
        carta: {
          mist: {
            300: '#CBD5E1',
            400: '#94A3B8',
            500: '#64748B',
            600: '#475569',
          },
          forest: {
            300: '#6EE7B7',
            400: '#34D399',
            500: '#10B981',
          },
          gold: {
            300: '#FCD34D',
            400: '#FBBF24',
            500: '#F59E0B',
            600: '#D97706',
          },
          deep: {
            700: '#334155',
            800: '#1E293B',
          },
          accent: {
            red: '#EF4444',
            azure: '#3A82F7', // Azure
            orange: '#F97316', // Orange
            cyan: '#06B6D4',  // Cam Böceği (Cyan)
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
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        }
      },
    },
  },
  plugins: [],
}

