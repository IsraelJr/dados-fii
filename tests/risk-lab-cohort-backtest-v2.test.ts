import assert from "node:assert/strict";
import test from "node:test";
import {
  RISK_LAB_COHORT_BACKTEST_RUN_ID,
  RiskLabCohortBacktestV2Service,
} from "../src/lib/risk-lab/RiskLabCohortBacktestV2Service";
import { derivePrimaryStressTruth } from "../src/lib/risk-lab/CohortPrimaryVerificationService";
import type { PublicFundData } from "../src/types/regulatory";
import type {
  AutomaticCreditEventScreen,
  AutomaticDocumentEvidence,
  AutomaticMonthlySeries,
  AutomaticSourceSummary,
} from "../src/types/riskLabAutomatic";
import type { RiskLabCohortBacktestEvidence } from "../src/types/riskLabCohortBacktest";
import type { VerifiedDividendNotice } from "../src/types/riskLabDividendStress";

const HASH = "a".repeat(64);
const PROTOCOL_HASH = "b".repeat(64);
const ORIGINAL_ENV = {
  VERCEL_ENV: process.env.VERCEL_ENV,
  VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
};

process.env.VERCEL_ENV = "production";
process.env.VERCEL_GIT_COMMIT_SHA = "2".repeat(40);
process.env.VERCEL_PROJECT_PRODUCTION_URL = "dadosfii.com.br";

