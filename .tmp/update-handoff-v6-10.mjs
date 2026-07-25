import { readFileSync, writeFileSync } from 'node:fs';

const path = 'DADOS_FII_HANDOFF.md';
let body = readFileSync(path, 'utf8');

function replaceRequired(from, to, label) {
  if (!body.includes(from)) throw new Error(`Trecho ausente para ${label}`);
  body = body.replace(from, to);
}

replaceRequired('**Versão:** 6.8.0  ', '**Versão:** 6.10.0  ', 'versão');
replaceRequired('**Base funcional auditada:** `1925b53a268f90b4c2f9a2733c4ac8df645a14ec`  ', '**Base funcional auditada:** `c616437a0a44c1543015a709911c67f70f390b7d`  ', 'base funcional');
replaceRequired('**Próxima unidade de trabalho:** 3.5-B4 — MCCI11  ', '**Próxima unidade de trabalho:** 3.5-C — dataset final e backtest externo sem informação futura  ', 'próxima unidade');
replaceRequired('| Este Handoff v6.8.0 é a única referência canônica quando houver divergência. |', '| Este Handoff v6.10.0 é a única referência canônica quando houver divergência. |', 'decisão de versão');
replaceRequired('| A Sprint corrente é a 3.5. | Sprint 3.4 como corrente. | Em andamento | Restam MCCI11, RBRY11, dataset e backtest. |', '| A Sprint corrente é a 3.5. | Sprint 3.4 como corrente. | Em andamento | Os seis fundos da coorte foram concluídos; restam dataset e backtest. |', 'estado da Sprint');
replaceRequired(
  '| Fase 3.5-B3 — KNSC11 está formalmente concluída. | KNSC11 como próxima fase. | Concluída | PR #118, merge `1925b53a268f90b4c2f9a2733c4ac8df645a14ec`, 52/52 documentos e 48 competências. |\n| A próxima fase é 3.5-B4 — MCCI11 e não inicia automaticamente. | Processar vários fundos em paralelo. | Planejada | Regra de parada entre unidades. |',
  '| Fase 3.5-B3 — KNSC11 está formalmente concluída. | KNSC11 como próxima fase. | Concluída | PR #118, merge `1925b53a268f90b4c2f9a2733c4ac8df645a14ec`, 52/52 documentos e 48 competências. |\n| Fase 3.5-B4 — MCCI11 está formalmente concluída. | MCCI11 pendente. | Concluída | PR #122, merge `d2000807cc51f66288491ccf715f7ed84ab63fb2`, 48/48 documentos e 46 competências selecionadas. |\n| Fase 3.5-B5 — RBRY11 está formalmente concluída. | RBRY11 pendente. | Concluída | PR #125, merge `c616437a0a44c1543015a709911c67f70f390b7d`, 54/54 documentos e 47 competências contínuas. |\n| A próxima fase é 3.5-C — dataset final e backtest e não inicia automaticamente. | Processar dataset/backtest junto com fundos individuais. | Planejada | Regra de parada após a coorte e antes do backtest. |',
  'decisões MCCI/RBRY',
);

replaceRequired(
  '- Fases 3.5-A/DEVA11, 3.5-B1/VSLH11, 3.5-B2/KNCR11 e 3.5-B3/KNSC11 estão concluídas.\n- Sprint 3.5 completa permanece aberta.\n- Próxima unidade: 3.5-B4 — MCCI11.\n- Depois de MCCI11 ainda restam RBRY11, composição do dataset da coorte e backtest sem look-ahead.',
  '- Fases 3.5-A/DEVA11, 3.5-B1/VSLH11, 3.5-B2/KNCR11, 3.5-B3/KNSC11, 3.5-B4/MCCI11 e 3.5-B5/RBRY11 estão concluídas.\n- Os seis fundos da coorte externa estão formalmente concluídos.\n- Sprint 3.5 completa permanece aberta porque dataset e backtest ainda não foram executados.\n- Próxima unidade: 3.5-C — dataset final e backtest externo sem informação futura, ainda não iniciada.',
  'resumo executivo',
);
replaceRequired(
  '| 3.5-B3 — KNSC11 | Sim | Sim | Preview Ready durante a PR; build final saudável; sem código de produto no diff | **Concluída** |\n| Sprint 3.5 completa |',
  '| 3.5-B3 — KNSC11 | Sim | Sim | Preview Ready durante a PR; build final saudável; sem código de produto no diff | **Concluída** |\n| 3.5-B4 — MCCI11 | Sim | Sim | Preview Ready; sem integração de produto | **Concluída** |\n| 3.5-B5 — RBRY11 | Sim | Sim | Preview Ready; sem integração de produto | **Concluída** |\n| Sprint 3.5 completa |',
  'tabela de auditoria',
);
replaceRequired(
  '- 3.5-B3 — KNSC11: concluída.\n- Sprint 3.5 completa: aberta.',
  '- 3.5-B3 — KNSC11: concluída.\n- 3.5-B4 — MCCI11: concluída.\n- 3.5-B5 — RBRY11: concluída.\n- Sprint 3.5 completa: aberta até dataset e backtest.',
  'fases concluídas',
);

