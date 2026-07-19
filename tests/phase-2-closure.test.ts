import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Native strip-types requires an explicit .ts extension at runtime.
import {
  basicFundEvidence,
  evaluateCatalogAudit,
  evaluateCatalogPreview,
  evidenceHash,
  misleadingMissingDataClaims,
  selectStratifiedSamples,
} from "../src/lib/phase2/Phase2ClosurePolicy.ts";
import type { FundCatalogAudit, FundCatalogDirectory, FundCatalogRun } from "../src/types/fund-catalog.ts";
import type { PublicFundData } from "../src/types/regulatory.ts";

const run = (overrides: Partial<FundCatalogRun> = {}): FundCatalogRun => ({
  id: "catalog-20260719-abcdef123456",
  status: "preview",
  mode: "official-backfill",
  actor: "cron:phase2-closure",
  createdAt: "2026-07-19T21:00:00.000Z",
  appliedAt: null,
  failedAt: null,
  error: null,
  sourceHash: "a".repeat(64),
  planHash: "b".repeat(64),
  approvalHash: "c".repeat(64),
  sources: [],
  coverage: {
    b3Candidates: 511,
    matchedCandidates: 511,
    unmatchedCandidates: 0,
    sourceMatchPercent: 100,
    activeFunds: 504,
    inactiveFunds: 4,
    underReviewFunds: 3,
    basicComplete: 504,
    basicCoveragePercent: 100,
    essentialApplicable: 502,
    essentialComplete: 491,
    essentialCoveragePercent: 97.81,
    duplicateCnpjGroups: 0,
  },
  acceptance: { basicTargetPercent: 100, essentialTargetPercent: 95, sourceMatchTargetPercent: 100, meetsTargets: true, gaps: [] },
  safety: { safeToApply: true, destructiveChangesAllowed: true, blockers: [], sentinelsPresent: true },
  totals: { planned: 511, added: 500, updated: 7, inactivated: 4, reactivated: 0, unchanged: 0 },
  reviewSamples: [],
  chunks: 13,
  appliedItems: 0,
  verifiedAt: null,
  ...overrides,
});

const directory: FundCatalogDirectory = {
  schemaVersion: 2,
  runId: run().id,
  generatedAt: "2026-07-19T21:10:00.000Z",
  total: 504,
  items: [
    { ticker: "MXRF11", name: "Maxi Renda", legalName: "MAXI RENDA FII", kind: "FII", sector: "Papel", segment: "Recebíveis", status: "active" },
    { ticker: "VGIA11", name: "Valora CRA", legalName: "VALORA CRA FIAGRO", kind: "FIAGRO", sector: "Agronegócio", segment: "Crédito", status: "active" },
    { ticker: "BODB11", name: "Bocaina", legalName: "BOCAINA INFRA", kind: "FI_INFRA", sector: "Infraestrutura", segment: "Debêntures", status: "active" },
  ],
};

const audit: FundCatalogAudit = {
  generatedAt: directory.generatedAt,
  runId: run().id,
  totalCatalogDocuments: 511,
  activeDocuments: 504,
  basicCoveragePercent: 100,
  essentialCoveragePercent: 97.81,
  duplicateCnpjGroups: 0,
  missingBasic: [],
  missingEssential: [{ ticker: "EXAMPLE11", fields: ["composição PF/PJ"] }],
  staleOrInactive: [],
  acceptanceMet: true,
};

test("Sprint 2.12 accepts only a complete and safe official preview", () => {
  const accepted = evaluateCatalogPreview(run());
  assert.deepEqual(accepted.blockers, []);
  assert.ok(accepted.checks.every((item) => item.status === "passed"));

  const rejected = evaluateCatalogPreview(run({
    coverage: { ...run().coverage, basicCoveragePercent: 99.9, duplicateCnpjGroups: 1 },
    safety: { ...run().safety, destructiveChangesAllowed: false },
  }));
  assert.ok(rejected.blockers.length >= 3);
  assert.ok(rejected.checks.some((item) => item.id === "catalog.basic-coverage" && item.status === "failed"));
  assert.ok(rejected.checks.some((item) => item.id === "catalog.duplicate-cnpj" && item.status === "failed"));
  assert.ok(rejected.checks.some((item) => item.id === "catalog.destructive-safety" && item.status === "failed"));
});

test("post-load double check ties audit and directory to the approved run", () => {
  assert.deepEqual(evaluateCatalogAudit(audit, directory, run().id).blockers, []);
  const rejected = evaluateCatalogAudit({ ...audit, missingBasic: [{ ticker: "MISS11", fields: ["CNPJ"] }], basicCoveragePercent: 99.8 }, { ...directory, total: 503 }, run().id);
  assert.ok(rejected.blockers.length >= 2);
});

test("smoke selection is stratified and deterministic", () => {
  assert.deepEqual(selectStratifiedSamples(directory), [
    { ticker: "MXRF11", kind: "FII" },
    { ticker: "VGIA11", kind: "FIAGRO" },
    { ticker: "BODB11", kind: "FI_INFRA" },
  ]);
});

test("AI validation rejects false claims about basic data that is present", () => {
  const fund = {
    code: "MXRF11",
    ticker: "MXRF11",
    fundKind: "FII",
    cnpj: "97.521.225/0001-25",
    corporateName: "MAXI RENDA FII",
    manager: "XP VISTA ASSET MANAGEMENT",
    administrator: "BTG PACTUAL DTVM",
    regulatoryMeta: { schemaVersion: 1, currentVersion: 1, cache: "miss", sources: [], validation: { valid: true, issues: [] } },
  } as PublicFundData;
  const evidence = basicFundEvidence(fund);
  assert.ok(Object.values(evidence).every(Boolean));
  assert.deepEqual(misleadingMissingDataClaims("O CNPJ está ausente e o gestor não foi identificado.", evidence), [
    "CNPJ informado foi descrito como ausente.",
    "Gestor informado foi descrito como ausente.",
  ]);
  assert.deepEqual(misleadingMissingDataClaims("O CNPJ, o gestor e o administrador estão identificados.", evidence), []);
});

test("evidence hash is stable regardless of object key order", () => {
  assert.equal(evidenceHash({ b: 2, a: { d: 4, c: 3 } }), evidenceHash({ a: { c: 3, d: 4 }, b: 2 }));
});
