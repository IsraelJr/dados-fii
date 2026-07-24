import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const MANIFEST_PATH = "docs/production-evidence/risk-lab/kncr11-phase-b2-manifest.json";
const INDEX_PATH = "docs/production-evidence/risk-lab/kncr11-phase-b2/index.json";
const TEMPORARY_WORKFLOW = ".github/workflows/risk-lab-kncr11-phase-b2.yml";

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
    assert.equal(payload.phase, "3.5-B2");
    assert.equal(payload.ticker, "KNCR11");
    assert.equal(payload.year, descriptor.year);
    assert.equal(payload.observations.length, descriptor.count);
    assert.equal(hashValue(payload.observations), descriptor.observationsHash);
    observations.push(...payload.observations);
  }
  return { manifest, index, observations };
}

test("quatro arquivos anuais recompõem as 48 competências mensais do KNCR11", () => {
  const { manifest, index, observations } = loadEvidence();
  assert.equal(index.status, "complete");
  assert.equal(index.identity.ticker, "KNCR11");
  assert.equal(index.identity.cnpj, "16706958000132");
  assert.equal(index.identity.role, "healthy_control");
  assert.equal(index.observationFiles.length, 4);
  assert.equal(observations.length, 48);
  assert.equal(hashValue(observations), index.combinedObservationsHash);
  assert.equal(index.combinedObservationsHash, manifest.expected.combinedObservationsHash);

  const months = observations.map((item) => item.competenceMonth);
  assert.deepEqual(months, [...months].sort());
  assert.equal(new Set(months).size, 48);
  assert.equal(months[0], "2022-01");
  assert.equal(months.at(-1), "2025-12");

  for (const observation of observations) {
    assert.equal(observation.ticker, "KNCR11");
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

test("duas execuções registradas produziram os mesmos hashes e cobertura mensal total", () => {
  const { manifest, index } = loadEvidence();
  assert.equal(index.execution.runs, 2);
  assert.equal(index.execution.hashesMatch, true);
  assert.deepEqual(index.execution.run1, index.execution.run2);
  assert.equal(index.execution.run1.baselineCheckpointHash, manifest.expected.baselineCheckpointHash);
  assert.equal(index.execution.run1.reconciledCheckpointHash, manifest.expected.reconciledCheckpointHash);
  assert.equal(index.result.documentsDiscovered, 52);
  assert.equal(index.result.documentsClassified, 52);
  assert.equal(index.result.rawObservationsInCheckpoint, 48);
  assert.equal(index.result.selectedMonthlyObservations, 48);
  assert.equal(index.result.pendingDocuments, 0);
  assert.equal(index.result.conflicts, 0);
  assert.deepEqual(index.result.missingMonths, []);
  assert.equal(index.result.longestContiguousSequence, 48);
});

test("documento 453528 foi recuperado apenas pela regra temporal fechada", () => {
  const { index } = loadEvidence();
  const [recovery] = index.reconciliation.recoveries;
  assert.equal(index.reconciliation.recoveries.length, 1);
  assert.equal(recovery.documentId, "453528");
  assert.equal(recovery.classification, "recovered_reference_period_metadata_drift");
  assert.equal(recovery.competenceMonth, "2023-04");
  assert.equal(recovery.amountPerShare, 1);
  assert.equal(recovery.priorFailure.retryable, false);
  assert.equal(
    recovery.priorFailure.message,
    "Período de referência FNET posterior à informação: Abril 2023",
  );
  assert.equal(recovery.artifactId, 8515476365);
  assert.match(recovery.artifactDigest, /^sha256:[a-f0-9]{64}$/);
  assert.match(recovery.observationHash, /^[a-f0-9]{64}$/);
  assert.match(recovery.evidenceHash, /^[a-f0-9]{64}$/);
});

test("as quatro classes KNCR14 possuem evidência geral da mesma família", () => {
  const { index } = loadEvidence();
  const classifications = index.reconciliation.secondaryShareClasses;
  assert.deepEqual(classifications.map((item) => item.documentId), [
    "310584", "321258", "332122", "346629",
  ]);
  for (const item of classifications) {
    assert.equal(item.classification, "secondary_share_class");
    assert.equal(item.parsedTicker, "KNCR14");
    assert.equal(item.artifactId, 8515476365);
    assert.equal(item.evidenceMessage, "Ticker FNET inválido: KNCR14");
    assert.match(item.evidenceHash, /^[a-f0-9]{64}$/);
  }
});

test("não há reapresentação, conflito oculto, workflow próprio ou efeito de produto", () => {
  const { index } = loadEvidence();
  assert.deepEqual(index.selectionDecisions, []);
  assert.deepEqual(index.caseWithoutObservations.failures, []);
  assert.deepEqual(index.caseWithoutObservations.conflicts, []);
  assert.deepEqual(index.caseWithoutObservations.pendingDocumentIds, []);
  assert.equal(existsSync(TEMPORARY_WORKFLOW), false);
  assert.equal(index.phase, "3.5-B2");
  assert.doesNotMatch(JSON.stringify(index), /premiumIntegrated|notificationsSent|productionEndpoint/i);
  const reconcilerSource = readFileSync(
    "src/lib/risk-lab/FrozenDividendCheckpointReconciler.ts",
    "utf8",
  );
  assert.doesNotMatch(reconcilerSource, /KNCR11/);
});
