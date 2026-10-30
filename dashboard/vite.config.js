import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/availability": "http://127.0.0.1:3001",
      "/availability-config": "http://127.0.0.1:3001",
      "/booking-events": "http://127.0.0.1:3001",
      "/campaigns": "http://127.0.0.1:3001",
      "/conversations": "http://127.0.0.1:3001",
      "/ghosting": "http://127.0.0.1:3001",
      "/ghosting-config": "http://127.0.0.1:3001",
      "/health": "http://127.0.0.1:3001",
      "/integrations": "http://127.0.0.1:3001",
      "/webhook": "http://127.0.0.1:3001",
      "/provider-booking": "http://127.0.0.1:3001",
      "/leads": "http://127.0.0.1:3001",
      "/scheduling-config": "http://127.0.0.1:3001",
      "/settings-config": "http://127.0.0.1:3001",
      "/test-chat": "http://127.0.0.1:3001",
    },
  },
})
