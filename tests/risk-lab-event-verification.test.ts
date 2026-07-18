import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertCandidatePromotionReady,
  loadEventVerificationLedger,
} from "../src/lib/risk-lab/EventVerificationLoader";
import {
  assertOutOfSampleCohortReady,
  loadOutOfSampleCohort,
} from "../src/lib/risk-lab/ValidationCohortLoader";

const ledgerPath = new URL("../src/lib/risk-lab/event-verification-candidates-v0.1.json", import.meta.url);
const cohortPath = new URL("../src/lib/risk-lab/out-of-sample-cohort-v0.1.json", import.meta.url);
const rawLedger = JSON.parse(readFileSync(ledgerPath, "utf8"));
const rawCohort = JSON.parse(readFileSync(cohortPath, "utf8"));

test("ledger mantém pesquisa separada da coorte e bloqueia execução", () => {
  const ledger = loadEventVerificationLedger(rawLedger);
  const cohort = loadOutOfSampleCohort(rawCohort);

  assert.equal(ledger.metadata.executionAllowed, false);
  assert.equal(ledger.metadata.status, "research_only_blocked");
  assert.throws(() => assertOutOfSampleCohortReady(cohort), /Coorte bloqueada para execução/);
});

test("DEVA11 e VSLH11 estão apenas localizados, sem data copiada de fonte secundária", () => {
  const ledger = loadEventVerificationLedger(rawLedger);
  const located = ledger.candidates.filter((item) => item.status === "candidate_document_located");

  assert.deepEqual(located.map((item) => item.ticker).sort(), ["DEVA11", "VSLH11"]);
  for (const candidate of located) {
    assert.equal(candidate.eligibleForCohortPromotion, false);
    assert.equal(candidate.officialDocument?.contentReview.status, "not_retrieved");
    assert.equal(candidate.officialDocument?.contentReview.page, null);
    assert.equal(candidate.officialDocument?.referenceDate, null);
    assert.equal(candidate.officialDocument?.publishedAt, null);
    assert.equal(candidate.eventDateCandidate, null);
    assert.throws(() => assertCandidatePromotionReady(candidate), /ainda não pode promover a coorte/);
  }
});

test("VSLH11 prioriza o documento anterior e registra o candidato tardio apenas como descartado", () => {
  const ledger = loadEventVerificationLedger(rawLedger);
  const candidate = ledger.candidates.find((item) => item.ticker === "VSLH11");

  assert.equal(candidate?.candidateId, "VSLH11-2023-12-RG");
  assert.equal(candidate?.officialDocument?.documentId, "585037");
  assert.equal(candidate?.officialDocument?.sourceUrl.includes("id=585037"), true);
  assert.equal(candidate?.candidateFacts.some((fact) => fact.includes("677773") && fact.includes("descartado")), true);
});

test("fontes secundárias não podem ser convertidas em evidência primária", () => {
  const invalid = structuredClone(rawLedger);
  invalid.candidates[0].locatorEvidence[0].sourceType = "primary_regulatory";

  assert.throws(
    () => loadEventVerificationLedger(invalid),
    /Localizador não pode ser tratado como fonte primária/,
  );
});

test("revisão manual incompleta é rejeitada", () => {
  const invalid = structuredClone(rawLedger);
  const candidate = invalid.candidates.find((item: { ticker: string }) => item.ticker === "VSLH11");
  candidate.status = "primary_content_verified";
  candidate.eligibleForCohortPromotion = true;
  candidate.officialDocument.referenceDate = "2023-12-29";
  candidate.officialDocument.publishedAt = "2024-01-15T18:00:00-03:00";
  candidate.eventDateCandidate = "2024-01-15T18:00:00-03:00";
  candidate.officialDocument.contentReview.status = "manually_verified";
  candidate.officialDocument.contentReview.page = 3;

  assert.throws(() => loadEventVerificationLedger(invalid), /Revisão manual incompleta/);
});

test("data candidata deve coincidir com a primeira data pública do documento", () => {
  const invalid = structuredClone(rawLedger);
  invalid.candidates[0].officialDocument.referenceDate = "2026-01-30";
  invalid.candidates[0].officialDocument.publishedAt = "2026-02-27T18:38:00-03:00";
  invalid.candidates[0].eventDateCandidate = "2026-01-30T00:00:00-03:00";

  assert.throws(
    () => loadEventVerificationLedger(invalid),
    /Data candidata deve ser a primeira data pública/,
  );
});

test("data e publishedAt não podem ser preenchidas separadamente", () => {
  const invalid = structuredClone(rawLedger);
  invalid.candidates[0].eventDateCandidate = "2026-02-27T18:38:00-03:00";

  assert.throws(
    () => loadEventVerificationLedger(invalid),
    /Data candidata e publishedAt devem ser confirmadas juntas/,
  );
});

test("MCCI11 e RBRY11 permanecem sem janela fabricada", () => {
  const ledger = loadEventVerificationLedger(rawLedger);
  for (const ticker of ["MCCI11", "RBRY11"]) {
    const candidate = ledger.candidates.find((item) => item.ticker === ticker);
    assert.equal(candidate?.status, "pending_document_location");
    assert.equal(candidate?.eventDateCandidate, null);
    assert.equal(candidate?.officialDocument, null);
  }
});
