import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { RiskSnapshot } from "../src/types/riskLab";
import { loadRiskDataset } from "../src/lib/risk-lab/DatasetLoader";
import { PRODUCTION_RISK_DATASET_RAW } from "../src/lib/risk-lab/productionDataset";
import { buildRiskLabReport, riskLabContentHash } from "../src/lib/risk-lab/RiskLabReportBuilder";
import { RiskRuleEngine } from "../src/lib/risk-lab/RuleEngine";
import { PILOT_RISK_RULES } from "../src/lib/risk-lab/rules";

const fixedGeneratedAt = "2026-07-18T08:00:00.000Z";
const engine = new RiskRuleEngine(PILOT_RISK_RULES);

function metric(metricName: string, value: number, confidence = 95) {
  return {
    metric: metricName,
    value,
    unit: metricName.includes("Percent") ? "PERCENT" : "BRL_PER_SHARE",
    competenceDate: "2024-11-30T23:59:59-03:00",
    knownAt: "2024-12-12T15:54:00-03:00",
    confidence,
    evidence: [],
  };
}

test("runtime production dataset is identical to the reviewed gold document", () => {
  const documentedRaw = JSON.parse(readFileSync(new URL("../docs/risk-lab/datasets/gold-hctr-tgar-v0.1.json", import.meta.url), "utf8"));
  const documented = loadRiskDataset(documentedRaw);
  const runtime = loadRiskDataset(PRODUCTION_RISK_DATASET_RAW);
  assert.equal(riskLabContentHash(runtime), riskLabContentHash(documented));
});

test("admin unit report produces the validated HCTR11 red alert with unambiguous metrics", () => {
  const report = buildRiskLabReport(PRODUCTION_RISK_DATASET_RAW, "hctr11", "ADMIN@example.com", fixedGeneratedAt);
  assert.equal(report.ticker, "HCTR11");
  assert.equal(report.assessment.prudentialAlert, "red");
  assert.equal(report.assessment.deteriorationAlert, "red");
  assert.equal(report.assessment.deteriorationSeverityScore, 100);
  assert.equal(report.assessment.deteriorationScore, 100);
  assert.equal(report.assessment.thesisHealthScore, 0);
  assert.equal(report.assessment.evidenceConfidence, 95);
  assert.equal(report.assessment.confidence, 95);
  assert.equal(report.assessment.managementTrustScore, null);
  assert.equal(report.assessment.hits.some((hit) => hit.ruleId === "HY-003"), true);
  assert.equal(report.evidence.length, 2);
  assert.equal(report.evidence.every((item) => item.sourceType === "primary_regulatory" && item.page === 3), true);
  assert.equal(report.dataset.scope, "admin_unit_test_only");
  assert.equal(report.ruleSet.status, "frozen_out_of_sample_validation");
  assert.equal(report.premiumIntegrated, false);
  assert.equal(report.notificationsSent, false);
  assert.match(report.reportMarkdown, /HY-003/);
  assert.match(report.reportMarkdown, /não apresentou resultado no mês/i);
  assert.match(report.reportMarkdown, /Severidade da deterioração:\*\* 100\/100/i);
  assert.match(report.reportMarkdown, /Saúde estimada da tese:\*\* 0\/100/i);
  assert.match(report.reportMarkdown, /Confiança nas evidências e no diagnóstico:\*\* 95%/i);
  assert.match(report.reportMarkdown, /Confiança na gestão:\*\* não calculada/i);
  assert.match(report.id, /^risk-HCTR11-/);
});

test("production builder blocks TGAR11 and unapproved data", () => {
  assert.throws(
    () => buildRiskLabReport(PRODUCTION_RISK_DATASET_RAW, "TGAR11", "admin@example.com", fixedGeneratedAt),
    /não autorizado/,
  );

  const unapproved = structuredClone(PRODUCTION_RISK_DATASET_RAW as Record<string, unknown>) as any;
  unapproved.metadata.productionApproved = false;
  delete unapproved.metadata.productionApproval;
  assert.throws(
    () => buildRiskLabReport(unapproved, "HCTR11", "admin@example.com", fixedGeneratedAt),
    /não aprovado/,
  );
});

test("healthy high-yield control keeps high thesis health without generating red", () => {
  const snapshot: RiskSnapshot = {
    ticker: "CTRL11",
    family: "credit_high_yield",
    asOf: "2024-12-12T15:54:00-03:00",
    structuralRiskScore: 50,
    observations: {
      currentAssetsPercent: metric("currentAssetsPercent", 92),
      graceAssetsPercent: metric("graceAssetsPercent", 5),
      defaultedAssetsPercent: metric("defaultedAssetsPercent", 3),
      cashResultPerShare: metric("cashResultPerShare", 0.95),
      dividendPerShare: metric("dividendPerShare", 0.85),
    },
  };
  const assessment = engine.evaluate(snapshot);
  assert.equal(assessment.deteriorationAlert, "green");
  assert.notEqual(assessment.prudentialAlert, "red");
  assert.equal(assessment.deteriorationSeverityScore, 0);
  assert.equal(assessment.thesisHealthScore, 100);
  assert.equal(assessment.managementTrustScore, null);
});

test("reversible stressed control can become orange without being forced to red", () => {
  const snapshot: RiskSnapshot = {
    ticker: "STRE11",
    family: "credit_high_yield",
    asOf: "2024-12-12T15:54:00-03:00",
    structuralRiskScore: 78,
    observations: {
      currentAssetsPercent: metric("currentAssetsPercent", 24),
      graceAssetsPercent: metric("graceAssetsPercent", 64),
      defaultedAssetsPercent: metric("defaultedAssetsPercent", 12),
      cashResultPerShare: metric("cashResultPerShare", 0.72),
      dividendPerShare: metric("dividendPerShare", 0.65),
    },
  };
  const assessment = engine.evaluate(snapshot);
  assert.equal(assessment.deteriorationAlert, "orange");
  assert.equal(assessment.prudentialAlert, "orange");
  assert.equal(assessment.deteriorationSeverityScore, 85);
  assert.equal(assessment.thesisHealthScore, 15);
  assert.equal(assessment.hits.some((hit) => hit.ruleId === "HY-003"), false);
});
