import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/availability": "http://localhost:3001",
      "/availability-config": "http://localhost:3001",
      "/booking-events": "http://localhost:3001",
      "/campaigns": "http://localhost:3001",
      "/conversations": "http://localhost:3001",
      "/ghosting": "http://localhost:3001",
      "/ghosting-config": "http://localhost:3001",
      "/health": "http://localhost:3001",
      "/integrations": "http://localhost:3001",
      "/webhook": "http://localhost:3001",
      "/provider-booking": "http://localhost:3001",
      "/leads": "http://localhost:3001",
      "/scheduling-config": "http://localhost:3001",
      "/settings-config": "http://localhost:3001",
      // Vite's string shorthand enables changeOrigin and rewrites Host to
      // localhost, breaking the desktop guard for a 127.0.0.1 browser origin.
      // Preserve the real browser Host; never synthesize auth/forwarded headers.
      "/test-chat": { target: "http://localhost:3001", changeOrigin: false },
    },
  },
})
