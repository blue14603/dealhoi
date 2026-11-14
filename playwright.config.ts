import { defineConfig, devices } from "@playwright/test";
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD_HASH, E2E_DATABASE_URL } from "./tests/e2e/env";

const PORT = 3100;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? (process.env.CI ? undefined : "/opt/pw-browsers/chromium");

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: { baseURL: `http://localhost:${PORT}`, launchOptions: executablePath ? { executablePath } : {} },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: [
    { command: "node tests/e2e/mock-openai.mjs", url: "http://localhost:4010", reuseExistingServer: false },
    {
      // Requires a prior `npm run build`.
      command: `npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}/phuong-phap`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        DEALHOI_DEMO_DATA: "true",
        OPENAI_API_KEY: "mock-key",
        OPENAI_BASE_URL: "http://localhost:4010/v1",
        AI_RATE_LIMIT_PER_MINUTE: "100",
        ADMIN_AUTH_PROVIDER: "env",
        ADMIN_EMAIL: E2E_ADMIN_EMAIL,
        ADMIN_PASSWORD_HASH: E2E_ADMIN_PASSWORD_HASH,
        ADMIN_SESSION_SECRET: "e2e-session-secret-that-is-long-enough-123",
      },
    },
  ],
});
