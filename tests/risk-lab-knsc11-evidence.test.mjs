import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const MANIFEST_PATH = "docs/production-evidence/risk-lab/knsc11-phase-b3-manifest.json";
const INDEX_PATH = "docs/production-evidence/risk-lab/knsc11-phase-b3/index.json";
const TEMPORARY_WORKFLOW = ".github/workflows/risk-lab-knsc11-phase-b3.yml";

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(stableValue(value)), "utf8").digest("hex");
}

function loadEvidence() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const index = JSON.parse(readFileSync(INDEX_PATH, "utf8"));
  const observations = [];
  for (const descriptor of index.observationFiles) {
    const payload = JSON.parse(readFileSync(descriptor.file, "utf8"));
    assert.equal(payload.schemaVersion, 1);
    assert.equal(payload.phase, "3.5-B3");
    assert.equal(payload.ticker, "KNSC11");
    assert.equal(payload.year, descriptor.year);
    assert.equal(payload.observations.length, descriptor.count);
    assert.equal(hashValue(payload.observations), descriptor.observationsHash);
    observations.push(...payload.observations);
  }
  return { manifest, index, observations };
}

test("quatro arquivos anuais recompõem as 48 competências mensais do KNSC11", () => {
  const { manifest, index, observations } = loadEvidence();
  assert.equal(index.status, "complete");
  assert.equal(index.identity.ticker, "KNSC11");
  assert.equal(index.identity.cnpj, "35864448000138");
  assert.equal(index.identity.role, "healthy_control");
  assert.equal(index.observationFiles.length, 4);
  assert.equal(observations.length, 48);
  assert.equal(hashValue(observations), index.combinedObservationsHash);
  assert.equal(index.combinedObservationsHash, manifest.deterministicHashes.combinedObservationsHash);

  const months = observations.map((item) => item.competenceMonth);
  assert.deepEqual(months, [...months].sort());
  assert.equal(new Set(months).size, 48);
  assert.equal(months[0], "2022-01");
  assert.equal(months.at(-1), "2025-12");

  for (const observation of observations) {
    assert.equal(observation.ticker, "KNSC11");
    assert.match(observation.competenceMonth, /^20\d{2}-(0[1-9]|1[0-2])$/);
    assert.ok(Number.isFinite(observation.amountPerShare) && observation.amountPerShare >= 0);
    for (const field of [
      "announcedAt", "informationDate", "baseDate", "paymentDate", "documentId",
      "receivedAt", "sourceUrl", "protocolUrl", "excerpt", "sourceHash",
      "protocolHash", "sourceVersion",
    ]) assert.ok(String(observation[field] || "").length > 0, `campo ${field} ausente`);
    assert.match(observation.sourceHash, /^[a-f0-9]{64}$/);
    assert.match(observation.protocolHash, /^[a-f0-9]{64}$/);
    assert.equal(observation.protocolEvidenceType, "official_manager_metadata");
  }
});

test("hash final do caso, auditoria e índice são reproduzíveis", () => {
  const { manifest, index, observations } = loadEvidence();
  const reconstructedCase = { ...index.caseWithoutObservations, observations };
  assert.equal(hashValue(reconstructedCase), index.caseHash);
  assert.equal(index.caseHash, manifest.deterministicHashes.caseHash);

  const auditPayload = { ...index.audit };
  delete auditPayload.auditHash;
  assert.equal(hashValue(auditPayload), index.audit.auditHash);
  assert.equal(index.audit.auditHash, manifest.deterministicHashes.auditHash);

  const evidencePayload = { ...index };
  delete evidencePayload.evidenceHash;
  assert.equal(hashValue(evidencePayload), index.evidenceHash);
  assert.equal(index.evidenceHash, manifest.deterministicHashes.evidenceHash);
});

