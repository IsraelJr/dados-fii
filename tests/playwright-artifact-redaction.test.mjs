import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { unzipSync, zipSync } from "fflate";

const execute = promisify(execFile);

function collectExpandedContent(bytes, output, depth = 0) {
  assert.ok(depth <= 8, "artefato sentinela excedeu a profundidade segura");
  const buffer = Buffer.from(bytes);
  output.push(buffer);
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) return;
  for (const entry of Object.values(unzipSync(buffer))) collectExpandedContent(entry, output, depth + 1);
}

async function collectFiles(directory, output) {
  for (const name of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, name.name);
    if (name.isDirectory()) await collectFiles(target, output);
    else collectExpandedContent(await readFile(target), output);
  }
}

test("redator elimina sentinelas de trace, network, HAR, cookies, headers e storage", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dados-fii-redaction-"));
  const resultDirectory = path.join(root, "test-results");
  await mkdir(resultDirectory);

  const sentinels = {
    email: ["qa", "artifact", "sentinel"].join(".") + "@example.test",
    password: ["Artifact", "Password", "987!"].join(""),
    bypass: ["vercel", "bypass", "sentinel"].join("-"),
    wallet: ["dynamic", "wallet", "session", "sentinel", "A1B2C3"].join("-"),
    cookie: ["dynamic", "cookie", "sentinel", "D4E5F6"].join("-"),
    jwt: [
      "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9",
      "eyJzdWIiOiJhcnRpZmFjdC1zZW50aW5lbCJ9",
      "signatureSentinel123456789",
    ].join("."),
  };

  const traceLines = [
    JSON.stringify({
      type: "before",
      params: { email: sentinels.email, password: sentinels.password },
      headers: { Authorization: `Bearer ${sentinels.jwt}`, "x-wallet-session": sentinels.wallet },
    }),
    JSON.stringify({
      type: "context-options",
      localStorage: [{ name: "dados-fii-wallet-session", value: sentinels.wallet }],
      cookies: [{ name: "qa-session", value: sentinels.cookie }],
    }),
  ].join("\n");
  const network = JSON.stringify({
    request: {
      headers: [
        { name: "Authorization", value: `Bearer ${sentinels.jwt}` },
        { name: "x-wallet-session", value: sentinels.wallet },
        { name: "Cookie", value: `qa=${sentinels.cookie}` },
      ],
    },
  });
  const har = JSON.stringify({
    log: {
      entries: [{
        request: {
          headers: [{ name: "x-wallet-session", value: sentinels.wallet }],
          cookies: [{ name: "qa", value: sentinels.cookie }],
        },
      }],
    },
  });
  const nested = zipSync({
    "storage-state.json": Buffer.from(JSON.stringify({
      origins: [{ origin: "https://example.test", localStorage: [{ name: "token", value: sentinels.wallet }] }],
    })),
  });
  const traceArchive = zipSync({
    "trace.trace": Buffer.from(traceLines),
    "trace.network": Buffer.from(network),
    "artifact.har": Buffer.from(har),
    "nested.zip": nested,
  });

  await writeFile(path.join(resultDirectory, "trace.zip"), traceArchive);
  await writeFile(
    path.join(resultDirectory, "runtime-evidence.json"),
    JSON.stringify({
      Authorization: `Bearer ${sentinels.jwt}`,
      "x-wallet-session": sentinels.wallet,
      cookie: sentinels.cookie,
      password: sentinels.password,
      email: sentinels.email,
      bypass: sentinels.bypass,
    }),
  );

  await execute(process.execPath, ["scripts/redact-playwright-artifacts.mjs", resultDirectory], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      E2E_USER_EMAIL: sentinels.email,
      E2E_USER_PASSWORD: sentinels.password,
      VERCEL_AUTOMATION_BYPASS_SECRET: sentinels.bypass,
    },
  });

  const expanded = [];
  await collectFiles(resultDirectory, expanded);
  const allContent = Buffer.concat(expanded).toString("utf8");
  for (const [kind, sentinel] of Object.entries(sentinels)) {
    assert.equal(allContent.includes(sentinel), false, `sentinela ${kind} permaneceu após a redação`);
  }
  assert.match(allContent, /\[REDACTED(?:_EMAIL|_TOKEN)?\]/);
});
