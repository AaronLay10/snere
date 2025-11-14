import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Read port from environment variable, default to 3002 for production
const port = parseInt(process.env.PORT || '3002', 10)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port,
    host: '0.0.0.0', // Listen on all addresses including LAN
    strictPort: true,
    allowedHosts: [
      'localhost',
      'dev.sentientengine.ai',
      'sentientengine.ai',
      '192.168.2.3',
    ],
    hmr: {
      clientPort: 443,
    },
    watch: {
      usePolling: true, // Required for Docker
      interval: 1000,
    },
  },
  preview: {
    port,
    host: true, // Listen on all addresses
    strictPort: true,
  },
})
