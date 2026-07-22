import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";

const MANIFEST_PATH = "docs/production-evidence/risk-lab/deva11-phase-a-manifest.json";
const INDEX_PATH = "docs/production-evidence/risk-lab/deva11-phase-a/index.json";
const TEMPORARY_WORKFLOW = ".github/workflows/risk-lab-deva11-phase-a.yml";

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
  const encoded = readFileSync(index.observationsArtifact.file, "utf8").trim();
  const gzipBytes = Buffer.from(encoded, "base64");
  const observations = JSON.parse(gunzipSync(gzipBytes).toString("utf8"));
  return { manifest, index, gzipBytes, observations };
}

test("artefato compactado recompõe as 65 observações mensais do DEVA11", () => {
  const { manifest, index, gzipBytes, observations } = loadEvidence();
  assert.equal(index.status, "complete");
  assert.equal(index.identity.ticker, "DEVA11");
  assert.equal(index.identity.cnpj, "37087810000137");
  assert.equal(observations.length, 65);
  assert.equal(index.observationsArtifact.count, observations.length);
  assert.equal(
    createHash("sha256").update(gzipBytes).digest("hex"),
    index.observationsArtifact.gzipSha256,
  );
  assert.equal(index.observationsArtifact.gzipSha256, manifest.expected.observationsArtifactGzipSha256);

  const months = observations.map((item) => item.competenceMonth);
  assert.deepEqual(months, [...months].sort());
  assert.equal(new Set(months).size, months.length);
  assert.equal(months[0], "2021-01");
  assert.equal(months.at(-1), "2026-06");
  assert.equal(months.includes("2024-07"), false);

  for (const observation of observations) {
    assert.equal(observation.ticker, "DEVA11");
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

test("hashes por ano e hash final do caso são reproduzíveis", () => {
  const { manifest, index, observations } = loadEvidence();
  const grouped = Object.groupBy(observations, (item) => item.competenceMonth.slice(0, 4));
  for (const [year, expected] of Object.entries(index.observationsArtifact.years)) {
    assert.equal(grouped[year]?.length, expected.count, `contagem divergente em ${year}`);
    assert.equal(hashValue(grouped[year]), expected.observationsHash, `hash divergente em ${year}`);
  }

  const reconstructedCase = { ...index.caseWithoutObservations, observations };
  assert.equal(hashValue(reconstructedCase), index.caseHash);
  assert.equal(index.caseHash, manifest.expected.caseHash);

  const auditPayload = { ...index.audit };
  delete auditPayload.auditHash;
  assert.equal(hashValue(auditPayload), index.audit.auditHash);
  assert.equal(index.audit.auditHash, manifest.expected.auditHash);

  const evidencePayload = { ...index };
  delete evidencePayload.evidenceHash;
  assert.equal(hashValue(evidencePayload), index.evidenceHash);
  assert.equal(index.evidenceHash, manifest.expected.evidenceHash);
});

test("duas execuções registradas produziram os mesmos hashes", () => {
  const { manifest, index } = loadEvidence();
  assert.equal(index.execution.runs, 2);
  assert.equal(index.execution.hashesMatch, true);
  assert.deepEqual(index.execution.run1, index.execution.run2);
  assert.equal(index.execution.run1.inputCheckpointHash, manifest.expected.inputCheckpointHash);
  assert.equal(index.result.documentsDiscovered, manifest.expected.documentsDiscovered);
  assert.equal(index.result.documentsClassified, manifest.expected.documentsProcessed);
  assert.equal(index.result.rawObservationsInCheckpoint, manifest.expected.rawObservationsInCheckpoint);
  assert.equal(index.result.selectedMonthlyObservations, manifest.expected.selectedMonthlyObservations);
  assert.equal(index.result.pendingDocuments, 0);
  assert.equal(index.result.conflicts, 0);
});

test("os dois documentos pendentes possuem classificação geral e evidência oficial", () => {
  const { index } = loadEvidence();
  assert.deepEqual(index.exclusions.map((item) => item.documentId), ["137843", "349282"]);
  assert.deepEqual(index.exclusions.map((item) => item.classification), [
    "outside_cohort_window",
    "secondary_share_class",
  ]);
  assert.equal(index.exclusions[0].competenceMonth, "2020-12");
  assert.equal(index.exclusions[0].parsedTicker, "DEVA11");
  assert.equal(index.exclusions[1].parsedTicker, "DEVA13");
  for (const exclusion of index.exclusions) {
    assert.equal(exclusion.evidenceArtifactId, 8515476365);
    assert.match(exclusion.evidenceArtifactDigest, /^sha256:[a-f0-9]{64}$/);
    assert.match(exclusion.evidenceHash, /^[a-f0-9]{64}$/);
    assert.match(exclusion.sourceUrl, /^https:\/\/fnet\.bmfbovespa\.com\.br\//);
  }
});

test("67 observações brutas se tornam 65 competências sem conflito oculto", () => {
  const { index } = loadEvidence();
  assert.equal(index.result.rawObservationsInCheckpoint - index.result.selectedMonthlyObservations, 2);
  assert.deepEqual(index.selectionDecisions.map((item) => item.excludedDocumentId), ["191928", "299179"]);
  assert.deepEqual(index.selectionDecisions.map((item) => item.selectedDocumentId), ["191981", "299296"]);
  assert.ok(index.selectionDecisions.every((item) => item.selectedProtocolVersion > item.excludedProtocolVersion));
  assert.deepEqual(index.caseWithoutObservations.failures, []);
  assert.deepEqual(index.caseWithoutObservations.conflicts, []);
  assert.deepEqual(index.caseWithoutObservations.pendingDocumentIds, []);
});

test("a fase isolada não reintroduz workflow próprio ou efeitos de produto", () => {
  const { index } = loadEvidence();
  assert.equal(existsSync(TEMPORARY_WORKFLOW), false);
  assert.equal(index.phase, "3.5-A");
  const serialized = JSON.stringify(index);
  assert.doesNotMatch(serialized, /premiumIntegrated|notificationsSent|productionEndpoint/i);
});
