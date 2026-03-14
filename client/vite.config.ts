import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/stream': 'http://localhost:3000',
      '/units': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
})
