import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

const MANIFEST_PATH = "docs/production-evidence/risk-lab/mcci11-phase-b4-manifest.json";
const INDEX_PATH = "docs/production-evidence/risk-lab/mcci11-phase-b4/index.json";
const TEMPORARY_WORKFLOW = ".github/workflows/risk-lab-mcci11-phase-b4.yml";

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hashValue(value) {
  return sha256(JSON.stringify(stableValue(value)));
}

function loadEvidence() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const index = JSON.parse(readFileSync(INDEX_PATH, "utf8"));
  const descriptor = index.observationBundle;
  assert.equal(descriptor.encoding, "base64+gzip+canonical-json");
  assert.equal(descriptor.count, 46);

  const encoded = readFileSync(descriptor.file, "utf8").trim();
  assert.equal(sha256(encoded), descriptor.base64Hash);
  const compressed = Buffer.from(encoded, "base64");
  assert.equal(compressed.byteLength, descriptor.compressedBytes);
  assert.equal(sha256(compressed), descriptor.gzipHash);
  const uncompressed = gunzipSync(compressed);
  assert.equal(uncompressed.byteLength, descriptor.uncompressedBytes);
  const observations = JSON.parse(uncompressed.toString("utf8"));
  assert.equal(observations.length, descriptor.count);
  assert.equal(hashValue(observations), descriptor.observationsHash);
  return { manifest, index, observations };
}

test("bundle imutável recompõe as 46 competências selecionadas do MCCI11", () => {
  const { manifest, index, observations } = loadEvidence();
  assert.equal(index.status, "complete");
  assert.equal(index.identity.ticker, "MCCI11");
  assert.equal(index.identity.cnpj, "23648935000184");
  assert.equal(index.identity.role, "reversible_stress");
  assert.equal(observations.length, 46);
  assert.equal(hashValue(observations), index.combinedObservationsHash);
  assert.equal(index.combinedObservationsHash, manifest.deterministicHashes.combinedObservationsHash);

  const months = observations.map((item) => item.competenceMonth);
  assert.deepEqual(months, [...months].sort());
  assert.equal(new Set(months).size, 46);
  assert.equal(months[0], "2022-01");
  assert.equal(months.at(-1), "2025-11");
  assert.equal(months.includes("2025-02"), false);
  assert.equal(observations.some((item) => item.documentId === "255155"), false);

  for (const observation of observations) {
    assert.equal(observation.ticker, "MCCI11");
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

test("hashes do caso, auditoria, sanitização e índice são reproduzíveis", () => {
  const { manifest, index, observations } = loadEvidence();
  const reconstructedCase = { ...index.caseWithoutObservations, observations };
  assert.equal(hashValue(reconstructedCase), index.caseHash);
  assert.equal(index.caseHash, manifest.deterministicHashes.caseHash);

  const auditPayload = { ...index.audit };
  delete auditPayload.auditHash;
  assert.equal(hashValue(auditPayload), index.audit.auditHash);
  assert.equal(index.audit.auditHash, manifest.deterministicHashes.auditHash);

  const sanitizationPayload = { ...index.sanitization };
  delete sanitizationPayload.sanitizationHash;
  assert.equal(hashValue(sanitizationPayload), index.sanitization.sanitizationHash);
  assert.equal(index.sanitization.sanitizationHash, manifest.deterministicHashes.sanitizationHash);

  const evidencePayload = { ...index };
  delete evidencePayload.evidenceHash;
  assert.equal(hashValue(evidencePayload), index.evidenceHash);
  assert.equal(index.evidenceHash, manifest.deterministicHashes.evidenceHash);
});

test("duas execuções registradas produziram hashes idênticos e classificação total", () => {
  const { manifest, index } = loadEvidence();
  assert.equal(index.execution.runs, 2);
  assert.equal(index.execution.hashesMatch, true);
  assert.deepEqual(index.execution.run1, index.execution.run2);
  assert.equal(index.execution.run1.inputCheckpointHash, manifest.deterministicHashes.inputCheckpointHash);
  assert.equal(index.execution.run1.sanitizedCheckpointHash, manifest.deterministicHashes.sanitizedCheckpointHash);
  assert.equal(index.execution.run1.finalizedCheckpointHash, manifest.deterministicHashes.finalizedCheckpointHash);
  assert.equal(index.result.documentsDiscovered, 48);
  assert.equal(index.result.documentsClassified, 48);
  assert.equal(index.result.rawObservationsInCheckpoint, 47);
  assert.equal(index.result.observationsAfterTemporalSanitization, 46);
  assert.equal(index.result.selectedMonthlyObservations, 46);
  assert.equal(index.result.pendingDocuments, 0);
  assert.equal(index.result.conflicts, 0);
  assert.deepEqual(index.result.missingMonths, ["2025-02"]);
  assert.equal(index.result.longestContiguousSequence, 37);
});

test("documento 255155 foi excluído somente pela regra geral de virada de ano", () => {
  const { index } = loadEvidence();
  const [exclusion] = index.sanitization.exclusions;
  assert.equal(index.sanitization.exclusions.length, 1);
  assert.equal(exclusion.documentId, "255155");
  assert.equal(exclusion.classification, "outside_cohort_window_year_rollover_metadata_drift");
  assert.equal(exclusion.reportedCompetenceMonth, "2022-12");
  assert.equal(exclusion.correctedCompetenceMonth, "2021-12");
  assert.equal(exclusion.artifactId, 8515476365);
  assert.match(exclusion.artifactDigest, /^sha256:[a-f0-9]{64}$/);
  assert.match(exclusion.observationHash, /^[a-f0-9]{64}$/);
  assert.match(exclusion.evidenceHash, /^[a-f0-9]{64}$/);
});

test("classe MCCI13 possui evidência geral da mesma família", () => {
  const { index } = loadEvidence();
  const exclusion = index.exclusions.find((item) => item.documentId === "301632");
  assert.ok(exclusion);
  assert.equal(exclusion.classification, "secondary_share_class");
  assert.equal(exclusion.parsedTicker, "MCCI13");
  assert.equal(exclusion.evidenceArtifactId, 8515476365);
  assert.equal(exclusion.evidenceMessage, "Ticker FNET inválido: MCCI13");
  assert.match(exclusion.evidenceHash, /^[a-f0-9]{64}$/);
});

test("não há reapresentação, workflow próprio, hardcode ou efeito de produto", () => {
  const { index } = loadEvidence();
  assert.deepEqual(index.selectionDecisions, []);
  assert.deepEqual(index.caseWithoutObservations.failures, []);
  assert.deepEqual(index.caseWithoutObservations.conflicts, []);
  assert.deepEqual(index.caseWithoutObservations.pendingDocumentIds, []);
  assert.equal(existsSync(TEMPORARY_WORKFLOW), false);
  assert.doesNotMatch(JSON.stringify(index), /premiumIntegrated|notificationsSent|productionEndpoint/i);
  const sanitizerSource = readFileSync(
    "src/lib/risk-lab/FrozenDividendObservationWindowSanitizer.ts",
    "utf8",
  );
  assert.doesNotMatch(sanitizerSource, /MCCI11|255155|301632/);
});
