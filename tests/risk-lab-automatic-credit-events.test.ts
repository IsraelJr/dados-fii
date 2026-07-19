import assert from "node:assert/strict";
import test from "node:test";
import { AutomaticCreditEventScreeningService } from "../src/lib/risk-lab/AutomaticCreditEventScreeningService";
import { RiskLabAutomaticOrchestrator } from "../src/lib/risk-lab/RiskLabAutomaticOrchestrator";
import type {
  AutomaticCreditEventScreen,
  AutomaticDocumentEvidence,
  AutomaticSourceSummary,
  RiskLabAutomaticScan,
} from "../src/types/riskLabAutomatic";
import type { VerifiedDividendNotice } from "../src/types/riskLabDividendStress";

const FROM = "2025-01-01T00:00:00-03:00";
const UNTIL = "2025-12-31T23:59:59-03:00";

function document(overrides: Partial<AutomaticDocumentEvidence> = {}): AutomaticDocumentEvidence {
  return {
    documentId: "9001",
    documentType: "Fato Relevante",
    fileName: "fato-relevante.html",
    competenceDate: "2025-06-30",
    receivedAt: "2025-07-10T18:00:00-03:00",
    link: "https://dados.cvm.gov.br/documento.html",
    sourceYear: 2025,
    auditResult: "OK",
    confidence: 99,
    ...overrides,
  };
}

function sources(fetched = true): AutomaticSourceSummary[] {
  return [{
    year: 2025,
    sourceUrl: "https://dados.cvm.gov.br/fonte.csv",
    sourceHash: fetched ? "hash" : null,
    fetched,
    matchingRows: 1,
    acceptedDocuments: fetched ? 1 : 0,
    rejectedRows: 0,
    error: fetched ? null : "indisponível",
  }];
}

