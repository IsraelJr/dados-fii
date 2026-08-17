import assert from "node:assert/strict";
import test from "node:test";
import type {
  PortfolioIncrementalComparison,
} from "../src/lib/portfolio-intelligence/PortfolioIntelligenceIncremental";
import type {
  PortfolioIncrementalAnalysisResult,
} from "../src/lib/portfolio-intelligence/PortfolioIntelligenceIncrementalService";
import {
  buildDeterministicPortfolioIncrementalExplanation,
} from "../src/lib/portfolio-intelligence/PortfolioIntelligenceIncrementalExplanation";
import { PortfolioIncrementalRateLimitError } from "../src/lib/security/PortfolioIncrementalRateLimit";
import {
  createPortfolioIncrementalAnalysisHandler,
  createPortfolioIncrementalAvailabilityHandler,
  createPortfolioIncrementalExplanationHandler,
} from "../src/server/controllers/PortfolioIncrementalControllerCore";

const fingerprint = "a".repeat(64);
const previousFingerprint = "b".repeat(64);
const comparisonId = "d".repeat(64);

function request(body: unknown, options: Readonly<{ origin?: string | null }> = {}) {
  const headers = new Headers({
    "content-type": "application/json",
    host: "preview.example.test",
  });
  if (options.origin !== null) headers.set("origin", options.origin ?? "https://preview.example.test");
  return new Request("https://preview.example.test/api/portfolio/incremental-analysis", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function body(response: Response) {
  return await response.json() as Record<string, unknown>;
}

function reference(value: string) {
  return {
    schemaVersion: 2,
    fingerprint: value,
    dataFingerprint: value,
    policyFingerprint: "c".repeat(64),
    domainVersion: "2.0.0",
    policyVersion: "1.0.0",
    generatedAt: "2026-08-10T12:00:00.000Z",
    asOf: "2026-08-10T12:00:00.000Z",
    signals: [],
    metrics: {
      latestClosedCompetence: "2026-07",
      latestIncome: 100,
      blockVariationPercent: 0,
      sixMonthCoefficientOfVariationPercent: 0,
      largestPositionSharePercent: 40,
      topThreeSharePercent: 80,
      patrimonyHhi: 2500,
      largestIncomeContributorTicker: null,
      largestIncomeContributorSharePercent: 40,
      estimatedIncomeTotal: 100,
      patrimonyCoveragePercent: 100,
      segmentCoveragePercent: 100,
      incomeCoveragePercent: 100,
      monthsAvailable: 6,
    },
    quality: {
      state: "sufficient",
      reasonCodes: [],
      warningCodes: [],
      warnings: [],
      confidence: { trend: "high", concentration: "high", segments: "high", income: "high" },
      pricedPositionCount: 2,
      unpricedPositionCount: 0,
      knownSegmentPositionCount: 2,
      incomeKnownPositionCount: 2,
      monthsRequired: 6,
    },
  } as const;
}

function changedComparison(): PortfolioIncrementalComparison {
  const previous = reference(previousFingerprint);
  const current = reference(fingerprint);
  const change = {
    id: "data:LATEST_INCOME_CHANGED:aggravated",
    category: "data",
    state: "aggravated",
    code: "LATEST_INCOME_CHANGED",
    title: "A renda do último mês fechado mudou",
    summary: "A renda do último mês encerrado variou além da política de materialidade.",
    material: true,
    before: 110,
    after: 100,
    evidence: {
      previousAsOf: previous.asOf,
      currentAsOf: current.asOf,
      previousFingerprint: previous.fingerprint,
      currentFingerprint: current.fingerprint,
      threshold: "3% relativos",
    },
  } as const;
  return {
    schemaVersion: 2,
    policyVersion: "2.0.0",
    comparisonId,
    status: "changed",
    previous,
    current,
    changes: [change],
    materialChanges: [change],
    unchangedSignalCodes: [],
    summary: {
      materialChangeCount: 1,
      totalChangeCount: 1,
      unchangedSignalCount: 0,
      message: "Uma mudança material desde a análise anterior.",
    },
  } as PortfolioIncrementalComparison;
}

function analysisDependencies(overrides: Partial<Parameters<typeof createPortfolioIncrementalAnalysisHandler>[0]> = {}) {
  const output = {
    comparison: changedComparison(),
    persistence: { stored: true, baselineState: "found" },
  } as PortfolioIncrementalAnalysisResult;
  return {
    enabled: () => true,
    sameOrigin: () => true,
    resolveIdentity: async () => ({ ownerId: "owner-a" }),
    compareAndStore: async () => output,
    ...overrides,
  };
}

test("disponibilidade expõe somente o estado da flag e falha fechada", async () => {
  const enabled = createPortfolioIncrementalAvailabilityHandler({ enabled: () => true });
  const enabledResponse = enabled();
  assert.equal(enabledResponse.status, 204);
  assert.equal(await enabledResponse.text(), "");
  assert.equal(enabledResponse.headers.get("cache-control"), "private, no-store, max-age=0");

  const disabledHandler = createPortfolioIncrementalAvailabilityHandler({ enabled: () => false });
  const disabledResponse = disabledHandler();
  assert.equal(disabledResponse.status, 404);
  assert.deepEqual(await body(disabledResponse), {
    ok: false,
    code: "PORTFOLIO_INCREMENTAL_DISABLED",
    error: "Relatório incremental temporariamente indisponível.",
  });
});

test("análise falha antes de auth quando flag está desligada ou origem ausente", async () => {
  let authCalls = 0;
  const resolveIdentity = async () => {
    authCalls += 1;
    return { ownerId: "owner-a" };
  };
  const disabled = createPortfolioIncrementalAnalysisHandler(analysisDependencies({
    enabled: () => false,
    resolveIdentity,
  }));
  const disabledResponse = await disabled(request({ portfolioId: "default" }));
  assert.equal(disabledResponse.status, 404);

  const noOrigin = createPortfolioIncrementalAnalysisHandler(analysisDependencies({
    sameOrigin: () => false,
    resolveIdentity,
  }));
  const noOriginResponse = await noOrigin(request({ portfolioId: "default" }, { origin: null }));
  assert.equal(noOriginResponse.status, 403);
  assert.equal(authCalls, 0);
});

test("análise exige sessão e jamais encaminha resultado forjado do cliente", async () => {
  const unauthorized = createPortfolioIncrementalAnalysisHandler(analysisDependencies({
    resolveIdentity: async () => {
      throw { code: "WALLET_SESSION_REQUIRED", status: 401 };
    },
  }));
  const unauthorizedResponse = await unauthorized(request({ portfolioId: "default" }));
  assert.equal(unauthorizedResponse.status, 401);

  let serviceCalls = 0;
  const handler = createPortfolioIncrementalAnalysisHandler(analysisDependencies({
    compareAndStore: async () => {
      serviceCalls += 1;
      throw new Error("must-not-run");
    },
  }));
  const forged = await handler(request({ portfolioId: "default", result: { signals: [] } }));
  assert.equal(forged.status, 400);
  assert.equal(serviceCalls, 0);
});

test("análise autorizada envia somente ownerId e carteira default ao serviço canônico", async () => {
  let received: unknown;
  const expected = analysisDependencies().compareAndStore;
  const handler = createPortfolioIncrementalAnalysisHandler(analysisDependencies({
    compareAndStore: async (input) => {
      received = input;
      return expected(input);
    },
  }));
  const response = await handler(request({ portfolioId: "default" }));
  assert.equal(response.status, 201);
  assert.deepEqual(received, { ownerId: "owner-a", portfolioId: "default" });
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
});

function explanationDependencies(
  overrides: Partial<Parameters<typeof createPortfolioIncrementalExplanationHandler>[0]> = {},
) {
  return {
    enabled: () => true,
    sameOrigin: () => true,
    resolveIdentity: async () => ({ ownerId: "owner-a" }),
    consumeRateLimit: async () => undefined,
    loadComparison: async () => changedComparison(),
    generate: async (input: Parameters<typeof buildDeterministicPortfolioIncrementalExplanation>[0]) => (
      buildDeterministicPortfolioIncrementalExplanation(input)
    ),
    fallback: buildDeterministicPortfolioIncrementalExplanation,
    ...overrides,
  };
}

test("explicação reconstrói comparação no servidor e rejeita fingerprint obsoleto", async () => {
  let loadInput: unknown;
  const handler = createPortfolioIncrementalExplanationHandler(explanationDependencies({
    loadComparison: async (input) => {
      loadInput = input;
      return changedComparison();
    },
  }));
  const stale = await handler(request({
    portfolioId: "default",
    currentFingerprint: "e".repeat(64),
    comparisonId,
  }));
  assert.equal(stale.status, 409);
  assert.deepEqual(loadInput, {
    ownerId: "owner-a",
    portfolioId: "default",
    currentFingerprint: "e".repeat(64),
    comparisonId,
  });

  const forged = await handler(request({
    portfolioId: "default",
    currentFingerprint: fingerprint,
    comparisonId,
    comparison: {},
  }));
  assert.equal(forged.status, 400);
});

test("explicação aplica rate limit distribuído fail-closed antes de ler referência", async () => {
  let loaded = false;
  const handler = createPortfolioIncrementalExplanationHandler(explanationDependencies({
    consumeRateLimit: async () => {
      throw new PortfolioIncrementalRateLimitError("PORTFOLIO_INCREMENTAL_RATE_LIMIT_UNAVAILABLE", 503);
    },
    loadComparison: async () => {
      loaded = true;
      return changedComparison();
    },
  }));
  const response = await handler(request({ portfolioId: "default", currentFingerprint: fingerprint, comparisonId }));
  assert.equal(response.status, 503);
  assert.equal(loaded, false);
});

test("explicação usa fallback determinístico em falha do provedor sem vazar erro", async () => {
  const handler = createPortfolioIncrementalExplanationHandler(explanationDependencies({
    generate: async () => {
      throw new Error("provider-secret-error");
    },
  }));
  const response = await handler(request({ portfolioId: "default", currentFingerprint: fingerprint, comparisonId }));
  const payload = await body(response);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-dados-fii-ai-fallback"), "1");
  assert.equal(payload.degraded, true);
  assert.doesNotMatch(JSON.stringify(payload), /provider-secret-error/);
});
