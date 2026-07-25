import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  RiskLabRulesetV020,
  dispositionForDividendStressStatus,
  loadRiskLabRulesetV020Config,
} from "@/lib/risk-lab/RiskLabRulesetV020";
import { buildFrozenCalibrationPhase36 } from "@/lib/risk-lab/FrozenCalibrationPhase36";
import type { VerifiedDividendNotice, VerifiedMaterialCreditEvent } from "@/types/riskLabDividendStress";

const CONFIG = "src/lib/risk-lab/risk-lab-ruleset-v0.2.0.json";

function monthAfter(startYear: number, startMonth: number, offset: number) {
  const zeroBased = startYear * 12 + startMonth - 1 + offset;
  const year = Math.floor(zeroBased / 12);
  const month = zeroBased % 12 + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function series(values: number[]): VerifiedDividendNotice[] {
  return values.map((amount, index) => {
    const competenceMonth = monthAfter(2022, 1, index);
    const announcementMonth = monthAfter(2022, 2, index);
    return {
      ticker: "TEST11",
      competenceMonth,
      amountPerShare: amount,
      announcedAt: `${announcementMonth}-01T10:00:00-03:00`,
      source: {
        documentId: String(1000 + index),
        sourceUrl: `https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id=${1000 + index}`,
        sourceType: "primary_regulatory",
        reviewMethod: "automatic_regulatory_validation",
        reviewedBy: "risk-lab-test-v0.2.0",
        reviewedAt: "2026-07-25T00:00:00-03:00",
        page: 1,
        excerpt: `Rendimento ${competenceMonth}`,
        sourceHash: "a".repeat(64),
        sourceVersion: "1",
        protocolHash: "b".repeat(64),
        protocolVersion: 1,
      },
    };
  });
}

function event(knownAt: string): VerifiedMaterialCreditEvent {
  return {
    ticker: "TEST11",
    knownAt,
    type: "default",
    documentId: "EVENT-1",
    sourceUrl: "https://fnet.bmfbovespa.com.br/fnet/publico/downloadDocumento?id=9999",
    reviewedBy: "risk-lab-test-v0.2.0",
    reviewedAt: "2026-07-25T00:00:00-03:00",
  };
}

test("configuração v0.2.0 preserva estrutura, dataset e espaço limitado", () => {
  const config = loadRiskLabRulesetV020Config();
  assert.equal(config.rulesetVersion, "0.2.0");
  assert.equal(config.sourceRulesetVersion, "0.1.0");
  assert.deepEqual(config.structure, { baselineMonths: 6, stressMonths: 3, recoveryMonths: 3 });
  assert.deepEqual(config.candidateSpace.stressThresholds, [0.8]);
  assert.equal(config.candidateSpace.recoveryThresholds.length, 10);
  assert.equal(config.selectedParameters.recoveryThreshold, 0.89);
  assert.equal(config.candidateSpace.minimumRecoveryDecisionMargin, 0.005);
  assert.equal(config.policy.externalEffectsAllowed, false);
});

test("recuperação acima de 89% vira informação sem alerta de risco", () => {
  const notices = series([
    1.13, 1.13, 1.13, 1.13, 1.13, 1.13,
    0.7, 0.7, 0.71,
    1.016, 1.017, 1.017,
  ]);
  const result = new RiskLabRulesetV020().evaluate(notices);
  assert.equal(result.window.status, "reversible_stress_confirmed");
  assert.equal(result.window.recoveryPercentOfBaseline, 89.97);
  assert.equal(result.disposition, "informational_recovery");
  assert.equal(result.riskAlert, false);
  assert.equal(result.externalEffectsAllowed, false);
});

test("evento material conhecido antes da recuperação bloqueia a liberação do risco", () => {
  const notices = series([
    1.13, 1.13, 1.13, 1.13, 1.13, 1.13,
    0.7, 0.7, 0.71,
    1.016, 1.017, 1.017,
  ]);
  const creditEvent = event("2022-11-15T10:00:00-03:00");
  const result = new RiskLabRulesetV020().evaluate(notices, [creditEvent]);
  assert.equal(result.window.status, "recovery_blocked_by_material_credit_event");
  assert.equal(result.disposition, "elevated_risk");
  assert.equal(result.riskAlert, true);
});

test("corte temporal não disponibiliza anúncio nem evento futuro", () => {
  const notices = series([
    1.13, 1.13, 1.13, 1.13, 1.13, 1.13,
    0.7, 0.7, 0.71,
    1.016, 1.017, 1.017,
  ]);
  const creditEvent = event("2023-01-15T10:00:00-03:00");
  const ruleset = new RiskLabRulesetV020();
  const beforeRecovery = ruleset.evaluateAsOf(notices, [creditEvent], notices[8].announcedAt);
  assert.equal(beforeRecovery.window.status, "stress_without_recovery");
  assert.equal(beforeRecovery.window.recoveryDetectedAt, null);
  assert.equal(beforeRecovery.riskAlert, true);
  const afterRecovery = ruleset.evaluateAsOf(notices, [creditEvent], notices[11].announcedAt);
  assert.equal(afterRecovery.window.status, "reversible_stress_confirmed");
  assert.equal(afterRecovery.riskAlert, false);
});

test("configuração adulterada falha fechado", () => {
  const folder = mkdtempSync(path.join(tmpdir(), "risk-lab-ruleset-v020-"));
  try {
    const config = JSON.parse(readFileSync(CONFIG, "utf8"));
    config.selectedParameters.recoveryThreshold = 0.9;
    const file = path.join(folder, "ruleset.json");
    writeFileSync(file, JSON.stringify(config));
    assert.throws(() => loadRiskLabRulesetV020Config(process.cwd(), file), /recuperação selecionado divergente/);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("política de disposição é geral e não contém exceção por ticker", () => {
  assert.equal(dispositionForDividendStressStatus("no_qualifying_stress"), "none");
  assert.equal(dispositionForDividendStressStatus("reversible_stress_confirmed"), "informational_recovery");
  assert.equal(dispositionForDividendStressStatus("stress_without_recovery"), "elevated_risk");
  assert.equal(dispositionForDividendStressStatus("recovery_blocked_by_material_credit_event"), "elevated_risk");
  const source = readFileSync("src/lib/risk-lab/RiskLabRulesetV020.ts", "utf8");
  assert.doesNotMatch(source, /DEVA11|VSLH11|KNCR11|KNSC11|MCCI11|RBRY11/);
});

test("dataset real homologa v0.2.0 com validação fora da amostra", () => {
  const run1 = buildFrozenCalibrationPhase36();
  const run2 = buildFrozenCalibrationPhase36();
  assert.equal(run1.evidenceHash, run2.evidenceHash);
  assert.equal(run1.rulesetConfigHash, run2.rulesetConfigHash);
  assert.equal(run1.status, "homologated");
  assert.equal(run1.homologationAllowed, true);
  assert.equal(run1.rulesetVersion, "0.2.0");
  assert.deepEqual(run1.selectedParameters, {
    stressThreshold: 0.8,
    recoveryThreshold: 0.89,
    minimumRecoveryDecisionMargin: 0.005,
  });
  assert.deepEqual(run1.metrics, {
    totalCases: 6,
    verifiedCases: 5,
    correctVerified: 5,
    inconclusiveCases: 1,
    verifiedAccuracyPercent: 100,
    coveragePercent: 83.33,
    falsePositives: 0,
    falseNegatives: 0,
    riskAlerts: 2,
    informationalRecoveries: 2,
    noSignalCases: 2,
  });
  assert.deepEqual(Object.fromEntries(run1.cases.map((item) => [item.ticker, item.disposition])), {
    DEVA11: "elevated_risk",
    VSLH11: "elevated_risk",
    KNCR11: "none",
    KNSC11: "informational_recovery",
    MCCI11: "none",
    RBRY11: "informational_recovery",
  });
  assert.deepEqual(Object.fromEntries(run1.cases.map((item) => [item.ticker, item.outcome])), {
    DEVA11: "verified_correct",
    VSLH11: "verified_correct",
    KNCR11: "verified_correct",
    KNSC11: "verified_correct",
    MCCI11: "inconclusive_unscored",
    RBRY11: "verified_correct",
  });
  assert.ok(run1.leaveOneCaseOut.every((fold) => fold.selectedRecoveryThreshold === 0.89));
  assert.ok(run1.leaveOneCaseOut.every((fold) => fold.holdoutCorrect));
  assert.ok(run1.leaveOneCaseOut.every((fold) => fold.selectedCandidateStable));
  assert.equal(run1.cases.find((item) => item.ticker === "MCCI11")?.scored, false);
  assert.ok(run1.cases.every((item) => !item.lookAheadDetected));
  assert.equal(run1.premiumIntegrated, false);
  assert.equal(run1.notificationsSent, false);
  assert.deepEqual(run1.blockers, []);
});
