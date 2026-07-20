import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const EXPECTED_RUN_ID = "risk-lab-3-5-20260720-v2";
const EXPECTED_TICKERS = ["DEVA11", "VSLH11", "KNCR11", "KNSC11", "MCCI11", "RBRY11"];

function fail(message) {
  throw new Error(`Sprint 3.5 não pode ser encerrada: ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  assert(first >= 0, `marcador ausente no handoff (${label}).`);
  assert(source.indexOf(search, first + search.length) < 0, `marcador duplicado no handoff (${label}).`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

function validateEvidence(evidence) {
  assert(evidence?.schemaVersion === 2, "schema de evidência metodológica inválido.");
  assert(evidence?.sprint === "3.5", "sprint divergente.");
  assert(evidence?.runId === EXPECTED_RUN_ID, "runId divergente.");
  assert(/^risk-lab-3-5-attempt-\d{14}-[a-f0-9-]{8,36}$/.test(evidence?.attemptId || ""), "attemptId imutável inválido.");
  assert(evidence?.methodologyVersion === "2.0.0", "versão metodológica divergente.");
  assert(evidence?.status === "passed", "status de Produção diferente de passed.");
  assert(evidence?.sourceExecutionAllowed === true, "verdade-terreno primária não autorizou a execução.");
  assert(evidence?.executionAllowed === true, "executionAllowed não foi liberado pelos gates.");
  assert(evidence?.rulesetVersion === "0.1.0", "ruleset congelado foi alterado.");
  assert(evidence?.cohortId === "risk-lab-credit-oos-v0.1", "coorte divergente.");
  assert(evidence?.cohortVersion === "0.1.0", "versão da coorte divergente.");
  assert(/^[a-f0-9]{40}$/.test(evidence?.releaseCommit || ""), "commit de Produção inválido.");
  assert(/^https:\/\//.test(evidence?.deploymentUrl || ""), "deployment de Produção ausente.");
  assert(evidence?.environment === "production", "execução não ocorreu em Produção.");
  assert(/^[a-f0-9]{64}$/.test(evidence?.evidenceHash || ""), "hash da evidência inválido.");
  assert(evidence?.premiumIntegrated === false, "Premium foi integrado antes do gate formal.");
  assert(evidence?.notificationsSent === false, "notificações foram enviadas durante a homologação.");
  assert(Array.isArray(evidence?.blockers) && evidence.blockers.length === 0, "existem blockers metodológicos.");

  const cases = Array.isArray(evidence?.cases) ? evidence.cases : [];
  assert(cases.length === EXPECTED_TICKERS.length, "a coorte não possui seis casos.");
  const tickers = [...new Set(cases.map((item) => item.ticker))].sort();
  assert(JSON.stringify(tickers) === JSON.stringify([...EXPECTED_TICKERS].sort()), "tickers da coorte divergentes.");
  assert(cases.every((item) => item.status === "validated"), "há caso não validado.");
  assert(cases.every((item) => item.groundTruth?.status === "verified"), "há verdade-terreno primária não verificada.");
  assert(cases.every((item) => /^[a-f0-9]{64}$/.test(item.groundTruth?.verificationHash || "")), "há hash de verdade-terreno inválido.");
  assert(cases.every((item) => item.primaryEvidenceComplete === true), "há evidência primária incompleta.");
  assert(cases.every((item) => item.lookAheadDetected === false), "look-ahead detectado.");
  assert(cases.every((item) => item.premiumIntegrated === false && item.notificationsSent === false), "efeito externo detectado em caso da coorte.");
  assert(cases.every((item) => Array.isArray(item.evidence) && item.evidence.length > 0), "caso sem evidência por observação.");

  const metrics = evidence?.metrics || {};
  assert(metrics.totalCases === 6, "total de casos divergente.");
  assert(metrics.conclusiveCases === 6, "nem todos os casos são conclusivos.");
  assert(metrics.falsePositives === 0, "há falso positivo nos controles saudáveis.");
  assert(Number.isInteger(metrics.falseNegatives) && metrics.falseNegatives >= 0, "métrica de falso negativo inválida.");
  assert(metrics.inconclusiveCases === 0, "há caso inconclusivo.");
  assert(metrics.coveragePercent === 100, "cobertura menor que 100%.");
  assert(evidence.performanceReviewRequired === (metrics.falseNegatives > 0), "encaminhamento de desempenho para a Sprint 3.6 divergente.");

  const checks = Array.isArray(evidence?.checks) ? evidence.checks : [];
  assert(checks.length >= 12, "quantidade insuficiente de checks.");
  assert(checks.every((item) => item.status === "passed"), "há check metodológico reprovado.");
  assert(checks.some((item) => item.id === "verification.primary-authorized"), "gate de autorização primária ausente.");
  assert(checks.some((item) => item.id === "metrics.performance-measured"), "gate de mensuração de desempenho ausente.");
}

function updateHandoff(source, evidence) {
  const metrics = evidence.metrics;
  const release = evidence.releaseCommit;
  const hash = evidence.evidenceHash;
  const checks = evidence.checks.length;
  const performance = metrics.falseNegatives > 0
    ? `${metrics.falseNegatives} falso(s) negativo(s) medido(s), encaminhado(s) ao gate formal da Sprint 3.6`
    : "zero falso negativo observado";

  let next = source;
  next = replaceOnce(next, "**Versão:** 6.2.0", "**Versão:** 6.3.0", "versão");
  next = replaceOnce(
    next,
    "**Commit auditado em Produção:** `e9a5d6ec263c0aa87961133a361891f60175dba4`",
    `**Commit auditado em Produção:** \`${release}\``,
    "commit auditado",
  );
  next = replaceOnce(
    next,
    "**Branch desta atualização:** `automation/risk-lab-3-4-release-0072ecf340e6`",
    "**Branch desta atualização:** `automation/sprint-3-5-evidence-*`",
    "branch da atualização",
  );
  next = replaceOnce(
    next,
    "**PR desta atualização:** #59 — `chore: formaliza conclusão da Sprint 3.4`",
    "**PR desta atualização:** automática — `chore: formaliza evidência aprovada da Sprint 3.5`",
    "PR da atualização",
  );
  next = replaceOnce(
    next,
    "| Sprint corrente canônica: **3.5 — Coorte externa e backtest sem informação futura**. | Sprint 3.4 como sprint corrente. | A Sprint 3.4 foi homologada em Produção com evidência auditável, mantendo o Risk Lab isolado do Premium e das notificações. |",
    "| Sprint corrente canônica: **3.6 — Métricas, calibração e gate formal**. | Sprint 3.5 como sprint corrente. | A coorte externa foi executada integralmente em Produção, sem look-ahead, com verdade-terreno primária independente e métricas preservadas. |",
    "decisão da sprint corrente",
  );
  next = replaceOnce(
    next,
    "- A Sprint 3.4 do Risk Lab foi concluída em Produção com 11/11 checks, 6/6 casos obrigatórios e zero blockers; evidência `deb0f79597c2fbfb87214c6d05df37cbe782e084e4a7289a487042c3582a567f`. O Risk Lab continua isolado do Premium e das notificações; a coorte externa permanece bloqueada até verificação primária.",
    `- A Sprint 3.5 do Risk Lab foi concluída no deployment exato \`${release}\`, com ${checks}/${checks} checks, 6/6 casos, ${metrics.coveragePercent}% de cobertura conclusiva, zero falso positivo, ${performance}, zero inconclusivo e zero blocker metodológico; evidência \`${hash}\`. O ruleset \`v0.1.0\` permanece congelado e sua decisão de desempenho pertence à Sprint 3.6.`,
    "resumo executivo da Sprint 3.5",
  );
  next = replaceOnce(
    next,
    "| Fase 3 — Risk Lab | Sim, até 3.4 | Sim | Sim (`e9a5d6e`, Vercel verde) | Smoke 3.4: 11/11 checks e 6/6 casos; coorte externa pendente | Em andamento |",
    `| Fase 3 — Risk Lab | Sim, até 3.5 | Sim | Sim (\`${release.slice(0, 7)}\`, deployment exato) | Coorte 3.5: ${checks}/${checks} checks, 6/6 casos, 100% de cobertura, ${metrics.falseNegatives} FN medido(s) e zero blocker metodológico | Em andamento |`,
    "auditoria da Fase 3",
  );
  next = replaceOnce(
    next,
    "**Em andamento.** As Sprints 3.0 a 3.4 possuem código, testes e homologação de Produção. A Sprint 3.5 continua bloqueada até a verificação primária da coorte externa.",
    "**Em andamento.** As Sprints 3.0 a 3.5 possuem código, testes e homologação de Produção. A Sprint 3.6 deve avaliar formalmente o desempenho observado, sem recalibrar o ruleset com a mesma coorte.",
    "estado da Fase 3",
  );

  const currentSprint = `### Sprint 3.5 — Coorte externa e backtest sem informação futura

**Objetivo:** verificar a coorte pré-registrada em fontes primárias e executar o backtest sem informação futura, preservando integralmente o ruleset \`v0.1.0\`.

**Trabalho obrigatório:**

1. confirmar \`knownAt\`, URL, trecho, página, hash e versão por observação;
2. executar \`DEVA11\`, \`VSLH11\`, \`KNCR11\`, \`KNSC11\`, \`MCCI11\` e \`RBRY11\` sem look-ahead;
3. medir antecedência, falsos positivos, falsos negativos, inconclusão e cobertura;
4. manter \`executionAllowed=false\` enquanto faltar verificação primária;
5. versionar a evidência e preservar o ruleset congelado.

**Critério de aceite:** nenhuma conclusão final sustentada apenas por fonte secundária; controles saudáveis sem vermelho injustificado; ambiguidades como inconclusivas; métricas e evidências persistidas no Git.`;
  const nextSprint = `### Sprint 3.6 — Métricas, calibração e gate formal

**Objetivo:** avaliar o desempenho observado na coorte externa e decidir, com critérios versionados, se o ruleset \`v0.1.0\` pode avançar, deve ser reprovado ou precisa originar uma nova versão.

**Trabalho obrigatório:**

1. analisar antecedência e estabilidade dos sinais por papel da coorte;
2. revisar falsos positivos, falsos negativos, cobertura e sensibilidade;
3. documentar limites, intervalos de confiança e riscos de generalização;
4. manter o ruleset \`v0.1.0\` congelado durante a avaliação;
5. repetir a coorte integral se qualquer regra ou limiar mudar.

**Critério de aceite:** decisão formal versionada; zero vermelho falso positivo nos controles; nenhuma conclusão final sustentada apenas por fonte secundária; ambiguidades tratadas como inconclusivas; nova versão/hash obrigatórios para qualquer alteração.`;
  next = replaceOnce(next, currentSprint, nextSprint, "seção da sprint corrente");

  next = replaceOnce(
    next,
    "1. **Sprint 3.5 — Coorte externa e backtest sem informação futura.**\n2. **Sprint 3.6 — Métricas, calibração e gate formal.**\n3. **Sprint 3.7 — Risk Lab read-only no Relatório Premium e Prompt Premium v3.**\n4. **Sprint 3.8 — Impacto na carteira e alertas opt-in.**\n5. **Sprint 4.1 — Radar: acompanhar fundo fora da carteira.**\n6. **Sprint 4.2 — Radar: eventos, tese e relatório pré-compra.**\n7. **Sprint 4.3 — Planos, preferências, canais e monetização.**\n8. **Sprint 5.1 — Carteira histórica verdadeira e ledger de eventos.**\n9. **Sprint 5.2 — Motor de risco, exposição e atribuição acionável.**\n10. **Sprint 5.3 — Inteligência sobre comunicados oficiais.**\n11. **Sprint 5.4 — Screener quantitativo, pares e fair value por tipo de FII.**\n12. **Sprint 5.5 — Benchmark, retorno total, calendário, centro fiscal e simuladores.**",
    "1. **Sprint 3.6 — Métricas, calibração e gate formal.**\n2. **Sprint 3.7 — Risk Lab read-only no Relatório Premium e Prompt Premium v3.**\n3. **Sprint 3.8 — Impacto na carteira e alertas opt-in.**\n4. **Sprint 4.1 — Radar: acompanhar fundo fora da carteira.**\n5. **Sprint 4.2 — Radar: eventos, tese e relatório pré-compra.**\n6. **Sprint 4.3 — Planos, preferências, canais e monetização.**\n7. **Sprint 5.1 — Carteira histórica verdadeira e ledger de eventos.**\n8. **Sprint 5.2 — Motor de risco, exposição e atribuição acionável.**\n9. **Sprint 5.3 — Inteligência sobre comunicados oficiais.**\n10. **Sprint 5.4 — Screener quantitativo, pares e fair value por tipo de FII.**\n11. **Sprint 5.5 — Benchmark, retorno total, calendário, centro fiscal e simuladores.**",
    "ordem oficial das sprints",
  );
  next = replaceOnce(
    next,
    "### Sprint 3.5 — Coorte externa\n\n**Escopo:** verificar em fonte primária e executar, sem alterar o ruleset `v0.1.0`, `DEVA11`, `VSLH11`, `KNCR11`, `KNSC11`, `MCCI11` e `RBRY11`.\n\n**Aceite:** `knownAt`, URL, trecho, página, hash e versão por observação; nenhum look-ahead; métricas de primeiro amarelo/laranja/vermelho, antecedência, falso positivo, falso negativo, inconclusão e cobertura; controles saudáveis sem vermelho injustificado. O teste atual mantém `executionAllowed=false` até a verificação primária.",
    `### Sprint 3.5 — Coorte externa (concluída)\n\n**Escopo executado:** verdade-terreno primária independente e backtest sem look-ahead de \`DEVA11\`, \`VSLH11\`, \`KNCR11\`, \`KNSC11\`, \`MCCI11\` e \`RBRY11\`, preservando o ruleset \`v0.1.0\`.\n\n**Aceite obtido:** deployment exato \`${release}\`; ${checks}/${checks} checks; 6/6 casos; \`knownAt\`, URL, trecho, página, hash e versão por observação; ${metrics.coveragePercent}% de cobertura; zero falso positivo; ${performance}; zero inconclusivo; nenhum look-ahead; zero blocker metodológico; Premium e notificações isolados; evidência \`${hash}\` versionada no Git.`,
    "histórico da Sprint 3.5",
  );

  return next;
}

const evidencePath = resolve(process.argv[2] || "");
const handoffPath = resolve(process.argv[3] || "DADOS_FII_HANDOFF.md");
assert(process.argv[2], "caminho da evidência não informado.");

const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
validateEvidence(evidence);
const currentHandoff = readFileSync(handoffPath, "utf8");
const updatedHandoff = updateHandoff(currentHandoff, evidence);
assert(updatedHandoff !== currentHandoff, "handoff não foi alterado.");
writeFileSync(handoffPath, updatedHandoff, "utf8");
console.log(JSON.stringify({
  ok: true,
  sprint: "3.5",
  releaseCommit: evidence.releaseCommit,
  evidenceHash: evidence.evidenceHash,
  falseNegatives: evidence.metrics.falseNegatives,
  performanceReviewRequired: evidence.performanceReviewRequired,
  nextSprint: "3.6",
}));
