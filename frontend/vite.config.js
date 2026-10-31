import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The backend URL comes from VITE_BACKEND_URL (see .env.example), so no dev proxy is needed
export default defineConfig({
  plugins: [react()],
})
