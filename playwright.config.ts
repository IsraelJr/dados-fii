import { generateKeyPairSync } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const buildOnlyServiceAccount = JSON.stringify({
  type: "service_account",
  project_id: "dados-fii-e2e",
  private_key_id: "e2e-only",
  private_key: privateKey,
  client_email: "e2e-only@dados-fii-e2e.iam.gserviceaccount.com",
  client_id: "000000000000000000000",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/e2e-only%40dados-fii-e2e.iam.gserviceaccount.com",
});

const port = 3100;
const localBaseURL = `http://127.0.0.1:${port}`;
const configuredBaseURL = process.env.E2E_BASE_URL?.trim();
const baseURL = configuredBaseURL || localBaseURL;
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
const isRemoteRun = Boolean(configuredBaseURL);

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL,
    extraHTTPHeaders: bypassSecret
      ? {
          "x-vercel-protection-bypass": bypassSecret,
          "x-vercel-set-bypass-cookie": "true",
        }
      : undefined,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "off",
    video: "retain-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 13"] } },
  ],
  webServer: isRemoteRun ? undefined : {
    command: process.env.CI
      ? `npm run start -- --hostname 127.0.0.1 --port ${port}`
      : `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: localBaseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      FIREBASE_SERVICE_ACCOUNT_KEY: buildOnlyServiceAccount,
      CRON_SECRET: "e2e-cron-secret-not-production",
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "dados-fii-e2e.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "dados-fii-e2e",
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "dados-fii-e2e.appspot.com",
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
      NEXT_PUBLIC_FIREBASE_APP_ID: "1:000000000000:web:0000000000000000000000",
      NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "G-0000000000",
    },
  },
});
