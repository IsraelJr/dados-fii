import assert from "node:assert/strict";
import test from "node:test";
import {
  SingleFrozenDividendCaseFinalizer,
  type SingleFrozenDividendInput,
} from "../src/lib/risk-lab/SingleFrozenDividendCaseFinalizer";

function input(): SingleFrozenDividendInput {
  return {
    schemaVersion: 1,
    phase: "3.5-A",
    sourceArtifacts: { baseline: { artifactId: 1 }, diagnostic: { artifactId: 2 } },
    identity: {
      ticker: "AAAA11",
      cnpj: "00000000000001",
      role: "severe_deterioration",
      fromDate: "2021-01-01",
      untilDate: "2021-12-31",
    },
    checkpoint: {
      ticker: "AAAA11",
      cnpj: "00000000000001",
      fromDate: "2021-01-01",
      untilDate: "2021-12-31",
      discoveredDocumentIds: ["outside", "secondary", "valid"],
      completedDocumentIds: ["valid"],
      failuresByDocumentId: {
        outside: {
          documentId: "outside",
          message: "legacy",
          attempts: 1,
          retryable: false,
          lastAttemptAt: "2026-01-01T00:00:00Z",
        },
        secondary: {
          documentId: "secondary",
          message: "abort",
          attempts: 1,
          retryable: true,
          lastAttemptAt: "2026-01-01T00:00:00Z",
        },
      },
      observationsByDocumentId: {
        valid: {
          ticker: "AAAA11",
          competenceMonth: "2021-01",
          amountPerShare: 1,
          announcedAt: "2021-01-08T18:00:00-03:00",
          informationDate: "2021-01-08",
          baseDate: "2021-01-08",
          paymentDate: "2021-01-15",
          documentId: "valid",
          receivedAt: "2021-01-08T18:00:00-03:00",
          sourceUrl: "https://example/valid",
          protocolUrl: "https://example/protocol",
          page: 1,
          excerpt: "valid",
          sourceHash: "a".repeat(64),
          protocolHash: "b".repeat(64),
          protocolVersion: 1,
          sourceVersion: "test",
        },
      },
      updatedAt: "2026-01-01T00:00:00Z",
    },
    diagnosticEvidence: [
      {
        artifactId: 2,
        artifactDigest: `sha256:${"c".repeat(64)}`,
        documentId: "outside",
        failure: {
          documentId: "outside",
          message: "Período de referência FNET inválido: 12-20",
          attempts: 1,
          retryable: false,
          lastAttemptAt: "2026-01-01T00:00:00Z",
        },
      },
      {
        artifactId: 2,
        artifactDigest: `sha256:${"c".repeat(64)}`,
        documentId: "secondary",
        failure: {
          documentId: "secondary",
          message: "Ticker FNET inválido: AAAA13",
          attempts: 1,
          retryable: false,
          lastAttemptAt: "2026-01-01T00:00:00Z",
        },
      },
    ],
  };
}

test("finaliza caso isolado com evidência oficial preservada e hash reproduzível", () => {
  const first = new SingleFrozenDividendCaseFinalizer().finalize(input());
  const second = new SingleFrozenDividendCaseFinalizer().finalize(input());
  assert.equal(first.case.status, "complete");
  assert.equal(first.case.documentsProcessed, 3);
  assert.deepEqual(first.case.pendingDocumentIds, []);
  assert.deepEqual(first.case.conflicts, []);
  assert.equal(first.case.caseHash, second.case.caseHash);
  assert.equal(first.audit.auditHash, second.audit.auditHash);
  assert.deepEqual(
    first.audit.exclusions.map((item) => [item.documentId, item.classification]),
    [["outside", "outside_cohort_window"], ["secondary", "secondary_share_class"]],
  );
});

test("falha fechada quando período histórico pertence à janela", () => {
  const value = input();
  value.diagnosticEvidence[0].failure.message = "Período de referência FNET inválido: 02-21";
  assert.throws(
    () => new SingleFrozenDividendCaseFinalizer().finalize(value),
    /pertence à janela/,
  );
});

test("falha fechada para ticker de outra família", () => {
  const value = input();
  value.diagnosticEvidence[1].failure.message = "Ticker FNET inválido: BBBB13";
  assert.throws(
    () => new SingleFrozenDividendCaseFinalizer().finalize(value),
    /não justifica exclusão/,
  );
});

test("falha fechada quando a evidência não justifica uma classificação geral", () => {
  const value = input();
  value.diagnosticEvidence[1].failure.message = "Operação abortada durante a leitura do documento";
  assert.throws(
    () => new SingleFrozenDividendCaseFinalizer().finalize(value),
    /Evidência insuficiente para classificar secondary/,
  );
});

test("exige evidência exata para todas as pendências do checkpoint", () => {
  const value = input();
  value.diagnosticEvidence = value.diagnosticEvidence.filter((item) => item.documentId !== "secondary");
  assert.throws(
    () => new SingleFrozenDividendCaseFinalizer().finalize(value),
    /Evidências divergem das pendências do checkpoint/,
  );
});
