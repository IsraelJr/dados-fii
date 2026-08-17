import assert from "node:assert/strict";
import test from "node:test";
import {
  PortfolioIncrementalRequestError,
  readPortfolioIncrementalExplanationIntent,
  readPortfolioIncrementalIntent,
} from "../src/lib/security/PortfolioIncrementalRequestPolicy";
import { isStrictSameOrigin } from "../src/lib/security/SameOriginPolicy";

const fingerprint = "a".repeat(64);
const comparisonId = "b".repeat(64);

function request(
  body: unknown,
  options: Readonly<{
    origin?: string | null;
    host?: string;
    forwardedHost?: string;
    forwardedProto?: string;
    contentType?: string;
    contentLength?: string;
  }> = {},
) {
  const headers = new Headers();
  if (options.origin !== null) headers.set("origin", options.origin ?? "https://preview.example.test");
  headers.set("host", options.host ?? "preview.example.test");
  if (options.forwardedHost) headers.set("x-forwarded-host", options.forwardedHost);
  if (options.forwardedProto) headers.set("x-forwarded-proto", options.forwardedProto);
  if (options.contentType !== "missing") {
    headers.set("content-type", options.contentType ?? "application/json; charset=utf-8");
  }
  if (options.contentLength) headers.set("content-length", options.contentLength);
  return new Request("https://preview.example.test/api/portfolio/incremental-analysis", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function rejectsWithCode(
  operation: Promise<unknown>,
  code: PortfolioIncrementalRequestError["code"],
) {
  await assert.rejects(operation, (error: unknown) => (
    error instanceof PortfolioIncrementalRequestError && error.code === code
  ));
}

test("origem estrita exige Origin e corresponde a host e protocolo efetivos", () => {
  assert.equal(isStrictSameOrigin(request({ portfolioId: "default" })), true);
  assert.equal(isStrictSameOrigin(request({}, { origin: null })), false);
  assert.equal(isStrictSameOrigin(request({}, { origin: "null" })), false);
  assert.equal(isStrictSameOrigin(request({}, { origin: "https://attacker.example" })), false);
  assert.equal(isStrictSameOrigin(request({}, {
    origin: "https://dados-fii-preview.vercel.app",
    forwardedHost: "dados-fii-preview.vercel.app",
    forwardedProto: "https",
  })), true);
  assert.equal(isStrictSameOrigin(request({}, {
    origin: "http://localhost:3000",
    host: "localhost:3000",
    forwardedProto: "http",
  })), true);
});

test("origem estrita rejeita credenciais, caminho, query, fragmento e protocolo inesperado", () => {
  for (const origin of [
    "https://user:pass@preview.example.test",
    "https://preview.example.test/path",
    "https://preview.example.test?query=1",
    "https://preview.example.test#fragment",
    "ftp://preview.example.test",
  ]) {
    assert.equal(isStrictSameOrigin(request({}, { origin })), false, origin);
  }
});

test("análise aceita exclusivamente a intenção canônica mínima", async () => {
  assert.deepEqual(await readPortfolioIncrementalIntent(request({ portfolioId: "default" })), {
    portfolioId: "default",
  });
  for (const body of [
    {},
    { portfolioId: "other" },
    { portfolioId: "default", result: {} },
    { portfolioId: "default", signals: [] },
    { portfolioId: "default", metrics: {} },
    { portfolioId: "default", positions: [] },
  ]) {
    await rejectsWithCode(
      readPortfolioIncrementalIntent(request(body)),
      "PORTFOLIO_INCREMENTAL_INVALID_INTENT",
    );
  }
});

test("explicação aceita somente portfolioId e fingerprint SHA-256 verificável", async () => {
  assert.deepEqual(await readPortfolioIncrementalExplanationIntent(request({
    portfolioId: "default",
    currentFingerprint: fingerprint,
    comparisonId,
  })), { portfolioId: "default", currentFingerprint: fingerprint, comparisonId });

  for (const body of [
    { portfolioId: "default" },
    { portfolioId: "default", currentFingerprint: "abc", comparisonId },
    { portfolioId: "default", currentFingerprint: fingerprint.toUpperCase(), comparisonId },
    { portfolioId: "default", currentFingerprint: fingerprint, comparisonId: "abc" },
    { portfolioId: "default", currentFingerprint: fingerprint, comparisonId, comparison: {} },
    { portfolioId: "default", currentFingerprint: fingerprint, comparisonId, narrative: "compre" },
  ]) {
    await rejectsWithCode(
      readPortfolioIncrementalExplanationIntent(request(body)),
      "PORTFOLIO_INCREMENTAL_INVALID_INTENT",
    );
  }
});

test("payload falha fechado por Content-Type, tamanho declarado e tamanho real", async () => {
  await rejectsWithCode(
    readPortfolioIncrementalIntent(request({ portfolioId: "default" }, { contentType: "text/plain" })),
    "PORTFOLIO_INCREMENTAL_INVALID_CONTENT_TYPE",
  );
  await rejectsWithCode(
    readPortfolioIncrementalIntent(request({ portfolioId: "default" }, { contentLength: "999999" })),
    "PORTFOLIO_INCREMENTAL_PAYLOAD_TOO_LARGE",
  );
  await rejectsWithCode(
    readPortfolioIncrementalIntent(request({ portfolioId: "default" }, {}), 4),
    "PORTFOLIO_INCREMENTAL_PAYLOAD_TOO_LARGE",
  );
});

test("payload em chunks sem Content-Length é interrompido ao ultrapassar o limite", async () => {
  let cancelled = false;
  const encoder = new TextEncoder();
  const chunks = [
    encoder.encode('{"portfolioId":"default","padding":"'),
    encoder.encode("x".repeat(128)),
    encoder.encode('"}'),
  ];
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = chunks.shift();
      if (next) controller.enqueue(next);
      else controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  const streamingRequest = new Request(
    "https://preview.example.test/api/portfolio/incremental-analysis",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://preview.example.test",
        host: "preview.example.test",
      },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" },
  );

  await rejectsWithCode(
    readPortfolioIncrementalIntent(streamingRequest, 64),
    "PORTFOLIO_INCREMENTAL_PAYLOAD_TOO_LARGE",
  );
  assert.equal(cancelled, true);
});