test.after(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

class MemoryStore {
  values = new Map<string, RiskLabCohortBacktestEvidence>();
  latestValue: RiskLabCohortBacktestEvidence | null = null;
  attempts: RiskLabCohortBacktestEvidence[] = [];
  locked = false;

  async get(runId: string) {
    return structuredClone(this.values.get(runId) || null);
  }

  async latest() {
    return structuredClone(this.latestValue);
  }

  async acquireLock() {
    if (this.locked) return false;
    this.locked = true;
    return true;
  }

  async releaseLock() {
    this.locked = false;
  }

  async save(evidence: RiskLabCohortBacktestEvidence) {
    const copy = structuredClone(evidence);
    this.values.set(evidence.runId, copy);
    this.latestValue = copy;
    if (evidence.status !== "running") this.attempts.push(copy);
    return structuredClone(copy);
  }
}

function observation(ticker: string, year: number, month: number, amount: number): VerifiedDividendNotice {
  const competenceMonth = `${year}-${String(month).padStart(2, "0")}`;
  return {
    ticker,
    competenceMonth,
    amountPerShare: amount,
    announcedAt: `${year}-${String(month).padStart(2, "0")}-15T18:00:00-03:00`,
    source: {
      documentId: `inf_mensal_fii_${year}:${competenceMonth}:v1`,
      sourceUrl: `https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_${year}.zip`,
      sourceType: "primary_regulatory",
      reviewMethod: "automatic_regulatory_validation",
      reviewedBy: "risk-lab-cvm-monthly-bulk-v0.1.0",
      reviewedAt: "2026-07-20T12:00:00-03:00",
      page: 1,
      excerpt: `Informe mensal oficial ${competenceMonth}.`,
      sourceHash: HASH,
      sourceVersion: `inf_mensal_fii_${year}.zip:v1`,
      protocolHash: PROTOCOL_HASH,
      protocolVersion: 1,
    },
  };
}

function seriesFor(ticker: string, mode: "healthy" | "stress", year = 2024): AutomaticMonthlySeries {
  const amounts = mode === "healthy"
    ? Array(12).fill(1)
    : [1, 1, 1, 1, 1, 1, 0.75, 0.75, 0.75, 1, 1, 1];
  const observations = amounts.map((amount, index) => observation(ticker, year, index + 1, amount));
  return {
    status: "ready",
    observations,
    sources: [],
    missingMonths: [],
    conflicts: [],
    longestContiguousSequence: 12,
    method: "official_monthly_liability_per_share",
    detectorResult: null,
    detectorExecuted: true,
    classificationFinal: false,
    limitation: "material_credit_events_not_automatically_validated",
  };
}

function source(year: number, fetched = true): AutomaticSourceSummary {
  return {
    year,
    sourceUrl: `https://dados.cvm.gov.br/dados/FI/DOC/EVENTUAL/DADOS/eventual_fi_${year}.csv`,
    sourceHash: fetched ? HASH : null,
    fetched,
    matchingRows: 10,
    acceptedDocuments: 10,
    rejectedRows: 0,
    error: fetched ? null : "indisponível",
  };
}

function eventDocument(year: number): AutomaticDocumentEvidence {
  return {
    documentId: `${year}9001`,
    documentType: "Fato Relevante - Inadimplência material",
    fileName: "fato-relevante.html",
    competenceDate: `${year}-06-30`,
    receivedAt: `${year}-07-10T18:00:00-03:00`,
    link: "https://dados.cvm.gov.br/documento.html",
    sourceYear: year,
    auditResult: "OK",
    confidence: 99,
  };
}

function noEvent(from: string, until: string): AutomaticCreditEventScreen {
  return {
    status: "no_explicit_event_found",
    relevantFrom: from,
    relevantUntil: until,
    inspectedDocuments: 0,
    sourceCoverageComplete: true,
    matches: [],
    verifiedEvents: [],
    ambiguousDocuments: [],
    summary: "Nenhum evento explícito.",
    classificationFinal: false,
  };
}

function materialEvent(ticker: string, year: number, from: string, until: string): AutomaticCreditEventScreen {
  const documentId = `${year}9001`;
  const knownAt = `${year}-07-10T18:00:00-03:00`;
  return {
    status: "material_event_confirmed",
    relevantFrom: from,
    relevantUntil: until,
    inspectedDocuments: 1,
    sourceCoverageComplete: true,
    matches: [{
      documentId,
      sourceUrl: "https://dados.cvm.gov.br/documento.html",
      knownAt,
      eventType: "default",
      matchedTerm: "INADIMPLENCIA",
      matchedIn: "metadata",
      confidence: 99,
    }],
    verifiedEvents: [{
      ticker,
      knownAt,
      type: "default",
      documentId,
      sourceUrl: "https://dados.cvm.gov.br/documento.html",
      reviewedBy: "risk-lab-credit-screen-v0.1.0",
      reviewedAt: "2026-07-20T12:00:00-03:00",
    }],
    ambiguousDocuments: [],
    summary: "Evento material confirmado.",
    classificationFinal: true,
  };
}

interface FixtureOptions {
  missingSourceYear?: number;
  severeWithoutPriorSignal?: boolean;
  healthyStressTicker?: string;
}

interface MonthlyBuildCall {
  ticker: string;
  cnpj: string;
  years: number[];
  fromDate: string;
  untilDate: string;
}

function serviceFor(options: FixtureOptions = {}) {
  const store = new MemoryStore();
  let currentTicker = "";
  const monthlyBuildCalls: MonthlyBuildCall[] = [];
  const service = new RiskLabCohortBacktestV2Service({
    store,
    now: () => new Date("2026-07-20T12:00:00-03:00"),
    resolveFund: async (ticker) => {
      currentTicker = ticker;
      return { cnpj: "12345678000199", name: ticker } as unknown as PublicFundData;
    },
    discovery: {
      discover: async (_cnpj, years) => ({
        documents: years.includes(2024) && (currentTicker === "DEVA11" || currentTicker === "VSLH11")
          ? [eventDocument(2024)]
          : [],
        sources: years.map((year) => source(year, year !== options.missingSourceYear)),
        issues: [],
      }),
    },
    dividendSeries: {
      build: async (ticker, cnpj, years, fromDate, untilDate) => {
        monthlyBuildCalls.push({ ticker, cnpj, years: [...years], fromDate, untilDate });
        const healthyStress = ticker === options.healthyStressTicker;
        const reversible = ticker === "MCCI11" || ticker === "RBRY11";
        const severe = ticker === "DEVA11" || ticker === "VSLH11";
        const mode = healthyStress || reversible || (severe && !options.severeWithoutPriorSignal) ? "stress" : "healthy";
        return seriesFor(ticker, mode, severe ? 2023 : 2024);
      },
    },
    creditScreen: {
      screen: async (ticker, _documents, _sources, from, until) => {
        const year = Number(from.slice(0, 4));
        return (ticker === "DEVA11" || ticker === "VSLH11") && year === 2024
          ? materialEvent(ticker, year, from, until)
          : noEvent(from, until);
      },
    },
  });
  return { service, store, monthlyBuildCalls };
}

test("referência primária deriva estresse e recuperação sem chamar o detector sequencial", () => {
  const truth = derivePrimaryStressTruth(seriesFor("MCCI11", "stress").observations);
  assert.equal(truth.stressAt, "2024-09-15T18:00:00-03:00");
  assert.equal(truth.recoveryAt, "2024-12-15T18:00:00-03:00");
});

test("v2 usa lote mensal CVM com CNPJ, anos e janela congelada para os seis casos", async () => {
  const { service, monthlyBuildCalls } = serviceFor();
  const evidence = await service.run();

  assert.equal(evidence.schemaVersion, 2);
  assert.equal(evidence.runId, RISK_LAB_COHORT_BACKTEST_RUN_ID);
  assert.equal(evidence.status, "passed");
  assert.equal(evidence.sourceExecutionAllowed, true);
  assert.equal(evidence.executionAllowed, true);
  assert.equal(evidence.cases.length, 6);
  assert.equal(evidence.cases.every((item) => item.groundTruth?.status === "verified"), true);
  assert.equal(evidence.metrics.conclusiveCases, 6);
  assert.equal(evidence.metrics.coveragePercent, 100);
  assert.equal(evidence.metrics.falsePositives, 0);
  assert.equal(evidence.metrics.inconclusiveCases, 0);
  assert.equal(evidence.blockers.length, 0);
  assert.match(evidence.attemptId || "", /^risk-lab-3-5-attempt-/);
  assert.match(evidence.evidenceHash || "", /^[a-f0-9]{64}$/);
  assert.equal(monthlyBuildCalls.length, 6);
  assert.equal(monthlyBuildCalls.every((call) => call.cnpj === "12345678000199"), true);
  assert.equal(monthlyBuildCalls.every((call) => call.years.length > 0), true);
  assert.equal(monthlyBuildCalls.every((call) => /^20\d{2}-\d{2}-\d{2}$/.test(call.fromDate)), true);
  assert.equal(monthlyBuildCalls.every((call) => /^20\d{2}-\d{2}-\d{2}$/.test(call.untilDate)), true);
  assert.equal(evidence.cases.every((item) => item.evidence
    .filter((entry) => entry.kind === "dividend_notice")
    .every((entry) => entry.sourceVersion.startsWith("inf_mensal_fii_"))), true);
});

test("falso negativo grave é medido para a Sprint 3.6 sem maquiar nem bloquear a coleta", async () => {
  const { service } = serviceFor({ severeWithoutPriorSignal: true });
  const evidence = await service.run();
  const deva = evidence.cases.find((item) => item.ticker === "DEVA11");

  assert.equal(evidence.status, "passed");
  assert.equal(evidence.performanceReviewRequired, true);
  assert.equal(evidence.metrics.falseNegatives, 2);
  assert.equal(evidence.blockers.length, 0);
  assert.equal(deva?.outcome, "false_negative");
  assert.equal(deva?.firstSignalAt, null);
  assert.equal(deva?.leadTimeDays, null);
  assert.equal(deva?.structuredBlockers?.[0]?.code, "NO_SIGNAL_BEFORE_MATERIAL_EVENT");
});

test("fonte anual ausente impede autorização primária e detector do caso", async () => {
  const { service } = serviceFor({ missingSourceYear: 2023 });
  const evidence = await service.run();
  const affected = evidence.cases.filter((item) => item.groundTruth?.status === "blocked");

  assert.equal(evidence.status, "failed");
  assert.equal(evidence.sourceExecutionAllowed, false);
  assert.equal(evidence.executionAllowed, false);
  assert.ok(affected.length > 0);
  assert.equal(affected.every((item) => item.detectorStatus === null), true);
  assert.ok(evidence.structuredBlockers?.some((item) => item.code === "PRIMARY_SOURCE_YEAR_UNAVAILABLE"));
  assert.equal(evidence.checks.find((item) => item.id === "verification.primary-authorized")?.status, "failed");
});

test("sinal injustificado em controle saudável continua bloqueando a Sprint", async () => {
  const { service } = serviceFor({ healthyStressTicker: "KNCR11" });
  const evidence = await service.run();

  assert.equal(evidence.status, "failed");
  assert.equal(evidence.metrics.falsePositives, 1);
  assert.equal(evidence.cases.find((item) => item.ticker === "KNCR11")?.outcome, "false_positive");
  assert.ok(evidence.blockers.some((item) => item.includes("UNJUSTIFIED_CONTROL_SIGNAL")));
});

test("cada reexecução reprovada recebe tentativa imutável e encadeia o hash anterior", async () => {
  const { service, store } = serviceFor({ missingSourceYear: 2023 });
  const first = await service.run();
  const second = await service.run();

  assert.notEqual(first.attemptId, second.attemptId);
  assert.equal(second.previousEvidenceHash, first.evidenceHash);
  assert.equal(store.attempts.length, 2);
  assert.equal(store.attempts[0].evidenceHash, first.evidenceHash);
  assert.equal(store.attempts[1].evidenceHash, second.evidenceHash);
});
