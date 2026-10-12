import { defineConfig, devices } from "@playwright/test";

/**
 * Browser E2E against the REAL backend (FastAPI + Postgres) with offline fixture providers. See docs/E2E.md.
 *
 * Three stacks are started (and their databases re-seeded) by the webServer entries below:
 *   personal:         backend :8000 / db e2e_personal    / DATA_PROFILE=personal            / frontend :8080  (prices, charts, financials, news on)
 *   public:           backend :8001 / db e2e_public      / DATA_PROFILE=public              / frontend :8081  (production default: ALL sources off)
 *   public-news-only: backend :8002 / db e2e_public_news / DATA_PROFILE=public ENABLE_NEWS  / frontend :8082  (headlines only, no excerpts)
 * The frontend is the Vite dev server, or with E2E_BUILD=1 (npm run e2e:prod) `vite preview` of the production build served
 * with the security headers + CSP from vercel.json.
 * Hosts are `localhost` (not 127.0.0.1) because the backend allow-lists the exact Origin http://localhost:<port>.
 */
const START = "bash e2e/support/start-backend.sh";
const PERSONAL = "http://localhost:8080";
const PUBLIC = "http://localhost:8081";
const NEWS = "http://localhost:8082";
const PROD = !!process.env.E2E_BUILD;
const frontend = (port: number, backend: number) => ({
  command: `npx vite ${PROD ? "preview" : ""} --port ${port} --strictPort`,
  env: { VITE_DEV_PROXY_TARGET: `http://127.0.0.1:${backend}` },
  url: `http://127.0.0.1:${port}`,
  timeout: 120_000,
  reuseExistingServer: !!process.env.E2E_REUSE_SERVERS,
});

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0, // a retry would hide flakiness; the suite is expected to be deterministic
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 4,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: "personal-desktop",
      testIgnore: /public(-news)?\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, baseURL: PERSONAL },
    },
    {
      name: "personal-mobile",
      // Everything user-visible except the cross-user API probing (isolation) and the guard meta-tests.
      testMatch: /(auth|company|watchlists|research|copilot|quality)\.spec\.ts/,
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, baseURL: PERSONAL, defaultBrowserType: "chromium" },
    },
    {
      name: "public-desktop",
      testMatch: /public\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, baseURL: PUBLIC },
    },
    {
      name: "public-mobile",
      testMatch: /public\.spec\.ts/,
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, baseURL: PUBLIC, defaultBrowserType: "chromium" },
    },
    {
      name: "public-news-desktop",
      testMatch: /public-news\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, baseURL: NEWS },
    },
    {
      name: "public-news-mobile",
      testMatch: /public-news\.spec\.ts/,
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, baseURL: NEWS, defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      command: `${START} 8000 e2e_personal personal ${PERSONAL}`,
      url: "http://127.0.0.1:8000/health",
      timeout: 240_000,
      reuseExistingServer: !!process.env.E2E_REUSE_SERVERS,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `${START} 8001 e2e_public public ${PUBLIC}`,
      url: "http://127.0.0.1:8001/health",
      timeout: 240_000,
      reuseExistingServer: !!process.env.E2E_REUSE_SERVERS,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `${START} 8002 e2e_public_news public ${NEWS} news`,
      url: "http://127.0.0.1:8002/health",
      timeout: 240_000,
      reuseExistingServer: !!process.env.E2E_REUSE_SERVERS,
      stdout: "pipe",
      stderr: "pipe",
    },
    frontend(8080, 8000),
    frontend(8081, 8001),
    frontend(8082, 8002),
  ],
});
