import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// /api calls go to the Express server, so no CORS setup is needed.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:5000' } },
})
