/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Sentient brand colors
        sentient: {
          cyan: '#00ffff',
          magenta: '#ff00ff',
          yellow: '#ffff00',
          green: '#00ff00',
          dark: '#0a0a0a',
          darker: '#050505',
        },
        // Neural theme
        neural: {
          glow: 'rgba(0, 255, 255, 0.2)',
          border: 'rgba(0, 255, 255, 0.3)',
          bg: 'rgba(10, 10, 10, 0.95)',
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 0deg, var(--tw-gradient-stops))',
        'neural-gradient': 'linear-gradient(135deg, rgba(10, 10, 10, 0.95) 0%, rgba(20, 20, 20, 0.95) 100%)',
      },
      boxShadow: {
        'neural': '0 0 30px rgba(0, 255, 255, 0.2)',
        'neural-strong': '0 0 50px rgba(0, 255, 255, 0.4)',
        'glow-cyan': '0 0 20px rgba(0, 255, 255, 0.5)',
        'glow-magenta': '0 0 20px rgba(255, 0, 255, 0.5)',
      },
      animation: {
        'gradient-slide': 'gradient-slide 4s ease-in-out infinite',
        'neural-pulse': 'neural-pulse 2s ease-in-out infinite',
        'scan-line': 'scan-vertical 8s linear infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        'gradient-slide': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'neural-pulse': {
          '0%, 100%': { transform: 'scale(1)', filter: 'brightness(1)' },
          '50%': { transform: 'scale(1.05)', filter: 'brightness(1.2)' },
        },
        'scan-vertical': {
          '0%': { top: '0%' },
          '100%': { top: '100%' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
}