const evidenceMarker = '\n---\n\n## 3. Sprint atual';
if (!body.includes(evidenceMarker)) throw new Error('Marcador da seção 3 ausente');
const addedEvidence = `
### Evidência canônica da Fase 3.5-B4 — MCCI11

- issue \`#121\`; PR funcional \`#122\`;
- merge funcional: \`d2000807cc51f66288491ccf715f7ed84ab63fb2\`;
- documentos descobertos/classificados: \`48/48\`;
- observações brutas: \`47\`; competências selecionadas: \`46\`;
- período observado: \`2022-01\` a \`2025-11\`;
- pendências: \`0\`; conflitos: \`0\`; lacuna explícita: \`2025-02\`;
- classe secundária: \`301632\`/MCCI13;
- deriva temporal \`255155\`: competência corrigida para \`2021-12\`, fora da coorte;
- índice de evidência: \`14c6ad2e55053d020688c0c99252e35a45c91a748cd946fd403b9acd0d99a817\`.

### Evidência canônica da Fase 3.5-B5 — RBRY11

- issue \`#124\`; PR funcional \`#125\`;
- merge funcional: \`c616437a0a44c1543015a709911c67f70f390b7d\`;
- documentos descobertos/classificados: \`54/54\`;
- observações brutas no diagnóstico: \`49\`; após retentativa: \`50\`; após sanitização: \`49\`;
- competências selecionadas: \`47\`, contínuas de \`2022-01\` a \`2025-11\`;
- pendências: \`0\`; conflitos: \`0\`; lacunas: \`0\`; maior sequência: \`47\` meses;
- recuperação oficial: \`987180\`, competência \`2025-08\`, R$ 1,25 por cota;
- classes secundárias: \`300850\`/RBRY15, \`300852\`/RBRY14, \`300855\`/RBRY13 e \`350224\`/RBRY13;
- deriva temporal \`254829\`: competência corrigida para \`2021-12\`, fora da coorte;
- reapresentações: \`427520\` v2 substitui \`427474\` v1; \`1009923\` v2 substitui \`1009913\` v1;
- índice de evidência: \`938b856f5a74edcd404b494f68a33654c1f68b4ae01a392de56e6cbc5c741ed1\`.
`;
body = body.replace(evidenceMarker, `\n${addedEvidence}${evidenceMarker}`);

