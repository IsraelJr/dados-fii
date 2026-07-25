import { readFileSync, writeFileSync } from "node:fs";

const handoffPath = "DADOS_FII_HANDOFF.md";
let body = readFileSync(handoffPath, "utf8");

function replaceRequired(from, to, label) {
  if (!body.includes(from)) throw new Error(`Trecho ausente para ${label}`);
  if (body.split(from).length !== 2) throw new Error(`Trecho não único para ${label}`);
  body = body.replace(from, to);
}

replaceRequired("**Versão:** 6.10.0  ", "**Versão:** 6.11.0  ", "versão");
replaceRequired("**Data:** 24/07/2026  ", "**Data:** 25/07/2026  ", "data");
replaceRequired("**Base funcional auditada:** `c616437a0a44c1543015a709911c67f70f390b7d`  ", "**Base funcional auditada:** `ef0c621f2f813009fdb3999b721e4f4a6568c134`  ", "base funcional");
replaceRequired("**Sprint corrente:** 3.5 — Coorte externa e backtest sem informação futura  ", "**Sprint corrente:** 3.6 — calibração e homologação do ruleset — planejada, não iniciada  ", "sprint corrente");
replaceRequired("**Próxima unidade de trabalho:** 3.5-C — dataset final e backtest externo sem informação futura  ", "**Próxima unidade de trabalho:** 3.6 — calibração e homologação do ruleset — não iniciada  ", "próxima unidade");
replaceRequired("| Este Handoff v6.10.0 é a única referência canônica quando houver divergência. |", "| Este Handoff v6.11.0 é a única referência canônica quando houver divergência. |", "decisão de versão");
replaceRequired("| A Sprint corrente é a 3.5. | Sprint 3.4 como corrente. | Em andamento | Os seis fundos da coorte foram concluídos; restam dataset e backtest. |", "| A Sprint 3.5 está formalmente concluída e a 3.6 é a próxima unidade, ainda não iniciada. | Sprint 3.5 em andamento. | Concluída / planejada | PR #128, merge `ef0c621f2f813009fdb3999b721e4f4a6568c134`; backtest concluído com calibração obrigatória. |", "decisão da sprint");
replaceRequired("| A próxima fase é 3.5-C — dataset final e backtest e não inicia automaticamente. | Processar dataset/backtest junto com fundos individuais. | Planejada | Regra de parada após a coorte e antes do backtest. |", "| Fase 3.5-C — dataset final e backtest está formalmente concluída. | Dataset/backtest pendente. | Concluída | 318 observações, cobertura de 83,33%, zero falso negativo, um falso positivo e um inconclusivo. |\n| A próxima fase é 3.6 — calibração e homologação e não inicia automaticamente. | Promover o ruleset diretamente ao produto. | Planejada | O ruleset `0.1.0` não está homologado; KNSC11 e MCCI11 exigem calibração sem look-ahead. |", "decisões da fase C");

replaceRequired(
  "- Fases 3.5-A/DEVA11, 3.5-B1/VSLH11, 3.5-B2/KNCR11, 3.5-B3/KNSC11, 3.5-B4/MCCI11 e 3.5-B5/RBRY11 estão concluídas.\n- Os seis fundos da coorte externa estão formalmente concluídos.\n- Sprint 3.5 completa permanece aberta porque dataset e backtest ainda não foram executados.\n- Próxima unidade: 3.5-C — dataset final e backtest externo sem informação futura, ainda não iniciada.\n- Risk Lab permanece isolado de Premium e notificações até os gates das Sprints 3.5 e 3.6.",
  "- Fases 3.5-A/DEVA11, 3.5-B1/VSLH11, 3.5-B2/KNCR11, 3.5-B3/KNSC11, 3.5-B4/MCCI11, 3.5-B5/RBRY11 e 3.5-C/dataset e backtest estão formalmente concluídas.\n- A Sprint 3.5 está formalmente concluída.\n- O backtest consolidou 318 observações e terminou como `completed_requires_calibration`: 3 verdadeiros positivos, 1 verdadeiro negativo, 1 falso positivo, 0 falsos negativos e 1 inconclusivo.\n- Cobertura: 83,33%; lead time médio: 220,52 dias.\n- Próxima unidade: 3.6 — calibração e homologação do ruleset, ainda não iniciada.\n- Risk Lab permanece isolado de Premium e notificações até a conclusão e homologação da Sprint 3.6.",
  "resumo executivo",
);
replaceRequired(
  "| 3.5-B5 — RBRY11 | Sim | Sim | Preview Ready; sem integração de produto | **Concluída** |\n| Sprint 3.5 completa | Parcial | Parcial | Produto bloqueado | **Em andamento** |",
  "| 3.5-B5 — RBRY11 | Sim | Sim | Preview Ready; sem integração de produto | **Concluída** |\n| 3.5-C — dataset e backtest | Sim | Sim | Build final saudável; Preview anterior Ready; quota externa documentada; sem integração de produto | **Concluída; requer calibração** |\n| Sprint 3.5 completa | Sim | Sim | Produto permanece bloqueado até 3.6 | **Formalmente concluída** |\n| Sprint 3.6 — calibração | Não | Não | Não iniciada | **Planejada** |",
  "tabela de auditoria",
);
replaceRequired("- 3.5-B5 — RBRY11: concluída.\n- Sprint 3.5 completa: aberta até dataset e backtest.", "- 3.5-B5 — RBRY11: concluída.\n- 3.5-C — dataset e backtest sem look-ahead: concluída; resultado requer calibração.\n- Sprint 3.5 completa: formalmente concluída.\n- Sprint 3.6: planejada e não iniciada.", "fase 3");

