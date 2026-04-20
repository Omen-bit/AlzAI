/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          blue: '#2563EB',
        },
        status: {
          green: {
            bg: '#D1FAE5',
            text: '#065F46',
            dot: '#10B981',
          },
          amber: {
            bg: '#FEF3C7',
            text: '#92400E',
            dot: '#F59E0B',
          },
          red: {
            bg: '#FEE2E2',
            text: '#991B1B',
            dot: '#EF4444',
          }
        },
        figma: {
          bg: '#F8F9FA',
          border: '#E5E7EB',
          text: {
            primary: '#111827',
            secondary: '#6B7280',
            muted: '#9CA3AF',
          }
        }
      },
      borderRadius: {
        'figma': '12px',
      }
    },
  },
  plugins: [],
}