replaceRequired(
  '1. 3.5-A — DEVA11: concluída.\n2. 3.5-B1 — VSLH11: concluída.\n3. 3.5-B2 — KNCR11: concluída.\n4. 3.5-B3 — KNSC11: concluída.\n5. 3.5-B4 — MCCI11: próxima, não iniciada.\n6. 3.5-B5 — RBRY11: planejada.\n7. Composição do dataset imutável da coorte.\n8. Backtest sem look-ahead e relatório de performance.\n9. Gate de encerramento da Sprint 3.5.',
  '1. 3.5-A — DEVA11: concluída.\n2. 3.5-B1 — VSLH11: concluída.\n3. 3.5-B2 — KNCR11: concluída.\n4. 3.5-B3 — KNSC11: concluída.\n5. 3.5-B4 — MCCI11: concluída.\n6. 3.5-B5 — RBRY11: concluída.\n7. 3.5-C — composição do dataset imutável da coorte: próxima, não iniciada.\n8. Backtest sem look-ahead e relatório de performance: não iniciado.\n9. Gate de encerramento da Sprint 3.5: pendente.',
  'ordem interna',
);
replaceRequired(
  '1. **3.5-B4 — MCCI11**.\n2. **3.5-B5 — RBRY11**.\n3. **3.5-C — dataset final e backtest externo sem informação futura**.\n4. **3.6 — calibração e homologação do ruleset**.\n5. **3.7 — Risk Lab read-only no Premium + Prompt Premium v3**.\n6. **SEO-S1, dias 1–15** — pode avançar em paralelo sem alterar a ordem funcional do Risk Lab.\n7. **4.1 — Radar: acompanhar fundo fora da carteira**.\n8. **Fase 4+** — Inteligência documental, Carteira histórica verdadeira, Screener quantitativo, Fair value e sustentabilidade da renda.',
  '1. **3.5-C — dataset final e backtest externo sem informação futura**.\n2. **3.6 — calibração e homologação do ruleset**.\n3. **3.7 — Risk Lab read-only no Premium + Prompt Premium v3**.\n4. **SEO-S1, dias 1–15** — pode avançar em paralelo sem alterar a ordem funcional do Risk Lab.\n5. **4.1 — Radar: acompanhar fundo fora da carteira**.\n6. **Fase 4+** — Inteligência documental, Carteira histórica verdadeira, Screener quantitativo, Fair value e sustentabilidade da renda.',
  'ordem oficial',
);
replaceRequired('### 3.5-B4 — MCCI11\n\nEscopo: processar somente MCCI11', '### 3.5-B4 — MCCI11 — concluída\n\nEscopo concluído: processar somente MCCI11', 'escopo MCCI');
replaceRequired(
  '\n### 3.5-C — dataset e backtest\n',
  '\n### 3.5-B5 — RBRY11 — concluída\n\n- 54/54 documentos classificados;\n- retentativa oficial auditada sem alterar observações anteriores;\n- classes secundárias, deriva temporal e reapresentações resolvidas por regras gerais;\n- 47 competências contínuas, sem lacunas ou conflitos;\n- testes sintéticos, integrais, CI, build, Preview, merge e auditoria do `main` concluídos.\n\n### 3.5-C — dataset e backtest\n',
  'escopo RBRY',
);
replaceRequired(
  '- PR #118 — KNSC11; merge `1925b53a268f90b4c2f9a2733c4ac8df645a14ec`.\n- PR #65',
  '- PR #118 — KNSC11; merge `1925b53a268f90b4c2f9a2733c4ac8df645a14ec`.\n- PR #122 — MCCI11; merge `d2000807cc51f66288491ccf715f7ed84ab63fb2`.\n- PR #125 — RBRY11; merge `c616437a0a44c1543015a709911c67f70f390b7d`.\n- PR #65',
  'lista de PRs',
);
replaceRequired(
  '- `docs/production-evidence/risk-lab/knsc11-phase-b3/`\n- `docs/risk-lab/sprint-3-5-b3-knsc11.md`',
  '- `docs/production-evidence/risk-lab/knsc11-phase-b3/`\n- `docs/production-evidence/risk-lab/mcci11-phase-b4/`\n- `docs/production-evidence/risk-lab/rbry11-phase-b5/`\n- `docs/risk-lab/sprint-3-5-b3-knsc11.md`\n- `docs/risk-lab/sprint-3-5-b4-mcci11.md`\n- `docs/risk-lab/sprint-3-5-b5-rbry11.md`',
  'evidências principais',
);
replaceRequired(
  '- Risk Lab até 3.4 e casos DEVA11, VSLH11, KNCR11 e KNSC11 da Sprint 3.5.',
  '- Risk Lab até 3.4 e os seis casos DEVA11, VSLH11, KNCR11, KNSC11, MCCI11 e RBRY11 da Sprint 3.5.',
  'concluídas',
);
replaceRequired('- Sprint 3.5: quatro de seis fundos concluídos.', '- Sprint 3.5: seis de seis fundos concluídos; dataset e backtest permanecem pendentes.', 'parcial Sprint');
replaceRequired('- MCCI11 e RBRY11.\n- Dataset final, backtest e calibração.', '- Dataset final, backtest e calibração.', 'pendências de fundos');
replaceRequired('- testes determinísticos KNSC11\n- `npm run test:workflow-governance`', '- testes determinísticos KNSC11\n- testes determinísticos MCCI11\n- testes determinísticos RBRY11\n- `npm run test:workflow-governance`', 'gates permanentes');
replaceRequired(
  '- Abrir issue e branch exclusivas para 3.5-B4 — MCCI11.\n- Reutilizar regras gerais de DEVA11, VSLH11, KNCR11 e KNSC11.\n- Não iniciar RBRY11 antes da parada e auditoria do MCCI11.',
  '- Abrir issue e branch exclusivas para 3.5-C — dataset final e backtest externo sem informação futura.\n- Consumir somente os seis casos imutáveis e auditados da coorte.\n- Não iniciar 3.6, Premium ou notificações antes do gate de encerramento da Sprint 3.5.',
  'próxima execução',
);

if ((body.match(/# Dados FII — Documento Canônico de Handoff/g) || []).length !== 1) throw new Error('Handoff canônico duplicado');
writeFileSync(path, body);
console.log('Handoff v6.10.0 gerado com sucesso.');
