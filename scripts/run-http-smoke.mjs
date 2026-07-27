import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { spawn } from "node:child_process";

const port = 3101;
const baseUrl = `http://127.0.0.1:${port}`;
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const serviceAccount = {
  type: "service_account",
  project_id: "dados-fii-http-smoke",
  private_key_id: "http-smoke-only",
  private_key: privateKey,
  client_email: "http-smoke-only@dados-fii-http-smoke.iam.gserviceaccount.com",
  client_id: "000000000000000000000",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/http-smoke-only%40dados-fii-http-smoke.iam.gserviceaccount.com",
};
const environment = {
  ...process.env,
  FIREBASE_SERVICE_ACCOUNT_KEY: JSON.stringify(serviceAccount),
  CRON_SECRET: "http-smoke-cron-not-production",
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "dados-fii-http-smoke.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "dados-fii-http-smoke",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "dados-fii-http-smoke.appspot.com",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:000000000000:web:0000000000000000000000",
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "G-0000000000",
};

const server = spawn(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "start", "--", "--hostname", "127.0.0.1", "--port", String(port)],
  {
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  },
);
let diagnostics = "";
server.stdout.on("data", (chunk) => { diagnostics += chunk.toString(); });
server.stderr.on("data", (chunk) => { diagnostics += chunk.toString(); });

async function waitUntilReady() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Servidor encerrou antes do smoke.\n${diagnostics.slice(-4_000)}`);
    }
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // Inicialização ainda em andamento.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Servidor não ficou pronto em 30s.\n${diagnostics.slice(-4_000)}`);
}

async function json(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json();
  return { response, body };
}

try {
  await waitUntilReady();

  const home = await fetch(baseUrl, {
    headers: { "x-correlation-id": "corrective-http-smoke-20260727" },
  });
  assert.equal(home.status, 200);
  assert.equal(home.headers.get("x-correlation-id"), "corrective-http-smoke-20260727");
  assert.match(home.headers.get("content-security-policy") || "", /default-src 'self'/);
  assert.match(home.headers.get("strict-transport-security") || "", /max-age=/);
  assert.equal(home.headers.get("x-frame-options"), "DENY");
  assert.equal(home.headers.get("x-powered-by"), null);
  assert.match(home.headers.get("set-cookie") || "", /anonId=.*HttpOnly.*SameSite=Lax/i);

  const invalid = await json("/api/fii?ticker=ABC");
  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.body.code, "invalid_ticker");

  const duplicate = await json("/api/fii?ticker=TGAR11&ticker=MXRF11");
  assert.equal(duplicate.response.status, 400);
  assert.equal(duplicate.body.code, "duplicate_ticker");

  const premium = await json("/api/fii/TGAR11/report/premium");
  assert.equal(premium.response.status, 401);
  assert.equal(premium.body.ok, false);

  const adminMutation = await json("/api/admin/create-fii", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ticker: "TGAR11" }),
  });
  assert.equal(adminMutation.response.status, 401);

  const malformedAnonymousMutation = await json("/api/admin/create-fii", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  assert.equal(malformedAnonymousMutation.response.status, 401);

  const crossOriginSession = await json("/api/admin/session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://evil.example",
    },
    body: JSON.stringify({ action: "login", idToken: "invalid-test-token" }),
  });
  assert.equal(crossOriginSession.response.status, 403);

  const missingSessionToken = await json("/api/admin/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "login" }),
  });
  assert.equal(missingSessionToken.response.status, 400);

  const missingPage = await fetch(`${baseUrl}/recurso-que-nao-existe-corrective`);
  assert.equal(missingPage.status, 404);

  const forbiddenEvidenceMutation = await json("/api/system/risk-lab-cohort-backtest?action=run");
  assert.equal(forbiddenEvidenceMutation.response.status, 405);

  const disabledPremiumHealth = await json("/api/health/risk-lab-premium");
  assert.equal(disabledPremiumHealth.response.status, 503);

  const cron = await json("/api/cron/premium-peer-snapshot");
  assert.equal(cron.response.status, 401);

  console.log("HTTP smoke aprovado: 200/400/401/403/404/405/503 e headers defensivos.");
} finally {
  const signalServer = (signal) => {
    try {
      if (process.platform === "win32") server.kill(signal);
      else if (server.pid) process.kill(-server.pid, signal);
    } catch {
      // O processo já encerrou.
    }
  };
  signalServer("SIGTERM");
  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  signalServer("SIGKILL");
}
