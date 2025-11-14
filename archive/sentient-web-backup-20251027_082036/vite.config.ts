import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    host: true, // Listen on all addresses including LAN
    strictPort: true,
    hmr: {
      host: 'sentientengine.ai',
      protocol: 'wss',
    },
  },
  preview: {
    port: 3002,
    host: true, // Listen on all addresses
    strictPort: true,
  },
})
