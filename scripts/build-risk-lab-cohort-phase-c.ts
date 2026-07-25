import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildFrozenCohortPhaseC, hashValue } from "@/lib/risk-lab/FrozenCohortPhaseC";

const ROOT = process.cwd();
const OUTPUT = "docs/production-evidence/risk-lab/cohort-phase-c";
const REGISTRY_PATH = "src/lib/risk-lab/frozen-cohort-phase-c-v1.json";
const MANIFEST_PATH = "docs/production-evidence/risk-lab/cohort-phase-c-manifest.json";

function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const run1 = buildFrozenCohortPhaseC(ROOT, REGISTRY_PATH);
const run2 = buildFrozenCohortPhaseC(ROOT, REGISTRY_PATH);
if (run1.evidenceHash !== run2.evidenceHash || run1.datasetHash !== run2.datasetHash) {
  throw new Error("As duas execuções independentes da 3.5-C produziram hashes diferentes.");
}
if (run1.methodologicalBlockers.length > 0 || run1.status === "blocked") {
  throw new Error(`A metodologia da 3.5-C está bloqueada: ${run1.methodologicalBlockers.join(" ")}`);
}

const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
const registryHash = hashValue(registry);
const datasetCore = {
  schemaVersion: 1,
  phase: "3.5-C",
  datasetId: run1.datasetId,
  datasetVersion: run1.datasetVersion,
  rulesetVersion: run1.rulesetVersion,
  evaluatedAt: run1.evaluatedAt,
  cohortIdentityHash: run1.cohortIdentityHash,
  datasetHash: run1.datasetHash,
  observationCount: run1.observationCount,
  cases: run1.cases.map((item) => ({
    ticker: item.ticker,
    role: item.role,
    indexPath: item.indexPath,
    indexEvidenceHash: item.indexEvidenceHash,
    combinedObservationsHash: item.combinedObservationsHash,
    observations: item.observations,
    missingMonths: item.missingMonths,
    longestContiguousSequence: item.longestContiguousSequence,
  })),
};
const datasetIndex = { ...datasetCore, datasetIndexHash: hashValue(datasetCore) };
const reportFileHash = hashValue(run1);
const indexCore = {
  schemaVersion: 1,
  phase: "3.5-C",
  status: run1.status,
  datasetId: run1.datasetId,
  datasetVersion: run1.datasetVersion,
  methodologyVersion: run1.methodologyVersion,
  rulesetVersion: run1.rulesetVersion,
  evaluatedAt: run1.evaluatedAt,
  sourceArtifacts: registry.provenance,
  execution: {
    runs: 2,
    run1: { datasetHash: run1.datasetHash, evidenceHash: run1.evidenceHash, reportFileHash },
    run2: { datasetHash: run2.datasetHash, evidenceHash: run2.evidenceHash, reportFileHash: hashValue(run2) },
    hashesMatch: true,
  },
  result: {
    observationCount: run1.observationCount,
    cohortIdentityHash: run1.cohortIdentityHash,
    datasetHash: run1.datasetHash,
    metrics: run1.metrics,
    performanceFindings: run1.performanceFindings,
    methodologicalBlockers: run1.methodologicalBlockers,
    calibrationRequired: run1.calibrationRequired,
    homologationAllowed: run1.homologationAllowed,
    premiumIntegrated: run1.premiumIntegrated,
    notificationsSent: run1.notificationsSent,
  },
  files: {
    registry: { file: `${OUTPUT}/registry.json`, hash: registryHash },
    dataset: { file: `${OUTPUT}/dataset-index.json`, hash: datasetIndex.datasetIndexHash },
    backtest: { file: `${OUTPUT}/backtest-report.json`, hash: reportFileHash },
  },
};
const index = { ...indexCore, evidenceHash: hashValue(indexCore) };
const manifest = {
  schemaVersion: 1,
  phase: "3.5-C",
  status: "complete",
  expected: {
    cohortIdentityHash: run1.cohortIdentityHash,
    datasetHash: run1.datasetHash,
    observationCount: run1.observationCount,
    registryHash,
    datasetIndexHash: datasetIndex.datasetIndexHash,
    backtestEvidenceHash: run1.evidenceHash,
    backtestReportHash: reportFileHash,
    indexEvidenceHash: index.evidenceHash,
    metrics: run1.metrics,
    outcomes: Object.fromEntries(run1.cases.map((item) => [item.ticker, item.outcome])),
  },
};

