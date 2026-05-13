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
      "/leads": "http://localhost:3001",
      "/scheduling-config": "http://localhost:3001",
      "/settings-config": "http://localhost:3001",
      "/test-chat": "http://localhost:3001",
    },
  },
})