function html(value: string) {
  return new Response(`<html><body>${value}</body></html>`, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

test("explicit metadata confirms a material credit event without human review", async () => {
  let fetchCalls = 0;
  const service = new AutomaticCreditEventScreeningService({
    fetchImpl: (async () => { fetchCalls += 1; return html(""); }) as typeof fetch,
    now: () => new Date("2026-07-19T00:00:00-03:00"),
  });
  const result = await service.screen(
    "MCCI11",
    [document({ documentType: "Fato Relevante - Inadimplência material" })],
    sources(),
    FROM,
    UNTIL,
  );
  assert.equal(result.status, "material_event_confirmed");
  assert.equal(result.classificationFinal, true);
  assert.equal(result.verifiedEvents[0].type, "default");
  assert.equal(fetchCalls, 0);
});

test("official HTML can confirm judicial recovery", async () => {
  const service = new AutomaticCreditEventScreeningService({
    fetchImpl: (async () => html("A companhia protocolou pedido de recuperação judicial.")) as typeof fetch,
  });
  const result = await service.screen("MCCI11", [document()], sources(), FROM, UNTIL);
  assert.equal(result.status, "material_event_confirmed");
  assert.equal(result.matches[0].matchedIn, "official_html");
  assert.equal(result.verifiedEvents[0].type, "judicial_recovery");
});

test("unreadable PDF remains inconclusive instead of being treated as clean", async () => {
  const service = new AutomaticCreditEventScreeningService({
    fetchImpl: (async () => new Response("pdf", {
      status: 200,
      headers: { "content-type": "application/pdf" },
    })) as typeof fetch,
  });
  const result = await service.screen("MCCI11", [document({ link: "https://dados.cvm.gov.br/documento.pdf" })], sources(), FROM, UNTIL);
  assert.equal(result.status, "inconclusive");
  assert.equal(result.classificationFinal, false);
  assert.equal(result.ambiguousDocuments.length, 1);
});

test("complete coverage with no relevant documents is not a clean-fund certificate", async () => {
  const service = new AutomaticCreditEventScreeningService();
  const result = await service.screen(
    "MCCI11",
    [document({ documentType: "Rendimentos e Amortizações", fileName: "rendimento.html" })],
    sources(),
    FROM,
    UNTIL,
  );
  assert.equal(result.status, "no_explicit_event_found");
  assert.equal(result.classificationFinal, false);
  assert.match(result.summary, /não equivale a uma certificação/);
});

test("missing official source coverage keeps the screen inconclusive", async () => {
  const service = new AutomaticCreditEventScreeningService();
  const result = await service.screen("MCCI11", [], sources(false), FROM, UNTIL);
  assert.equal(result.status, "inconclusive");
  assert.equal(result.sourceCoverageComplete, false);
});

function observations(): VerifiedDividendNotice[] {
  const amounts = [1, 1, 1, 1, 1, 1, 0.75, 0.75, 0.75, 1, 1, 1];
  return amounts.map((amount, index) => {
    const month = String(index + 1).padStart(2, "0");
    return {
      ticker: "MCCI11",
      competenceMonth: `2025-${month}`,
      amountPerShare: amount,
      announcedAt: `2025-${month}-15T18:00:00-03:00`,
      source: {
        documentId: String(100 + index),
        sourceUrl: "https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?id=1",
        sourceType: "primary_regulatory",
        reviewMethod: "automatic_regulatory_validation",
        reviewedBy: "risk-lab-fnet-automatic-v0.1.0",
        reviewedAt: "2026-07-19T00:00:00-03:00",
        page: null,
        excerpt: "Aviso oficial validado automaticamente.",
      },
    };
  });
}

function baseScan(): RiskLabAutomaticScan {
  const series = observations();
  return {
    id: "MCCI11_base",
    ticker: "MCCI11",
    startedAt: "2026-07-19T00:00:00-03:00",
    completedAt: "2026-07-19T00:01:00-03:00",
    requestedBy: "admin@example.com",
    status: "validated",
    identity: { ticker: "MCCI11", cnpj: "12345678000190", fundName: "MCCI", identitySource: "teste" },
    documents: [document({ receivedAt: "2025-08-01T18:00:00-03:00" })],
    sources: sources(),
    issues: [],
    monthlySeries: {
      status: "ready",
      observations: series,
      sources: [],
      missingMonths: [],
      conflicts: [],
      longestContiguousSequence: 12,
      method: "direct_declared_per_share",
      detectorResult: {
        ticker: "MCCI11",
        status: "reversible_stress_confirmed",
        baselineMonths: series.slice(0, 6).map((item) => item.competenceMonth),
        baselineMedian: 1,
        stressMonths: series.slice(6, 9).map((item) => item.competenceMonth),
        stressAverage: 0.75,
        stressDropPercent: 25,
        stressDetectedAt: series[8].announcedAt,
        recoveryMonths: series.slice(9, 12).map((item) => item.competenceMonth),
        recoveryAverage: 1,
        recoveryPercentOfBaseline: 100,
        recoveryDetectedAt: series[11].announcedAt,
        blockingCreditEvent: null,
        observationsUsed: 12,
      },
      detectorExecuted: true,
      classificationFinal: false,
      limitation: "material_credit_events_not_automatically_validated",
    },
    analysisReadiness: "structured_series_ready",
    requiresHumanDocumentValidation: false,
    notificationsSent: false,
    premiumIntegrated: false,
    nextAction: "preliminar",
  };
}

function confirmedScreen(): AutomaticCreditEventScreen {
  return {
    status: "material_event_confirmed",
    relevantFrom: FROM,
    relevantUntil: UNTIL,
    inspectedDocuments: 1,
    sourceCoverageComplete: true,
    matches: [{
      documentId: "9001",
      sourceUrl: "https://dados.cvm.gov.br/documento.html",
      knownAt: "2025-08-01T18:00:00-03:00",
      eventType: "default",
      matchedTerm: "INADIMPLENCIA",
      matchedIn: "metadata",
      confidence: 99,
    }],
    verifiedEvents: [{
      ticker: "MCCI11",
      knownAt: "2025-08-01T18:00:00-03:00",
      type: "default",
      documentId: "9001",
      sourceUrl: "https://dados.cvm.gov.br/documento.html",
      reviewedBy: "risk-lab-credit-screen-v0.1.0",
      reviewedAt: "2026-07-19T00:00:00-03:00",
    }],
    ambiguousDocuments: [],
    summary: "Evento material confirmado.",
    classificationFinal: true,
  };
}

test("credit-aware orchestrator blocks a false recovery after a confirmed event", async () => {
  const orchestrator = new RiskLabAutomaticOrchestrator({
    base: { scan: async () => baseScan() },
    creditScreen: { screen: async () => confirmedScreen() },
  });
  const result = await orchestrator.scan("MCCI11", "admin@example.com");
  assert.equal(result.analysisReadiness, "structured_series_final");
  assert.equal(result.monthlySeries?.classificationFinal, true);
  assert.equal(result.monthlySeries?.detectorResult?.status, "recovery_blocked_by_material_credit_event");
  assert.equal(result.requiresHumanDocumentValidation, false);
  assert.equal(result.premiumIntegrated, false);
  assert.equal(result.notificationsSent, false);
});
