/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        paragon: {
          primary: '#1b2d4f',
          accent: '#f97316',
          success: '#22c55e',
          warning: '#facc15',
          danger: '#ef4444'
        }
      }
    }
  },
  plugins: []
};
