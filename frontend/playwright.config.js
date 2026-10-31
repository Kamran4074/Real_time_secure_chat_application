import { defineConfig, devices } from '@playwright/test';

// End-to-end tests: a real browser drives the real frontend + backend (in-memory MongoDB).
// Run with: npm run test:e2e   (first time: npx playwright install chromium)
const API_PORT = 3100;
const WEB_PORT = 4173;

export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: `http://localhost:${WEB_PORT}`,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: [
        {
            command: 'npm run e2e:server',
            cwd: '../backend',
            url: `http://localhost:${API_PORT}/api/health`,
            env: { PORT: String(API_PORT), CLIENT_ORIGINS: `http://localhost:${WEB_PORT}` },
            reuseExistingServer: !process.env.CI,
            timeout: 120000,
        },
        {
            command: `npx vite --port ${WEB_PORT} --strictPort`,
            url: `http://localhost:${WEB_PORT}`,
            env: { VITE_BACKEND_URL: `http://localhost:${API_PORT}` },
            reuseExistingServer: !process.env.CI,
            timeout: 60000,
        },
    ],
});
