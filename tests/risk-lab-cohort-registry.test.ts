import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertOutOfSampleCohortReady,
  loadOutOfSampleCohort,
} from "../src/lib/risk-lab/ValidationCohortLoader";

const cohortPath = new URL("../src/lib/risk-lab/out-of-sample-cohort-v0.1.json", import.meta.url);
const raw = JSON.parse(readFileSync(cohortPath, "utf8"));

function cohortIdentityHash() {
  const cohort = loadOutOfSampleCohort(raw);
  const bombDefinition = cohort.cases.find((item) => item.role === "severe_deterioration")?.bomb?.definition;
  const stressDefinition = cohort.cases.find((item) => item.role === "reversible_stress")?.stress?.definition;
  const identity = {
    id: cohort.metadata.id,
    version: cohort.metadata.version,
    rulesetVersion: cohort.metadata.rulesetVersion,
    registeredAt: cohort.metadata.registeredAt,
    cases: cohort.cases.map((item) => [item.ticker, item.role]),
    bombDefinition,
    stressDefinition,
  };

  const stable = JSON.stringify(identity, Object.keys(identity).sort());
  return createHash("sha256").update(stable, "utf8").digest("hex");
}

test("coorte externa possui seis fundos balanceados e exclui casos de desenvolvimento", () => {
  const cohort = loadOutOfSampleCohort(raw);
  const counts = cohort.cases.reduce<Record<string, number>>((acc, item) => {
    acc[item.role] = (acc[item.role] || 0) + 1;
    return acc;
  }, {});

  assert.equal(cohort.cases.length, 6);
  assert.equal(counts.severe_deterioration, 2);
  assert.equal(counts.healthy_control, 2);
  assert.equal(counts.reversible_stress, 2);
  assert.equal(cohort.cases.some((item) => item.ticker === "HCTR11"), false);
  assert.equal(cohort.cases.some((item) => item.ticker === "TGAR11"), false);
});

test("identidade pré-registrada da coorte não pode mudar silenciosamente", () => {
  assert.equal(
    cohortIdentityHash(),
    "620c26abbf30b4f96ef3de9dbfd8eb6c7b9e6d1fe56851d70079d39d0f490fd1",
  );
});

test("coorte permanece bloqueada até verificação de eventos em fonte primária", () => {
  const cohort = loadOutOfSampleCohort(raw);
  assert.equal(cohort.metadata.executionAllowed, false);
  assert.equal(cohort.metadata.status, "pre_registered_pending_primary_verification");
  assert.throws(
    () => assertOutOfSampleCohortReady(cohort),
    /Coorte bloqueada para execução/,
  );
});

test("nenhuma extração começou antes do congelamento de datas e fontes", () => {
  const cohort = loadOutOfSampleCohort(raw);
  assert.deepEqual(
    cohort.cases.filter((item) => item.dataExtractionStarted),
    [],
  );
});

test("liberação artificial sem fontes primárias é rejeitada", () => {
  const invalid = structuredClone(raw);
  invalid.metadata.executionAllowed = true;
  invalid.metadata.status = "ready_for_execution";

  assert.throws(
    () => loadOutOfSampleCohort(invalid),
    /Coorte bloqueada para execução/,
  );
});
