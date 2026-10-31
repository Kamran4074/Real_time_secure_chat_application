import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import vercel from './vercel.json' with { type: 'json' }

// `vite preview` serves the build with the same security headers as Vercel (used by the E2E tests),
// with connect-src pointing at the local backend
const backend = process.env.VITE_BACKEND_URL || 'http://localhost:3000'
const previewHeaders = Object.fromEntries(vercel.headers[0].headers.map(({ key, value }) => [
  key,
  key === 'Content-Security-Policy'
    ? value.replace("connect-src 'self'", `connect-src 'self' ${backend} ${backend.replace(/^http/, 'ws')}`)
    : value,
]))

// The backend URL comes from VITE_BACKEND_URL (see .env.example), so no dev proxy is needed
export default defineConfig({
  plugins: [react()],
  preview: { headers: previewHeaders },
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
