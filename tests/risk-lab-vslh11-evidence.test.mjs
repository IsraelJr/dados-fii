import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const MANIFEST_PATH = "docs/production-evidence/risk-lab/vslh11-phase-b1-manifest.json";
const INDEX_PATH = "docs/production-evidence/risk-lab/vslh11-phase-b1/index.json";
const TEMPORARY_WORKFLOW = ".github/workflows/risk-lab-vslh11-phase-b1.yml";

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
    assert.equal(payload.phase, "3.5-B1");
    assert.equal(payload.ticker, "VSLH11");
    assert.equal(payload.year, descriptor.year);
    assert.equal(payload.observations.length, descriptor.count);
    assert.equal(hashValue(payload.observations), descriptor.observationsHash);
    observations.push(...payload.observations);
  }
  return { manifest, index, observations };
}

test("arquivos anuais recompõem as 64 observações mensais do VSLH11", () => {
  const { manifest, index, observations } = loadEvidence();
  assert.equal(index.status, "complete");
  assert.equal(index.identity.ticker, "VSLH11");
  assert.equal(index.identity.cnpj, "36244015000142");
  assert.equal(index.observationFiles.length, 6);
  assert.equal(observations.length, 64);
  assert.equal(hashValue(observations), index.combinedObservationsHash);
  assert.equal(index.combinedObservationsHash, manifest.expected.combinedObservationsHash);

  const months = observations.map((item) => item.competenceMonth);
  assert.deepEqual(months, [...months].sort());
  assert.equal(new Set(months).size, months.length);
  assert.equal(months[0], "2021-02");
  assert.equal(months.at(-1), "2026-06");
  assert.equal(months.includes("2023-12"), false);

  for (const observation of observations) {
    assert.equal(observation.ticker, "VSLH11");
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

test("hash final do caso, auditoria, reconciliação e índice são reproduzíveis", () => {
  const { manifest, index, observations } = loadEvidence();
  const reconstructedCase = { ...index.caseWithoutObservations, observations };
  assert.equal(hashValue(reconstructedCase), index.caseHash);
  assert.equal(index.caseHash, manifest.expected.caseHash);

  const auditPayload = { ...index.audit };
  delete auditPayload.auditHash;
  assert.equal(hashValue(auditPayload), index.audit.auditHash);
  assert.equal(index.audit.auditHash, manifest.expected.auditHash);

  const reconciliationPayload = {
    identity: index.identity,
    baselineCheckpointHash: index.reconciliation.baselineCheckpointHash,
    reconciledCheckpointHash: index.reconciliation.reconciledCheckpointHash,
    recoveries: index.reconciliation.recoveries,
    secondaryShareClasses: index.reconciliation.secondaryShareClasses,
  };
  assert.equal(hashValue(reconciliationPayload), index.reconciliation.reconciliationHash);
  assert.equal(index.reconciliation.reconciliationHash, manifest.expected.reconciliationHash);

  const evidencePayload = { ...index };
  delete evidencePayload.evidenceHash;
  assert.equal(hashValue(evidencePayload), index.evidenceHash);
  assert.equal(index.evidenceHash, manifest.expected.evidenceHash);
});

test("duas execuções registradas produziram os mesmos hashes e zero pendências", () => {
  const { manifest, index } = loadEvidence();
  assert.equal(index.execution.runs, 2);
  assert.equal(index.execution.hashesMatch, true);
  assert.deepEqual(index.execution.run1, index.execution.run2);
  assert.equal(index.execution.run1.baselineCheckpointHash, manifest.expected.baselineCheckpointHash);
  assert.equal(index.execution.run1.reconciledCheckpointHash, manifest.expected.reconciledCheckpointHash);
  assert.equal(index.result.documentsDiscovered, 79);
  assert.equal(index.result.documentsClassified, 79);
  assert.equal(index.result.rawObservationsInCheckpoint, 66);
  assert.equal(index.result.selectedMonthlyObservations, 64);
  assert.equal(index.result.pendingDocuments, 0);
  assert.equal(index.result.conflicts, 0);
  assert.deepEqual(index.result.missingMonths, ["2023-12"]);
  assert.equal(index.result.longestContiguousSequence, 34);
});

test("os dois abortos transitórios foram recuperados por observações oficiais", () => {
  const { index } = loadEvidence();
  const recoveries = index.reconciliation.recoveries;
  assert.deepEqual(recoveries.map((item) => item.documentId), ["1055396", "312220"]);
  assert.deepEqual(recoveries.map((item) => item.competenceMonth), ["2025-11", "2022-05"]);
  assert.deepEqual(recoveries.map((item) => item.amountPerShare), [0.029, 0.12]);
  for (const recovery of recoveries) {
    assert.equal(recovery.classification, "recovered_transient_failure");
    assert.equal(recovery.priorFailure.retryable, true);
    assert.match(recovery.priorFailure.message, /aborted/i);
    assert.equal(recovery.artifactId, 8515476365);
    assert.match(recovery.artifactDigest, /^sha256:[a-f0-9]{64}$/);
    assert.match(recovery.observationHash, /^[a-f0-9]{64}$/);
    assert.match(recovery.evidenceHash, /^[a-f0-9]{64}$/);
  }
});

test("as treze classes secundárias possuem evidência geral da mesma família", () => {
  const { index } = loadEvidence();
  const classifications = index.reconciliation.secondaryShareClasses;
  assert.equal(classifications.length, 13);
  assert.deepEqual(classifications.map((item) => item.documentId), [
    "152889", "152890", "152893", "152900", "182993", "191954", "191955",
    "192027", "192028", "232142", "232145", "253930", "253933",
  ]);
  for (const item of classifications) {
    assert.equal(item.classification, "secondary_share_class");
    assert.match(item.parsedTicker, /^VSLH1[345]$/);
    assert.equal(item.artifactId, 8515476365);
    assert.match(item.evidenceMessage, /^Ticker FNET inválido: VSLH1[345]$/);
    assert.match(item.evidenceHash, /^[a-f0-9]{64}$/);
  }
});

test("66 observações brutas se tornam 64 competências sem conflito oculto", () => {
  const { index } = loadEvidence();
  assert.equal(index.result.rawObservationsInCheckpoint - index.result.selectedMonthlyObservations, 2);
  assert.deepEqual(index.selectionDecisions.map((item) => item.excludedDocumentId), ["152886", "191952"]);
  assert.deepEqual(index.selectionDecisions.map((item) => item.selectedDocumentId), ["153493", "192026"]);
  assert.ok(index.selectionDecisions.every((item) => item.selectedProtocolVersion > item.excludedProtocolVersion));
  assert.deepEqual(index.caseWithoutObservations.failures, []);
  assert.deepEqual(index.caseWithoutObservations.conflicts, []);
  assert.deepEqual(index.caseWithoutObservations.pendingDocumentIds, []);
});

test("a fase isolada não cria workflow próprio ou efeitos de produto", () => {
  const { index } = loadEvidence();
  assert.equal(existsSync(TEMPORARY_WORKFLOW), false);
  assert.equal(index.phase, "3.5-B1");
  const serialized = JSON.stringify(index);
  assert.doesNotMatch(serialized, /premiumIntegrated|notificationsSent|productionEndpoint/i);
});