test("duas execuções registradas produziram os mesmos hashes e cobertura mensal total", () => {
  const { manifest, index } = loadEvidence();
  assert.equal(index.execution.runs, 2);
  assert.equal(index.execution.hashesMatch, true);
  assert.deepEqual(index.execution.run1, index.execution.run2);
  assert.equal(index.execution.run1.inputCheckpointHash, manifest.deterministicHashes.inputCheckpointHash);
  assert.equal(index.execution.run1.finalizedCheckpointHash, manifest.deterministicHashes.finalizedCheckpointHash);
  assert.equal(index.result.documentsDiscovered, 52);
  assert.equal(index.result.documentsClassified, 52);
  assert.equal(index.result.rawObservationsInCheckpoint, 49);
  assert.equal(index.result.selectedMonthlyObservations, 48);
  assert.equal(index.result.pendingDocuments, 0);
  assert.equal(index.result.conflicts, 0);
  assert.deepEqual(index.result.missingMonths, []);
  assert.equal(index.result.longestContiguousSequence, 48);
});

test("as três classes secundárias possuem evidência geral da mesma família", () => {
  const { index } = loadEvidence();
  assert.deepEqual(
    index.exclusions.map((item) => [item.documentId, item.parsedTicker]),
    [["283956", "KNSC13"], ["283976", "KNSC14"], ["283999", "KNSC15"]],
  );
  for (const item of index.exclusions) {
    assert.equal(item.classification, "secondary_share_class");
    assert.equal(item.evidenceArtifactId, 8515476365);
    assert.equal(item.evidenceArtifactDigest, "sha256:8ed76121aa14086cba740ad921cdcef925e44bd274cb86ca42bc14bba1ee9d0e");
    assert.equal(item.evidenceMessage, `Ticker FNET inválido: ${item.parsedTicker}`);
    assert.match(item.evidenceHash, /^[a-f0-9]{64}$/);
  }
});

test("a reapresentação de janeiro de 2022 seleciona a versão 2 sem conflito", () => {
  const { index, observations } = loadEvidence();
  assert.equal(index.selectionDecisions.length, 1);
  const [decision] = index.selectionDecisions;
  assert.deepEqual(decision, {
    competenceMonth: "2022-01",
    selectedDocumentId: "261675",
    selectedProtocolVersion: 2,
    supersededDocuments: [{
      documentId: "261396",
      protocolVersion: 1,
      amountPerShare: 1.25,
      paymentDate: "2022-01-11",
    }],
    reason: "highest_protocol_version_then_latest_announcement_then_document_id",
  });
  const january = observations.find((item) => item.competenceMonth === "2022-01");
  assert.equal(january.documentId, "261675");
  assert.equal(january.protocolVersion, 2);
  assert.equal(january.amountPerShare, 1.25);
  assert.equal(january.paymentDate, "2022-02-11");
  assert.equal(observations.some((item) => item.documentId === "261396"), false);
});

test("não há workflow próprio, ticker hardcoded no finalizador ou efeito de produto", () => {
  const { manifest, index } = loadEvidence();
  assert.equal(existsSync(TEMPORARY_WORKFLOW), false);
  assert.deepEqual(index.caseWithoutObservations.pendingDocumentIds, []);
  assert.deepEqual(index.caseWithoutObservations.failures, []);
  assert.deepEqual(index.caseWithoutObservations.conflicts, []);
  assert.equal(manifest.safety.productIntegration, false);
  assert.equal(manifest.safety.premiumIntegration, false);
  assert.equal(manifest.safety.notificationIntegration, false);
  assert.equal(manifest.safety.backtestExecuted, false);
  const finalizerSource = readFileSync(
    "src/lib/risk-lab/SingleFrozenDividendCaseFinalizer.ts",
    "utf8",
  );
  assert.doesNotMatch(finalizerSource, /KNSC11/);
  assert.doesNotMatch(JSON.stringify(index), /premiumIntegrated|notificationsSent|productionEndpoint/i);
});
