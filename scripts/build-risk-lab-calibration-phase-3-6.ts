import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  buildFrozenCalibrationPhase36,
  type CalibrationCaseResult,
} from "@/lib/risk-lab/FrozenCalibrationPhase36";
import { hashValue } from "@/lib/risk-lab/FrozenCohortPhaseC";

const ROOT = process.cwd();
const OUTPUT = "docs/production-evidence/risk-lab/calibration-phase-3-6";
const CONFIG_PATH = "src/lib/risk-lab/risk-lab-ruleset-v0.2.0.json";
const MANIFEST_PATH = "docs/production-evidence/risk-lab/calibration-phase-3-6-manifest.json";
const PHASE_C_INDEX_PATH = "docs/production-evidence/risk-lab/cohort-phase-c/index.json";

function writeJson(file: string, value: unknown) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

const run1 = buildFrozenCalibrationPhase36(ROOT, CONFIG_PATH);
const run2 = buildFrozenCalibrationPhase36(ROOT, CONFIG_PATH);
if (run1.evidenceHash !== run2.evidenceHash || run1.rulesetConfigHash !== run2.rulesetConfigHash) {
  throw new Error("As duas execuções independentes da Sprint 3.6 produziram hashes diferentes.");
}
if (run1.status !== "homologated" || !run1.homologationAllowed || run1.blockers.length > 0) {
  throw new Error(`O ruleset v0.2.0 não foi homologado: ${run1.blockers.join(" ")}`);
}

const ruleset = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const phaseCIndex = JSON.parse(readFileSync(PHASE_C_INDEX_PATH, "utf8"));
const candidateSpaceCore = {
  schemaVersion: 1,
  phase: "3.6",
  rulesetVersion: run1.rulesetVersion,
  sourceRulesetVersion: run1.sourceRulesetVersion,
  datasetHash: run1.datasetHash,
  cohortIdentityHash: run1.cohortIdentityHash,
  structure: ruleset.structure,
  candidateSpace: ruleset.candidateSpace,
  selection: ruleset.selection,
  policy: ruleset.policy,
  selectedParameters: run1.selectedParameters,
  candidates: run1.candidateSummaries,
  leaveOneCaseOut: run1.leaveOneCaseOut,
};
const candidateSpace = { ...candidateSpaceCore, evidenceHash: hashValue(candidateSpaceCore) };
const reportHash = hashValue(run1);
const rulesetHash = hashValue(ruleset);
const indexCore = {
  schemaVersion: 1,
  phase: "3.6",
  status: run1.status,
  sourceRulesetVersion: run1.sourceRulesetVersion,
  rulesetVersion: run1.rulesetVersion,
  datasetId: run1.datasetId,
  datasetVersion: run1.datasetVersion,
  datasetHash: run1.datasetHash,
  cohortIdentityHash: run1.cohortIdentityHash,
  sourcePhaseCIndexEvidenceHash: phaseCIndex.evidenceHash,
  execution: {
    runs: 2,
    run1: {
      evidenceHash: run1.evidenceHash,
      reportHash,
      rulesetConfigHash: run1.rulesetConfigHash,
    },
    run2: {
      evidenceHash: run2.evidenceHash,
      reportHash: hashValue(run2),
      rulesetConfigHash: run2.rulesetConfigHash,
    },
    hashesMatch: true,
  },
  selectedParameters: run1.selectedParameters,
  result: {
    metrics: run1.metrics,
    homologationAllowed: run1.homologationAllowed,
    blockers: run1.blockers,
    premiumIntegrated: run1.premiumIntegrated,
    notificationsSent: run1.notificationsSent,
  },
  files: {
    ruleset: { file: `${OUTPUT}/ruleset.json`, hash: rulesetHash },
    candidateSpace: { file: `${OUTPUT}/candidate-space.json`, hash: candidateSpace.evidenceHash },
    report: { file: `${OUTPUT}/calibration-report.json`, hash: reportHash },
  },
};
const index = { ...indexCore, evidenceHash: hashValue(indexCore) };
const manifest = {
  schemaVersion: 1,
  phase: "3.6",
  status: "complete",
  expected: {
    sourceRulesetVersion: "0.1.0",
    rulesetVersion: "0.2.0",
    datasetHash: run1.datasetHash,
    cohortIdentityHash: run1.cohortIdentityHash,
    rulesetConfigHash: run1.rulesetConfigHash,
    candidateSpaceHash: run1.candidateSpaceHash,
    selectedParameters: run1.selectedParameters,
    reportEvidenceHash: run1.evidenceHash,
    reportFileHash: reportHash,
    candidateSpaceEvidenceHash: candidateSpace.evidenceHash,
    indexEvidenceHash: index.evidenceHash,
    metrics: run1.metrics,
    outcomes: Object.fromEntries(run1.cases.map((item) => [item.ticker, item.outcome])),
    dispositions: Object.fromEntries(run1.cases.map((item) => [item.ticker, item.disposition])),
    foldThresholds: Object.fromEntries(run1.leaveOneCaseOut.map((item) => [item.holdoutTicker, item.selectedRecoveryThreshold])),
  },
};