const section3Marker = "\n---\n\n## 3. Sprint atual";
if (!body.includes(section3Marker)) throw new Error("Marcador da seção 3 ausente");
const phaseCEvidence = `
### Evidência canônica da Fase 3.5-C — dataset e backtest sem look-ahead

- issue \`#127\`; PR funcional \`#128\`;
- merge funcional: \`ef0c621f2f813009fdb3999b721e4f4a6568c134\`;
- dataset: \`risk-lab-credit-oos-phase-c-v1\`, versão \`1.0.0\`, metodologia \`3.5-C.1\`, ruleset \`0.1.0\`;
- observações consolidadas: \`318\`;
- duas execuções independentes com hashes idênticos;
- hash da identidade da coorte: \`97a3fc3bea0adde463ee3a8d06a9e40a6e90dc0f22303bad85e3dd488bfb7726\`;
- hash do dataset: \`f18f61b7ddb5cc63955fa9791c6e5e3e43552134aaa28a9dd622a96ee587fcae\`;
- hash da evidência do backtest: \`4b0ced4e8ef662a23317e850353209b72804745be3afa7dc128e05356b2e7c6f\`;
- índice final: \`edb90face1dddff390dcbf260cf60dc0bb3c053f20ea4ea5a17a0788b98c308e\`;
- resultados: DEVA11 verdadeiro positivo, VSLH11 verdadeiro positivo, KNCR11 verdadeiro negativo, KNSC11 falso positivo, MCCI11 inconclusivo e RBRY11 verdadeiro positivo;
- métricas: cobertura \`83,33%\`, lead time médio \`220,52 dias\`, mínimo \`90,04\` e máximo \`422,26\`;
- falsos negativos: \`0\`; falso positivo: \`1\`; inconclusivo: \`1\`;
- bloqueadores metodológicos: \`0\`; calibração obrigatória: \`true\`; homologação permitida: \`false\`;
- Premium integrado: \`false\`; notificações enviadas: \`false\`.
`;
body = body.replace(section3Marker, `\n${phaseCEvidence}${section3Marker}`);

