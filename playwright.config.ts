import { defineConfig, devices } from '@playwright/test';

// E2E config. Phase 6.8. Run with `npm run e2e`.
// Add specs under tests/e2e/.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        // Force demo mode (src/lib/is-demo.ts) so the suite is deterministic:
        // DEMO_PRODUCTS, no real database, identical behaviour locally and in
        // CI even when Supabase env vars are present in the shell. Runs
        // against a real backend go through PLAYWRIGHT_BASE_URL instead.
        env: {
          NEXT_PUBLIC_SUPABASE_URL: '',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
          SUPABASE_SERVICE_ROLE_KEY: '',
        },
      },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Add 'mobile-safari' / 'firefox' as needed.
  ],
});
