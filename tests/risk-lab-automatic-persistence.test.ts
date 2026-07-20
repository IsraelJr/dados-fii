import assert from "node:assert/strict";
import test from "node:test";
import { RiskLabAutomaticOrchestrator } from "../src/lib/risk-lab/RiskLabAutomaticOrchestrator";
import type {
  RiskLabAutomaticScan,
  RiskLabAutomaticScanRepository,
} from "../src/types/riskLabAutomatic";

function readyScan(): RiskLabAutomaticScan {
  const announcedAt = "2026-01-15T12:00:00.000Z";
  return {
    id: "MCCI11_11111111111111111111",
    ticker: "MCCI11",
    startedAt: announcedAt,
    completedAt: announcedAt,
    requestedBy: "admin@example.com",
    status: "validated",
    identity: { ticker: "MCCI11", cnpj: "12345678000199", fundName: "MCCI", identitySource: "teste" },
    documents: [],
    sources: [],
    issues: [],
    monthlySeries: {
      status: "ready",
      observations: [{
        ticker: "MCCI11",
        competenceMonth: "2026-01",
        amountPerShare: 1,
        announcedAt,
        source: {
          documentId: "fixture-1",
          sourceUrl: "https://fnet.bmfbovespa.com.br/fixture-1",
          sourceType: "primary_regulatory",
          reviewMethod: "automatic_regulatory_validation",
          reviewedBy: "teste",
          reviewedAt: announcedAt,
          page: null,
          excerpt: "Fixture.",
        },
      }],
      sources: [],
      missingMonths: [],
      conflicts: [],
      longestContiguousSequence: 9,
      method: "direct_declared_per_share",
      detectorResult: {
        ticker: "MCCI11",
        status: "no_qualifying_stress",
        baselineMonths: [],
        baselineMedian: null,
        stressMonths: [],
        stressAverage: null,
        stressDropPercent: null,
        stressDetectedAt: null,
        recoveryMonths: [],
        recoveryAverage: null,
        recoveryPercentOfBaseline: null,
        recoveryDetectedAt: null,
        blockingCreditEvent: null,
        observationsUsed: 1,
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

test("the final credit-screened scan is the version persisted", async () => {
  let saved: RiskLabAutomaticScan | null = null;
  const repository: RiskLabAutomaticScanRepository = {
    save: async (scan) => {
      saved = scan;
      return scan;
    },
    latest: async () => saved,
  };
  const orchestrator = new RiskLabAutomaticOrchestrator({
    base: { scan: async () => readyScan() },
    creditScreen: {
      screen: async () => ({
        status: "inconclusive",
        relevantFrom: "2026-01-01T00:00:00.000Z",
        relevantUntil: "2026-01-31T23:59:59.000Z",
        inspectedDocuments: 1,
        sourceCoverageComplete: false,
        matches: [],
        verifiedEvents: [],
        ambiguousDocuments: [{
          documentId: "ambiguous-1",
          documentType: "Fato relevante",
          fileName: "documento.pdf",
          receivedAt: "2026-01-20T12:00:00.000Z",
          sourceUrl: "https://dados.cvm.gov.br/ambiguous-1",
          reason: "Documento não legível.",
        }],
        summary: "Documento ambíguo.",
        classificationFinal: false,
      }),
    },
    repository,
  });

  const result = await orchestrator.scan("MCCI11", "admin@example.com");
  assert.equal(result.status, "inconclusive");
  assert.equal(result.analysisReadiness, "credit_event_screen_inconclusive");
  assert.equal(saved?.id, result.id);
  assert.equal(saved?.monthlySeries?.limitation, "material_credit_event_screen_inconclusive");
  assert.equal(saved?.premiumIntegrated, false);
  assert.equal(saved?.notificationsSent, false);
});
