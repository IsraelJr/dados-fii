import assert from "node:assert/strict";
import test from "node:test";
import {
  FrozenDividendObservationWindowSanitizer,
  type FrozenDividendObservationWindowSanitizationInput,
} from "../src/lib/risk-lab/FrozenDividendObservationWindowSanitizer";

function observation(documentId: string, competenceMonth: string, informationDate: string) {
  return {
    ticker: "AAAA11",
    competenceMonth,
    amountPerShare: 1,
    announcedAt: `${informationDate}T18:00:00-03:00`,
    informationDate,
    baseDate: informationDate,
    paymentDate: "2022-01-19",
    documentId,
    receivedAt: `${informationDate}T18:00:00-03:00`,
    sourceUrl: `https://example.test/document?id=${documentId}`,
    protocolUrl: `https://example.test/protocol?idDocumento=${documentId}`,
    page: 1,
    excerpt: "evidência oficial",
    sourceHash: "a".repeat(64),
    protocolHash: "b".repeat(64),
    protocolVersion: 1,
    protocolEvidenceType: "official_manager_metadata" as const,
    sourceVersion: "test",
  };
}

function input(): FrozenDividendObservationWindowSanitizationInput {
  const rollover = observation("rollover", "2022-12", "2022-01-12");
  const valid = observation("valid", "2022-01", "2022-02-10");
  valid.paymentDate = "2022-02-17";
  return {
    identity: {
      ticker: "AAAA11",
      cnpj: "00000000000001",
      role: "reversible_stress",
      fromDate: "2022-01-01",
      untilDate: "2025-12-31",
    },
    checkpoint: {
      ticker: "AAAA11",
      cnpj: "00000000000001",
      fromDate: "2022-01-01",
      untilDate: "2025-12-31",
      discoveredDocumentIds: ["rollover", "valid"],
      completedDocumentIds: ["rollover", "valid"],
      failuresByDocumentId: {},
      observationsByDocumentId: { rollover, valid },
      updatedAt: "2026-01-01T00:00:00Z",
    },
    evidence: [{
      artifactId: 2,
      artifactDigest: `sha256:${"c".repeat(64)}`,
      documentId: "rollover",
      observation: structuredClone(rollover),
    }],
  };
}

test("remove deriva inequívoca de virada de ano fora da janela com hash reproduzível", () => {
  const first = new FrozenDividendObservationWindowSanitizer().sanitize(input());
  const second = new FrozenDividendObservationWindowSanitizer().sanitize(input());
  assert.equal(first.checkpoint.observationsByDocumentId.rollover, undefined);
  assert.ok(first.checkpoint.observationsByDocumentId.valid);
  assert.equal(first.exclusions.length, 1);
  assert.equal(first.exclusions[0].reportedCompetenceMonth, "2022-12");
  assert.equal(first.exclusions[0].correctedCompetenceMonth, "2021-12");
  assert.equal(first.exclusions[0].classification, "outside_cohort_window_year_rollover_metadata_drift");
  assert.equal(first.sanitizationHash, second.sanitizationHash);
  assert.equal(first.sanitizedCheckpointHash, second.sanitizedCheckpointHash);
});

test("exige evidência exata para todos os candidatos temporais", () => {
  const value = input();
  value.evidence = [];
  assert.throws(
    () => new FrozenDividendObservationWindowSanitizer().sanitize(value),
    /Evidências temporais divergem/,
  );
});

test("falha fechado quando a observação da evidência diverge do checkpoint", () => {
  const value = input();
  value.evidence[0].observation.amountPerShare = 2;
  assert.throws(
    () => new FrozenDividendObservationWindowSanitizer().sanitize(value),
    /Observação original divergente/,
  );
});

test("não exclui quando a competência corrigida ainda pertence à coorte", () => {
  const value = input();
  value.identity.fromDate = "2021-01-01";
  value.checkpoint.fromDate = "2021-01-01";
  assert.throws(
    () => new FrozenDividendObservationWindowSanitizer().sanitize(value),
    /pertence à janela da coorte/,
  );
});

test("não aceita observação normal como deriva de virada de ano", () => {
  const value = input();
  value.checkpoint.observationsByDocumentId.rollover.competenceMonth = "2021-12";
  value.evidence[0].observation = structuredClone(value.checkpoint.observationsByDocumentId.rollover);
  assert.throws(
    () => new FrozenDividendObservationWindowSanitizer().sanitize(value),
    /Evidências temporais divergem/,
  );
});

test("falha fechado para identidade ou digest inválidos", () => {
  const wrongIdentity = input();
  wrongIdentity.identity.ticker = "BBBB11";
  assert.throws(
    () => new FrozenDividendObservationWindowSanitizer().sanitize(wrongIdentity),
    /Checkpoint não pertence/,
  );

  const wrongDigest = input();
  wrongDigest.evidence[0].artifactDigest = "invalid";
  assert.throws(
    () => new FrozenDividendObservationWindowSanitizer().sanitize(wrongDigest),
    /Digest do artefato inválido/,
  );
});