const oldSection3 = `## 3. Sprint atual

### Sprint 3.5 — Coorte externa e backtest sem informação futura

Estado: **em andamento**.

Ordem interna vigente:

1. 3.5-A — DEVA11: concluída.
2. 3.5-B1 — VSLH11: concluída.
3. 3.5-B2 — KNCR11: concluída.
4. 3.5-B3 — KNSC11: concluída.
5. 3.5-B4 — MCCI11: concluída.
6. 3.5-B5 — RBRY11: concluída.
7. 3.5-C — composição do dataset imutável da coorte: próxima, não iniciada.
8. Backtest sem look-ahead e relatório de performance: não iniciado.
9. Gate de encerramento da Sprint 3.5: pendente.

A conclusão de um fundo não promove automaticamente o seguinte. Cada unidade exige issue, branch, PR, CI, evidência, merge, auditoria do \`main\` e atualização canônica.`;
const newSection3 = `## 3. Sprint atual

### Sprint 3.6 — calibração e homologação do ruleset

Estado: **planejada e não iniciada**.

Entrada obrigatória:

1. preservar o dataset e os hashes da Sprint 3.5 sem reclassificação retrospectiva;
2. tratar o falso positivo do KNSC11;
3. tratar o caso inconclusivo do MCCI11;
4. manter zero falsos negativos na coorte sem ajustar regras com informação futura;
5. demonstrar parâmetros derivados, versionados e reproduzíveis;
6. manter Premium e notificações bloqueados até homologação formal.

A Sprint 3.6 não foi iniciada automaticamente. Exige issue, branch, PR, CI, evidência, merge, auditoria do \`main\` e atualização canônica próprios.`;
replaceRequired(oldSection3, newSection3, "seção 3");
replaceRequired(
  "1. **3.5-C — dataset final e backtest externo sem informação futura**.\n2. **3.6 — calibração e homologação do ruleset**.\n3. **3.7 — Risk Lab read-only no Premium + Prompt Premium v3**.\n4. **SEO-S1, dias 1–15** — pode avançar em paralelo sem alterar a ordem funcional do Risk Lab.\n5. **4.1 — Radar: acompanhar fundo fora da carteira**.\n6. **Fase 4+** — Inteligência documental, Carteira histórica verdadeira, Screener quantitativo, Fair value e sustentabilidade da renda.",
  "1. **3.6 — calibração e homologação do ruleset** — não iniciada.\n2. **3.7 — Risk Lab read-only no Premium + Prompt Premium v3**.\n3. **SEO-S1, dias 1–15** — pode avançar em paralelo sem alterar a ordem funcional do Risk Lab.\n4. **4.1 — Radar: acompanhar fundo fora da carteira**.\n5. **Fase 4+** — Inteligência documental, Carteira histórica verdadeira, Screener quantitativo, Fair value e sustentabilidade da renda.",
  "ordem oficial",
);
replaceRequired(
  "### 3.5-C — dataset e backtest\n\n- seis casos completos e imutáveis;\n- verdade-terreno primária;\n- nenhum uso de informação futura;\n- métricas de cobertura, lead time, falso positivo, falso negativo e inconclusivos;\n- nenhum efeito em Premium ou notificações;\n- resultado reproduzível e evidência persistida no Git.",
  "### 3.5-C — dataset e backtest — concluída\n\n- seis casos completos e imutáveis;\n- verdade-terreno primária com PDFs críticos e hashes;\n- 318 observações consolidadas;\n- nenhum uso de informação futura;\n- duas execuções com hashes idênticos;\n- cobertura de 83,33%, 3 verdadeiros positivos, 1 verdadeiro negativo, 1 falso positivo, 0 falsos negativos e 1 inconclusivo;\n- resultado `completed_requires_calibration`;\n- nenhum efeito em Premium ou notificações;\n- evidência persistida no Git e gate permanente na CI.",
  "escopo 3.5-C",
);
replaceRequired("- PR #125 — RBRY11; merge `c616437a0a44c1543015a709911c67f70f390b7d`.\n- PR #65", "- PR #125 — RBRY11; merge `c616437a0a44c1543015a709911c67f70f390b7d`.\n- PR #128 — dataset e backtest 3.5-C; merge `ef0c621f2f813009fdb3999b721e4f4a6568c134`.\n- PR #65", "lista de PRs");
replaceRequired("- `docs/production-evidence/risk-lab/rbry11-phase-b5/`\n- `docs/risk-lab/sprint-3-5-b3-knsc11.md`", "- `docs/production-evidence/risk-lab/rbry11-phase-b5/`\n- `docs/production-evidence/risk-lab/cohort-phase-c/`\n- `docs/production-evidence/risk-lab/cohort-phase-c-manifest.json`\n- `docs/risk-lab/sprint-3-5-c-dataset-backtest.md`\n- `src/lib/risk-lab/FrozenCohortPhaseC.ts`\n- `tests/risk-lab-cohort-phase-c-evidence.test.mjs`\n- `tests/risk-lab-frozen-cohort-phase-c.test.ts`\n- `docs/risk-lab/sprint-3-5-b3-knsc11.md`", "evidências principais");
replaceRequired("- Risk Lab até 3.4 e os seis casos DEVA11, VSLH11, KNCR11, KNSC11, MCCI11 e RBRY11 da Sprint 3.5.", "- Risk Lab até 3.4, os seis casos da coorte e a Fase 3.5-C de dataset e backtest; Sprint 3.5 formalmente concluída.", "funcionalidades concluídas");
replaceRequired("- Sprint 3.5: seis de seis fundos concluídos; dataset e backtest permanecem pendentes.", "- Sprint 3.6: planejada e não iniciada; calibração deve resolver KNSC11 falso positivo e MCCI11 inconclusivo sem look-ahead.", "funcionalidades parciais");
replaceRequired("- Dataset final, backtest e calibração.", "- Calibração e homologação da Sprint 3.6.", "pendências");
replaceRequired("- testes determinísticos RBRY11\n- `npm run test:workflow-governance`", "- testes determinísticos RBRY11\n- testes do dataset e backtest da Fase 3.5-C\n- `npm run test:workflow-governance`", "gates permanentes");
replaceRequired("- Quando a plataforma recusa o deploy antes do build por quota externa e o diff contém somente workflow, testes, documentação e evidência, o `next build` automatizado no SHA pode cumprir o gate.\n- A exceção exige registro do erro externo, credenciais descartáveis no runner, typecheck verde e ausência comprovada de código de produto no diff.\n- O fallback de build só é válido quando o diff não altera código de produto.", "- Quando a plataforma recusa o deploy antes do build por quota externa e o diff contém somente workflow, testes, documentação, evidência ou código offline do Risk Lab não importado pelo runtime do produto, o `next build` automatizado no SHA pode cumprir o gate.\n- A exceção exige registro do erro externo, credenciais descartáveis no runner, typecheck verde e ausência comprovada de integração com código executado pelo produto.\n- O fallback de build só é válido quando o diff não altera o comportamento do produto em runtime.", "fallback de deployment");
replaceRequired("- Abrir issue e branch exclusivas para 3.5-C — dataset final e backtest externo sem informação futura.\n- Consumir somente os seis casos imutáveis e auditados da coorte.\n- Não iniciar 3.6, Premium ou notificações antes do gate de encerramento da Sprint 3.5.", "- Abrir issue e branch exclusivas para 3.6 — calibração e homologação do ruleset, somente mediante nova instrução do usuário.\n- Consumir o dataset imutável da 3.5-C sem alterar verdade-terreno, papéis ou hashes históricos.\n- Não iniciar 3.7, Premium ou notificações antes da homologação formal da Sprint 3.6.", "próxima execução");
replaceRequired("Este documento registra o KNSC11 como concluído e o MCCI11 como próximo. A Sprint 3.5 não está concluída, o Risk Lab não está liberado para Premium/notificações e nenhuma fase seguinte deve ser promovida sem evidência e testes próprios.", "Este documento registra a Sprint 3.5 como formalmente concluída e a Sprint 3.6 como próxima unidade planejada, ainda não iniciada. O ruleset `0.1.0` não está homologado, o Risk Lab não está liberado para Premium/notificações e nenhuma fase seguinte deve ser promovida sem evidência e testes próprios.", "regra de parada");

