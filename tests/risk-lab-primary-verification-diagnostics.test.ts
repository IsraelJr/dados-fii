import assert from "node:assert/strict";
import test from "node:test";
import { CohortPrimaryVerificationService } from "../src/lib/risk-lab/CohortPrimaryVerificationService";
import type {
  AutomaticCreditEventScreen,
  AutomaticMonthlySeries,
  AutomaticSourceSummary,
} from "../src/types/riskLabAutomatic";
import type { OutOfSampleValidationCase } from "../src/types/riskLabValidation";

const monthlySeries: AutomaticMonthlySeries = {
  status: "blocked",
  observations: [],
  sources: [],
  missingMonths: [],
  conflicts: ["515681: Campo FNET ausente: Data-base"],
  longestContiguousSequence: 0,
  method: "unavailable",
  detectorResult: null,
  detectorExecuted: false,
  classificationFinal: false,
  limitation: "insufficient_structured_series",
};

const screen: AutomaticCreditEventScreen = {
  status: "no_explicit_event_found",
  relevantFrom: "2024-01-01T00:00:00-03:00",
  relevantUntil: "2024-12-31T23:59:59-03:00",
  inspectedDocuments: 0,
  sourceCoverageComplete: true,
  matches: [],
  verifiedEvents: [],
  ambiguousDocuments: [],
  summary: "Nenhum evento explícito.",
  classificationFinal: false,
};

const source: AutomaticSourceSummary = {
  year: 2024,
  sourceUrl: "https://dados.cvm.gov.br/eventual_fi_2024.csv",
  sourceHash: "a".repeat(64),
  fetched: true,
  matchingRows: 1,
  acceptedDocuments: 1,
  rejectedRows: 0,
  error: null,
};

const item = {
  ticker: "ABCD11",
  family: "credit_high_yield",
  role: "healthy_control",
  analysisWindow: { start: "2024-01-01", end: "2024-12-31" },
  hypothesis: "Controle saudável.",
  bomb: null,
  stress: null,
  healthyControlCriterion: "Sem evento material.",
  dataExtractionStarted: false,
} as OutOfSampleValidationCase;

test("blocker da série inclui a primeira causa operacional concreta", () => {
  const result = new CohortPrimaryVerificationService().verify({
    item,
    monthlySeries,
    screen,
    sources: [source],
    requiredYears: [2024],
    sourceCoveragePercent: 100,
    primaryEvidenceComplete: true,
    evidence: [],
  });

  const blocker = result.blockers.find((entry) => entry.code === "DIVIDEND_SERIES_NOT_READY");
  assert.ok(blocker);
  assert.match(blocker.message, /status blocked, sequência contínua 0/);
  assert.match(blocker.message, /Causa operacional: 515681: Campo FNET ausente: Data-base/);
});

test("mensagem operacional é limitada para não inflar a evidência", () => {
  const oversized: AutomaticMonthlySeries = {
    ...monthlySeries,
    conflicts: [`erro ${"x".repeat(1000)}`],
  };
  const result = new CohortPrimaryVerificationService().verify({
    item,
    monthlySeries: oversized,
    screen,
    sources: [source],
    requiredYears: [2024],
    sourceCoveragePercent: 100,
    primaryEvidenceComplete: true,
    evidence: [],
  });
  const message = result.blockers.find((entry) => entry.code === "DIVIDEND_SERIES_NOT_READY")?.message || "";
  assert.ok(message.length < 500);
});
