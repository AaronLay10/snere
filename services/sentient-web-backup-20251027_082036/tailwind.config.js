/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Neural AI Theme - Cyberpunk aesthetics
        neural: {
          bg: '#0a0e1a',        // Deep space black
          surface: '#131829',   // Dark surface
          card: '#1a1f3a',      // Card background
          border: '#2d3655',    // Subtle borders

          // Cyan/Electric Blue (primary)
          primary: {
            50: '#e0f7ff',
            100: '#b3e9ff',
            200: '#80d9ff',
            300: '#4dc9ff',
            400: '#26baff',
            500: '#00abff',     // Main cyan
            600: '#0099e6',
            700: '#0082cc',
            800: '#006bb3',
            900: '#004d80',
          },

          // Electric Purple (accent)
          accent: {
            50: '#f3e5ff',
            100: '#d9b3ff',
            200: '#bf80ff',
            300: '#a64dff',
            400: '#8c1aff',
            500: '#7300e6',     // Electric purple
            600: '#6600cc',
            700: '#5900b3',
            800: '#4d0099',
            900: '#400080',
          },

          // Success/Active (green)
          success: {
            400: '#4ade80',
            500: '#22c55e',
            600: '#16a34a',
          },

          // Warning (amber)
          warning: {
            400: '#fbbf24',
            500: '#f59e0b',
            600: '#d97706',
          },

          // Error (red)
          error: {
            400: '#f87171',
            500: '#ef4444',
            600: '#dc2626',
          },
        },
      },
      backgroundImage: {
        'neural-gradient': 'linear-gradient(135deg, #0a0e1a 0%, #1a1f3a 100%)',
        'neural-card': 'linear-gradient(135deg, #131829 0%, #1a1f3a 100%)',
        'neural-glow': 'radial-gradient(circle at 50% 0%, rgba(0, 171, 255, 0.1) 0%, transparent 50%)',
        'neural-pulse': 'radial-gradient(circle, rgba(0, 171, 255, 0.4) 0%, rgba(0, 171, 255, 0) 70%)',
      },
      boxShadow: {
        'neural': '0 0 20px rgba(0, 171, 255, 0.3)',
        'neural-lg': '0 0 40px rgba(0, 171, 255, 0.5)',
        'neural-purple': '0 0 20px rgba(115, 0, 230, 0.3)',
        'neural-glow': '0 0 60px rgba(0, 171, 255, 0.6), 0 0 100px rgba(0, 171, 255, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'neural-flow': 'neuralFlow 4s linear infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': {
            boxShadow: '0 0 20px rgba(0, 171, 255, 0.3)',
            opacity: '1'
          },
          '50%': {
            boxShadow: '0 0 40px rgba(0, 171, 255, 0.6)',
            opacity: '0.9'
          },
        },
        neuralFlow: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '100% 50%' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
