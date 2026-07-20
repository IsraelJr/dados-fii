import assert from "node:assert/strict";
import test from "node:test";
import { RiskLabCohortBacktestService } from "../src/lib/risk-lab/RiskLabCohortBacktestService";
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
process.env.VERCEL_GIT_COMMIT_SHA = "1".repeat(40);
process.env.VERCEL_PROJECT_PRODUCTION_URL = "dadosfii.com.br";

test.after(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

class MemoryStore {
  value: RiskLabCohortBacktestEvidence | null = null;
  locked = false;

  async get() {
    return this.value;
  }

  async latest() {
    return this.value;
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
    this.value = structuredClone(evidence);
    return structuredClone(evidence);
  }
}

function observation(ticker: string, month: number, amount: number, announcedYear = 2024): VerifiedDividendNotice {
  const competenceMonth = `${announcedYear}-${String(month).padStart(2, "0")}`;
  return {
    ticker,
    competenceMonth,
    amountPerShare: amount,
    announcedAt: `${announcedYear}-${String(month).padStart(2, "0")}-15T18:00:00-03:00`,
    source: {
      documentId: `${ticker}-${competenceMonth}`,
      sourceUrl: `https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?id=${month}`,
      sourceType: "primary_regulatory",
      reviewMethod: "automatic_regulatory_validation",
      reviewedBy: "risk-lab-fnet-automatic-v0.1.0",
      reviewedAt: "2026-07-20T12:00:00-03:00",
      page: 1,
      excerpt: `Aviso oficial ${competenceMonth}.`,
      sourceHash: HASH,
      protocolHash: PROTOCOL_HASH,
      protocolVersion: 1,
    },
  };
}

function seriesFor(ticker: string, mode: "healthy" | "reversible" = "healthy", announcedYear = 2024): AutomaticMonthlySeries {
  const amounts = mode === "healthy"
    ? Array(12).fill(1)
    : [1, 1, 1, 1, 1, 1, 0.75, 0.75, 0.75, 1, 1, 1];
  const observations = amounts.map((amount, index) => observation(ticker, index + 1, amount, announcedYear));
  return {
    status: "ready",
    observations,
    sources: [],
    missingMonths: [],
    conflicts: [],
    longestContiguousSequence: 12,
    method: "direct_declared_per_share",
    detectorResult: null,
    detectorExecuted: true,
    classificationFinal: false,
    limitation: "material_credit_events_not_automatically_validated",
  };
}

function source(year: number, hash: string | null = HASH): AutomaticSourceSummary {
  return {
    year,
    sourceUrl: `https://dados.cvm.gov.br/dados/FI/DOC/EVENTUAL/DADOS/eventual_fi_${year}.csv`,
    sourceHash: hash,
    fetched: hash !== null,
    matchingRows: 10,
    acceptedDocuments: 10,
    rejectedRows: 0,
    error: hash ? null : "indisponível",
  };
}

function eventDocument(ticker: string, year: number): AutomaticDocumentEvidence {
  return {
    documentId: `${ticker}-${year}-event`,
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
  const documentId = `${ticker}-${year}-event`;
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
  healthyStressTicker?: string;
  lookAheadTicker?: string;
}

function serviceFor(options: FixtureOptions = {}) {
  const store = new MemoryStore();
  const discovery = {
    discover: async (_cnpj: string, years: number[]) => {
      const ticker = currentTicker;
      return {
        documents: years.includes(2024) && (ticker === "DEVA11" || ticker === "VSLH11")
          ? [eventDocument(ticker, 2024)]
          : [],
        sources: years.map((year) => source(year, year === options.missingSourceYear ? null : HASH)),
        issues: [],
      };
    },
  };
  let currentTicker = "";
  const service = new RiskLabCohortBacktestService({
    store,
    now: () => new Date("2026-07-20T12:00:00-03:00"),
    resolveFund: async (ticker) => {
      currentTicker = ticker;
      return { cnpj: "12345678000199", name: ticker } as unknown as PublicFundData;
    },
    discovery,
    dividendSeries: {
      build: async (ticker) => {
        const stress = ticker === "MCCI11" || ticker === "RBRY11" || ticker === options.healthyStressTicker;
        const year = ticker === options.lookAheadTicker ? 2026 : 2024;
        return seriesFor(ticker, stress ? "reversible" : "healthy", year);
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
  return { service, store };
}

test("executa os seis fundos, preserva ruleset e conclui sem aprovação humana", async () => {
  const { service } = serviceFor();
  const evidence = await service.run();

  assert.equal(evidence.status, "passed");
  assert.equal(evidence.executionAllowed, true);
  assert.equal(evidence.cases.length, 6);
  assert.equal(evidence.metrics.truePositives, 4);
  assert.equal(evidence.metrics.trueNegatives, 2);
  assert.equal(evidence.metrics.falsePositives, 0);
  assert.equal(evidence.metrics.falseNegatives, 0);
  assert.equal(evidence.metrics.inconclusiveCases, 0);
  assert.equal(evidence.metrics.coveragePercent, 100);
  assert.equal(evidence.cases.every((item) => item.primaryEvidenceComplete), true);
  assert.equal(evidence.cases.every((item) => !item.premiumIntegrated && !item.notificationsSent), true);
  assert.match(evidence.evidenceHash || "", /^[a-f0-9]{64}$/);
});

test("fonte anual sem hash mantém a coorte bloqueada e inconclusiva", async () => {
  const { service } = serviceFor({ missingSourceYear: 2023 });
  const evidence = await service.run();

  assert.equal(evidence.status, "failed");
  assert.equal(evidence.executionAllowed, false);
  assert.ok(evidence.metrics.inconclusiveCases > 0);
  assert.equal(evidence.checks.find((item) => item.id === "evidence.primary-complete")?.status, "failed");
});

test("controle saudável com estresse vira falso positivo e impede encerramento", async () => {
  const { service } = serviceFor({ healthyStressTicker: "KNCR11" });
  const evidence = await service.run();

  assert.equal(evidence.status, "failed");
  assert.equal(evidence.executionAllowed, false);
  assert.equal(evidence.metrics.falsePositives, 1);
  assert.equal(evidence.cases.find((item) => item.ticker === "KNCR11")?.outcome, "false_positive");
});

test("observação posterior à janela é detectada como look-ahead e não pode concluir", async () => {
  const { service } = serviceFor({ lookAheadTicker: "KNCR11" });
  const evidence = await service.run();
  const kncr = evidence.cases.find((item) => item.ticker === "KNCR11");

  assert.equal(evidence.status, "failed");
  assert.equal(kncr?.lookAheadDetected, true);
  assert.equal(kncr?.outcome, "inconclusive");
  assert.equal(evidence.checks.find((item) => item.id === "look-ahead.none")?.status, "failed");
});
