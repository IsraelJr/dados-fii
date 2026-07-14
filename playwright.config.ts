import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.E2E_BASE_URL?.trim();
const vercelBypassToken = process.env.E2E_VERCEL_BYPASS_TOKEN?.trim();

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 10 * 60 * 1000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "test-results/phase1-results.json" }],
  ],
  use: {
    baseURL: externalBaseUrl || "http://127.0.0.1:3000",
    extraHTTPHeaders: vercelBypassToken
      ? {
          "x-vercel-protection-bypass": vercelBypassToken,
          "x-vercel-set-bypass-cookie": "true",
        }
      : undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: false,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "npm run dev",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  outputDir: "test-results/artifacts",
});
