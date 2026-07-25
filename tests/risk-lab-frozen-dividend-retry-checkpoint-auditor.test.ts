import assert from "node:assert/strict";
import test from "node:test";
import { FrozenDividendRetryCheckpointAuditor } from "../src/lib/risk-lab/FrozenDividendRetryCheckpointAuditor";
import type { FrozenDividendCaseCheckpoint, FrozenDividendNoticeObservation } from "../src/types/riskLabFrozenDividendDataset";

const identity = { ticker: "AAAA11", cnpj: "12345678000199", role: "reversible_stress" as const, fromDate: "2022-01-01", untilDate: "2025-12-31" };
const artifact = { artifactId: 10, artifactDigest: `sha256:${"a".repeat(64)}` };
const retryArtifact = { artifactId: 11, artifactDigest: `sha256:${"b".repeat(64)}` };

function observation(documentId: string): FrozenDividendNoticeObservation {
  return {
    ticker: "AAAA11", competenceMonth: "2025-08", amountPerShare: 1.25,
    announcedAt: "2025-09-09T17:00:00-03:00", informationDate: "2025-09-09",
    baseDate: "2025-09-09", paymentDate: "2025-09-16", documentId,
    receivedAt: "2025-09-09T17:00:00-03:00",
    sourceUrl: `https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id=${documentId}`,
    protocolUrl: `https://fnet.bmfbovespa.com.br/fnet/publico/visualizarProtocoloDocumentoCVM?idDocumento=${documentId}`,
    page: 1, excerpt: "official", sourceHash: "c".repeat(64), protocolHash: "d".repeat(64),
    protocolVersion: 1, protocolEvidenceType: "official_manager_metadata", sourceVersion: "fnet-notice-manager-metadata-v1",
  };
}

function checkpoints() {
  const prior = observation("100"); prior.competenceMonth = "2025-07";
  const baseline: FrozenDividendCaseCheckpoint = {
    ticker: identity.ticker, cnpj: identity.cnpj, fromDate: identity.fromDate, untilDate: identity.untilDate,
    discoveredDocumentIds: ["100", "200", "300"], completedDocumentIds: ["100"],
    observationsByDocumentId: { "100": prior },
    failuresByDocumentId: {
      "200": { documentId: "200", message: "This operation was aborted", attempts: 1, retryable: true, lastAttemptAt: "2026-01-01T00:00:00Z" },
      "300": { documentId: "300", message: "Ticker FNET inválido: AAAA13", attempts: 1, retryable: false, lastAttemptAt: "2026-01-01T00:00:00Z" },
    }, updatedAt: "2026-01-01T00:00:00Z",
  };
  const retried: FrozenDividendCaseCheckpoint = structuredClone(baseline);
  retried.completedDocumentIds = ["100", "200", "300"];
  retried.observationsByDocumentId["200"] = observation("200");
  retried.failuresByDocumentId = {};
  retried.updatedAt = "2026-01-02T00:00:00Z";
  return { baseline, retried };
}

function run(baseline: FrozenDividendCaseCheckpoint, retried: FrozenDividendCaseCheckpoint) {
  return new FrozenDividendRetryCheckpointAuditor().audit({ identity, baselineCheckpoint: baseline, retriedCheckpoint: retried, baselineArtifact: artifact, retryArtifact });
}

test("audita recuperação transitória e classe secundária sem alterar histórico", () => {
  const { baseline, retried } = checkpoints(); const result = run(baseline, retried);
  assert.equal(result.recoveries.length, 1); assert.equal(result.recoveries[0].documentId, "200");
  assert.equal(result.secondaryShareClasses.length, 1); assert.equal(result.secondaryShareClasses[0].parsedTicker, "AAAA13");
  assert.match(result.auditHash, /^[a-f0-9]{64}$/);
});

test("rejeita alteração de observação já concluída", () => {
  const { baseline, retried } = checkpoints(); retried.observationsByDocumentId["100"].amountPerShare = 9;
  assert.throws(() => run(baseline, retried), /Observação anterior foi alterada/);
});

test("rejeita observação para falha não transitória", () => {
  const { baseline, retried } = checkpoints();
  baseline.failuresByDocumentId["200"].retryable = false; baseline.failuresByDocumentId["200"].message = "erro permanente";
  assert.throws(() => run(baseline, retried), /Falha não transitória recebeu observação/);
});

test("rejeita conclusão sem observação que não seja classe da mesma família", () => {
  const { baseline, retried } = checkpoints(); baseline.failuresByDocumentId["300"].message = "Ticker FNET inválido: BBBB13";
  assert.throws(() => run(baseline, retried), /não é classe secundária/);
});

test("rejeita mudança no universo descoberto", () => {
  const { baseline, retried } = checkpoints(); retried.discoveredDocumentIds.push("400");
  assert.throws(() => run(baseline, retried), /alterou o universo/);
});

test("rejeita retentativa ainda pendente", () => {
  const { baseline, retried } = checkpoints(); retried.completedDocumentIds = ["100", "200"];
  assert.throws(() => run(baseline, retried), /ainda possui pendências/);
});