writeFileSync(handoffPath, body);

const test = String.raw`import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const HANDOFF = "DADOS_FII_HANDOFF.md";
const EXACT_FIRST_LINE = "Este documento substitui todos os planejamentos anteriores quando houver divergência.";

function walk(directory, output = []) {
  for (const entry of readdirSync(directory)) {
    if ([".git", "node_modules", ".next", ".vercel"].includes(entry)) continue;
    const absolute = path.join(directory, entry);
    const relative = path.relative(ROOT, absolute).replaceAll(path.sep, "/");
    const info = statSync(absolute);
    if (info.isDirectory()) walk(absolute, output);
    else output.push(relative);
  }
  return output;
}
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function body() { return readFileSync(HANDOFF, "utf8"); }

test("existe somente um Handoff canônico", () => {
  const matches = walk(ROOT).filter((file) => /(?:^|\/)DADOS_FII_HANDOFF(?:_v[^/]*)?\.md$/i.test(file)).sort();
  assert.deepEqual(matches, [HANDOFF]);
});

test("Handoff possui versão, data, base e próxima unidade vigentes", () => {
  const text = body();
  assert.equal(text.split(/\r?\n/, 1)[0], EXACT_FIRST_LINE);
  assert.match(text, /\*\*Versão:\*\* 6\.11\.0/);
  assert.match(text, /\*\*Data:\*\* 25\/07\/2026/);
  assert.match(text, /\*\*Base funcional auditada:\*\* \`ef0c621f2f813009fdb3999b721e4f4a6568c134\`/);
  assert.match(text, /Próxima unidade de trabalho:\*\* 3\.6 — calibração e homologação do ruleset — não iniciada/);
});

test("Handoff contém as doze seções obrigatórias na ordem", () => {
  const text = body();
  const headings = [
    "## 1. Estado atual do projeto", "## 2. Fases concluídas", "## 3. Sprint atual",
    "## 4. Ordem oficial das próximas sprints", "## 5. Escopo e critérios de aceite de cada sprint",
    "## 6. Regras arquiteturais obrigatórias", "## 7. Arquivos, branches, commits e PRs existentes",
    "## 8. Funcionalidades concluídas, parciais e pendentes", "## 9. Decisões de segurança",
    "## 10. Variáveis de ambiente", "## 11. Testes obrigatórios", "## 12. Pendências e decisões ainda abertas",
  ];
  let previous = -1;
  for (const heading of headings) {
    const current = text.indexOf(heading);
    assert.ok(current > previous, `${heading} deve existir e respeitar a ordem`);
    previous = current;
  }
});

test("Sprint 3.5 está concluída e 3.6 não foi iniciada", () => {
  const text = body();
  for (const required of [
    "A Sprint 3.5 está formalmente concluída",
    "Sprint 3.5 completa: formalmente concluída",
    "Sprint 3.6 — calibração e homologação do ruleset",
    "Estado: **planejada e não iniciada**",
    "A Sprint 3.6 não foi iniciada automaticamente",
    "ruleset `0.1.0` não está homologado",
    "Risk Lab não está liberado para Premium/notificações",
  ]) assert.match(text, new RegExp(escapeRegExp(required), "i"));
  assert.doesNotMatch(text, /dataset e backtest permanecem pendentes/i);
  assert.doesNotMatch(text, /Sprint 3\.5 não está concluída/i);
});

test("evidência canônica da fase 3.5-C está registrada sem maquiar desempenho", () => {
  const text = body();
  for (const required of [
    "merge funcional: `ef0c621f2f813009fdb3999b721e4f4a6568c134`",
    "observações consolidadas: `318`",
    "`f18f61b7ddb5cc63955fa9791c6e5e3e43552134aaa28a9dd622a96ee587fcae`",
    "`4b0ced4e8ef662a23317e850353209b72804745be3afa7dc128e05356b2e7c6f`",
    "`edb90face1dddff390dcbf260cf60dc0bb3c053f20ea4ea5a17a0788b98c308e`",
    "KNSC11 falso positivo",
    "MCCI11 inconclusivo",
    "falsos negativos: `0`",
    "calibração obrigatória: `true`",
    "homologação permitida: `false`",
    "Premium integrado: `false`",
    "notificações enviadas: `false`",
  ]) assert.match(text, new RegExp(escapeRegExp(required), "i"));
});

test("arquivos e gates permanentes da 3.5-C existem", () => {
  const files = [
    "docs/production-evidence/risk-lab/cohort-phase-c/index.json",
    "docs/production-evidence/risk-lab/cohort-phase-c/registry.json",
    "docs/production-evidence/risk-lab/cohort-phase-c/dataset-index.json",
    "docs/production-evidence/risk-lab/cohort-phase-c/backtest-report.json",
    "docs/production-evidence/risk-lab/cohort-phase-c-manifest.json",
    "docs/risk-lab/sprint-3-5-c-dataset-backtest.md",
    "src/lib/risk-lab/FrozenCohortPhaseC.ts",
    "src/lib/risk-lab/frozen-cohort-phase-c-v1.json",
    "tests/risk-lab-cohort-phase-c-evidence.test.mjs",
    "tests/risk-lab-frozen-cohort-phase-c.test.ts",
  ];
  for (const file of files) assert.equal(existsSync(file), true, `${file} deve existir`);
  const workflow = readFileSync(".github/workflows/risk-lab.yml", "utf8");
  assert.match(workflow, /Validate immutable cohort dataset and no-look-ahead backtest/);
});

test("roadmap, fallback e critérios globais permanecem protegidos", () => {
  const text = body();
  for (const required of [
    "3.7 — Risk Lab read-only no Premium + Prompt Premium v3",
    "4.1 — Radar: acompanhar fundo fora da carteira",
    "Grátis até 1", "Premium até 10", "SEO-S1, dias 1–15",
    "código offline do Risk Lab não importado pelo runtime do produto",
    "Se o diff alterar código de runtime, build local/CI não substitui Preview ou deployment real",
    "código está em `main`", "CI obrigatória está verde no SHA da PR",
    "universo aplicável foi coberto", "evidência final está no Git",
    "Handoff canônico foi atualizado e protegido por teste",
  ]) assert.match(text, new RegExp(escapeRegExp(required), "i"));
});
`;
writeFileSync("tests/canonical-handoff.test.mjs", test);
