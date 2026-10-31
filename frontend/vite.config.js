import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The backend URL comes from VITE_BACKEND_URL (see .env.example), so no dev proxy is needed
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/test/**', 'src/main.jsx'],
      // npm run test:coverage fails if coverage drops below these numbers
      thresholds: { statements: 40, branches: 35, functions: 40, lines: 40 },
    },
  },
})
