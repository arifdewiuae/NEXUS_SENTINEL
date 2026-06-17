import { defineConfig, devices } from '@playwright/test';

// Dedicated, uncommon ports so the e2e never collides with other local dev
// servers (or a default :3000). Override via env if needed.
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3701);
const API_PORT = Number(process.env.E2E_API_PORT ?? 3700);
const API_URL = `http://localhost:${API_PORT}`;

/**
 * End-to-end against the real dashboard + real API wired to the fake adapters
 * (`PROVIDER=fake`) — no AWS, fully deterministic. Playwright boots both servers.
 * The API runs the compiled build (fast, reliable startup); the web runs `next dev`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'list' : 'html',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @nexus/api build && pnpm --filter @nexus/api start',
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        PROVIDER: 'fake',
        PORT: String(API_PORT),
        LOG_LEVEL: 'silent',
        RATE_LIMIT_LIMIT: '100000',
        CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
      },
    },
    {
      command: `pnpm --filter @nexus/web exec next dev -p ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: { NEXT_PUBLIC_API_URL: API_URL },
    },
  ],
});