mkdirSync(OUTPUT, { recursive: true });
writeJson(`${OUTPUT}/ruleset.json`, ruleset);
writeJson(`${OUTPUT}/candidate-space.json`, candidateSpace);
writeJson(`${OUTPUT}/calibration-report.json`, run1);
writeJson(`${OUTPUT}/index.json`, index);
writeJson(MANIFEST_PATH, manifest);

const dispositionLabel: Record<CalibrationCaseResult["disposition"], string> = {
  none: "sem sinal",
  informational_recovery: "recuperação informativa, sem alerta de risco",
  elevated_risk: "alerta de risco elevado",
};
const outcomeLabel: Record<CalibrationCaseResult["outcome"], string> = {
  verified_correct: "correto",
  verified_false_positive: "falso positivo",
  verified_false_negative: "falso negativo",
  inconclusive_unscored: "inconclusivo, fora da otimização",
};
const percent = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dossier = `# Sprint 3.6 — Calibração e homologação do ruleset

**Status:** \`${run1.status}\`
**Ruleset de origem:** v${run1.sourceRulesetVersion}
**Ruleset homologado:** v${run1.rulesetVersion}
**Dataset preservado:** \`${run1.datasetId}\` v${run1.datasetVersion}
**Hash do dataset:** \`${run1.datasetHash}\`

## Decisão executiva

O ruleset v0.2.0 foi homologado exclusivamente para uso metodológico offline. A estrutura 6–3–3 e o limiar de estresse de 80% foram preservados. O limiar de recuperação passou de 90% para 89%, com margem mínima de decisão de 0,5 ponto percentual e validação leave-one-verified-case-out.

A mudança não cria uma exceção para KNSC11. O novo contrato separa uma recuperação reversível sem evento material — informação útil, mas sem alerta de risco — de estresse persistente ou recuperação bloqueada por evento material, que permanecem como risco elevado.

## Resultado por fundo

| Fundo | Papel congelado | Estado final | Disposição | Avaliação |
|---|---|---|---|---|
${run1.cases.map((item) => `| ${item.ticker} | ${item.role} | ${item.finalStatus} | ${dispositionLabel[item.disposition]} | ${outcomeLabel[item.outcome]} |`).join("\n")}

## Validação fora da amostra

Todos os cinco folds leave-one-verified-case-out selecionaram o mesmo limiar de recuperação de 89% e classificaram corretamente o fundo mantido fora do ajuste:

${run1.leaveOneCaseOut.map((item) => `- ${item.holdoutTicker}: threshold ${percent.format(item.selectedRecoveryThreshold * 100)}%, holdout correto = ${item.holdoutCorrect ? "sim" : "não"};`).join("\n")}

## Métricas de homologação

- casos totais: ${run1.metrics.totalCases};
- casos verificáveis: ${run1.metrics.verifiedCases};
- corretos entre verificáveis: ${run1.metrics.correctVerified};
- acurácia nos verificáveis: ${percent.format(run1.metrics.verifiedAccuracyPercent)}%;
- cobertura da verdade-terreno: ${percent.format(run1.metrics.coveragePercent)}%;
- falsos positivos: ${run1.metrics.falsePositives};
- falsos negativos: ${run1.metrics.falseNegatives};
- casos inconclusivos: ${run1.metrics.inconclusiveCases}.

## Tratamento do MCCI11

O MCCI11 continua com verdade-terreno inconclusiva e não foi usado para escolher parâmetros, calcular acurácia ou melhorar artificialmente o resultado. O caso permanece no relatório como \`inconclusive_unscored\`, com rastreabilidade integral.

## Segurança metodológica

- dataset e identidade da coorte conferidos pelos hashes da 3.5-C;
- falhas originais da 3.5-C preservadas no histórico;
- nenhum look-ahead nos casos ou folds;
- espaço de busca limitado a 10 candidatos de recuperação;
- nenhum parâmetro escolhido por ticker;
- duas execuções independentes com hashes idênticos;
- Premium e notificações permanecem desabilitados.

## Hashes

- configuração do ruleset: \`${run1.rulesetConfigHash}\`;
- espaço de candidatos: \`${run1.candidateSpaceHash}\`;
- relatório de calibração: \`${run1.evidenceHash}\`;
- índice da evidência: \`${index.evidenceHash}\`.

## Decisão de produto

A homologação metodológica da Sprint 3.6 não integra automaticamente o Risk Lab ao produto. A próxima unidade é a Sprint 3.7 — integração read-only no Relatório Premium e Prompt Premium v3, que exige feature flag, contrato de interpretação, fallback, rollback e testes próprios.
`;
writeFileSync("docs/risk-lab/sprint-3-6-calibration.md", dossier);

console.log(JSON.stringify({
  status: run1.status,
  rulesetVersion: run1.rulesetVersion,
  selectedParameters: run1.selectedParameters,
  evidenceHash: run1.evidenceHash,
  indexEvidenceHash: index.evidenceHash,
  metrics: run1.metrics,
  outcomes: manifest.expected.outcomes,
  dispositions: manifest.expected.dispositions,
}, null, 2));
