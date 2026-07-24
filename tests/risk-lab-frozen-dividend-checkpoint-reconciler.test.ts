import assert from "node:assert/strict";
import test from "node:test";
import {
  FrozenDividendCheckpointReconciler,
  type FrozenDividendCheckpointReconciliationInput,
} from "../src/lib/risk-lab/FrozenDividendCheckpointReconciler";

function input(): FrozenDividendCheckpointReconciliationInput {
  const digest = `sha256:${"c".repeat(64)}`;
  return {
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
      discoveredDocumentIds: ["recovered", "secondary", "valid"],
      completedDocumentIds: ["secondary", "valid"],
      observationsByDocumentId: {
        valid: {
          ticker: "AAAA11",
          competenceMonth: "2021-01",
          amountPerShare: 1,
          announcedAt: "2021-02-05T18:00:00-03:00",
          informationDate: "2021-02-05",
          baseDate: "2021-02-05",
          paymentDate: "2021-02-12",
          documentId: "valid",
          receivedAt: "2021-02-05T18:00:00-03:00",
          sourceUrl: "https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?id=valid&cvm=true",
          protocolUrl: "https://fnet.bmfbovespa.com.br/fnet/publico/visualizarProtocoloDocumentoCVM?idDocumento=valid",
          page: 1,
          excerpt: "valid",
          sourceHash: "a".repeat(64),
          protocolHash: "b".repeat(64),
          protocolVersion: 1,
          protocolEvidenceType: "official_manager_metadata",
          sourceVersion: "test",
        },
      },
      failuresByDocumentId: {
        recovered: {
          documentId: "recovered",
          message: "This operation was aborted",
          attempts: 1,
          retryable: true,
          lastAttemptAt: "2026-01-01T00:00:00Z",
        },
      },
      updatedAt: "2026-01-01T00:00:00Z",
    },
    recoveryEvidence: [
      {
        artifactId: 2,
        artifactDigest: digest,
        documentId: "recovered",
        failure: {
          documentId: "recovered",
          message: "This operation was aborted",
          attempts: 1,
          retryable: true,
          lastAttemptAt: "2026-01-01T00:00:00Z",
        },
        observation: {
          ticker: "AAAA11",
          competenceMonth: "2021-02",
          amountPerShare: 0.5,
          announcedAt: "2021-03-05T18:00:00-03:00",
          informationDate: "2021-03-05",
          baseDate: "2021-03-05",
          paymentDate: "2021-03-12",
          documentId: "recovered",
          receivedAt: "2021-03-05T18:00:00-03:00",
          sourceUrl: "https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?id=recovered&cvm=true",
          protocolUrl: "https://fnet.bmfbovespa.com.br/fnet/publico/visualizarProtocoloDocumentoCVM?idDocumento=recovered",
          page: 1,
          excerpt: "recovered",
          sourceHash: "d".repeat(64),
          protocolHash: "e".repeat(64),
          protocolVersion: 1,
          protocolEvidenceType: "official_manager_metadata",
          sourceVersion: "test",
        },
      },
    ],
    secondaryClassEvidence: [
      {
        artifactId: 2,
        artifactDigest: digest,
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

test("reconcilia falha transitória e classe secundária com hash reproduzível", () => {
  const first = new FrozenDividendCheckpointReconciler().reconcile(input());
  const second = new FrozenDividendCheckpointReconciler().reconcile(input());

  assert.deepEqual(first.checkpoint.completedDocumentIds, ["recovered", "secondary", "valid"]);
  assert.deepEqual(first.checkpoint.failuresByDocumentId, {});
  assert.equal(first.checkpoint.observationsByDocumentId.recovered.amountPerShare, 0.5);
  assert.equal(first.recoveries[0].classification, "recovered_transient_failure");
  assert.equal(first.secondaryShareClasses[0].parsedTicker, "AAAA13");
  assert.equal(first.reconciliationHash, second.reconciliationHash);
  assert.equal(first.reconciledCheckpointHash, second.reconciledCheckpointHash);
});

test("falha fechada quando a recuperação não cobre exatamente as pendências", () => {
  const value = input();
  value.recoveryEvidence = [];
  assert.throws(
    () => new FrozenDividendCheckpointReconciler().reconcile(value),
    /Evidências de recuperação divergem/,
  );
});

test("falha fechada para falha não transitória", () => {
  const value = input();
  value.checkpoint.failuresByDocumentId.recovered.retryable = false;
  value.recoveryEvidence[0].failure.retryable = false;
  value.recoveryEvidence[0].failure.message = "Documento inválido";
  value.checkpoint.failuresByDocumentId.recovered.message = "Documento inválido";
  assert.throws(
    () => new FrozenDividendCheckpointReconciler().reconcile(value),
    /Falha não transitória/,
  );
});

test("falha fechada para observação recuperada de outra identidade", () => {
  const value = input();
  value.recoveryEvidence[0].observation.ticker = "BBBB11";
  assert.throws(
    () => new FrozenDividendCheckpointReconciler().reconcile(value),
    /não pertence/,
  );
});

test("falha fechada quando classe secundária não pertence à mesma família", () => {
  const value = input();
  value.secondaryClassEvidence[0].failure.message = "Ticker FNET inválido: BBBB13";
  assert.throws(
    () => new FrozenDividendCheckpointReconciler().reconcile(value),
    /não comprova classe secundária/,
  );
});

test("falha fechada quando competência recuperada está fora da janela", () => {
  const value = input();
  value.recoveryEvidence[0].observation.competenceMonth = "2020-12";
  assert.throws(
    () => new FrozenDividendCheckpointReconciler().reconcile(value),
    /fora da janela/,
  );
});