mkdirSync(OUTPUT, { recursive: true });
writeJson(`${OUTPUT}/registry.json`, registry);
writeJson(`${OUTPUT}/dataset-index.json`, datasetIndex);
writeJson(`${OUTPUT}/backtest-report.json`, run1);
writeJson(`${OUTPUT}/index.json`, index);
writeJson(MANIFEST_PATH, manifest);

const outcomeLabel: Record<string, string> = {
  true_positive: "verdadeiro positivo",
  true_negative: "verdadeiro negativo",
  false_positive: "falso positivo",
  false_negative: "falso negativo",
  inconclusive: "inconclusivo",
};
const percent = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dossier = `# Sprint 3.5-C — Dataset imutável e backtest sem look-ahead

**Status:** \`${run1.status}\`  
**Ruleset avaliado:** v${run1.rulesetVersion}, mantido sem calibração  
**Dataset:** \`${run1.datasetId}\` v${run1.datasetVersion}  
**Observações:** ${run1.observationCount}  
**Cobertura conclusiva:** ${percent.format(run1.metrics.coveragePercent)}%

## Resultado executivo

A metodologia da 3.5-C passou sem bloqueadores: os seis casos foram recompostos exclusivamente das evidências imutáveis versionadas no Git, os hashes individuais e consolidados conferiram e nenhum ponto do backtest utilizou informação posterior à data simulada.

O desempenho, porém, exige calibração na Sprint 3.6. O ruleset v0.1.0 produziu um falso positivo no KNSC11 e o MCCI11 permaneceu inconclusivo porque sua série congelada não confirmou a janela pré-registrada de estresse reversível. Nenhuma regra foi alterada para melhorar artificialmente o resultado.

## Resultado por fundo

| Fundo | Papel pré-registrado | Resultado | Primeiro sinal | Referência primária |
|---|---|---|---|---|
${run1.cases.map((item) => `| ${item.ticker} | ${item.role} | ${outcomeLabel[item.outcome]} | ${item.firstSignalAt || "—"} | ${item.groundTruth.eventAt || item.groundTruth.recoveryAt || "inconclusiva"} |`).join("\n")}

## Métricas

- casos totais: ${run1.metrics.totalCases};
- conclusivos: ${run1.metrics.conclusiveCases};
- verdadeiros positivos: ${run1.metrics.truePositives};
- verdadeiros negativos: ${run1.metrics.trueNegatives};
- falsos positivos: ${run1.metrics.falsePositives};
- falsos negativos: ${run1.metrics.falseNegatives};
- inconclusivos: ${run1.metrics.inconclusiveCases};
- cobertura: ${percent.format(run1.metrics.coveragePercent)}%;
- lead time médio: ${run1.metrics.averageLeadTimeDays === null ? "não aplicável" : `${percent.format(run1.metrics.averageLeadTimeDays)} dias`}.

## Evidência primária

- DEVA11: fato relevante oficial \`424937\`, de 06/03/2023, com não pagamento;
- VSLH11: fato relevante oficial \`424942\`, de 06/03/2023, com não pagamento;
- KNCR11 e KNSC11: cobertura anual dos catálogos CVM e extração dos fatos relevantes críticos sem evento material reconhecido;
- MCCI11 e RBRY11: cobertura anual, documentos críticos extraídos e ausência de evento material incompatível com o rótulo;
- RBRY11 confirmou a janela de estresse e recuperação; MCCI11 não a confirmou e foi mantido inconclusivo.

## Hashes

- identidade da coorte: \`${run1.cohortIdentityHash}\`;
- dataset consolidado: \`${run1.datasetHash}\`;
- relatório do backtest: \`${run1.evidenceHash}\`;
- índice da evidência: \`${index.evidenceHash}\`.

## Decisão de produto

A 3.5-C não integra o Risk Lab ao Relatório Premium, não envia notificações e não homologa o ruleset. A próxima unidade é a Sprint 3.6 — calibração e homologação, que deverá tratar o falso positivo do KNSC11 e a inconclusividade do MCCI11 sem vazamento de informação futura.
`;
writeFileSync("docs/risk-lab/sprint-3-5-c-dataset-backtest.md", dossier);

console.log(JSON.stringify({
  status: run1.status,
  datasetHash: run1.datasetHash,
  evidenceHash: run1.evidenceHash,
  metrics: run1.metrics,
  outcomes: manifest.expected.outcomes,
}, null, 2));
