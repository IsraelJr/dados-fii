Este documento substitui todos os planejamentos anteriores quando houver divergência.

# Dados FII — Documento Canônico de Handoff

**Versão:** 6.13.0
**Data:** 25/07/2026
**Repositório:** `IsraelJr/dados-fii`
**Branch principal:** `main`
**Base funcional auditada:** `7391791b09b1615a86e29c2002b74f95f55e833e`
**Sprint corrente:** 3.7 — Risk Lab read-only no Premium + Prompt Premium v3 — mesclada, aguardando deployment de produção
**Próxima unidade de trabalho:** concluir deployment de produção e ativação controlada da Sprint 3.7 — bloqueada por quota Vercel
**Política documental:** existe apenas um Handoff canônico versionado no repositório: `DADOS_FII_HANDOFF.md`.

## Como interpretar os status

- **Planejada:** decisão registrada, sem implementação iniciada.
- **Em implementação:** existe branch, issue ou PR ativa, mas os critérios ainda não foram atingidos.
- **Implementada:** existe código ou evidência versionada.
- **Testada:** existem testes automatizados no mesmo SHA.
- **Implantada:** o commit exato possui deployment aplicável identificado e saudável.
- **Formalmente concluída:** código, testes, cobertura, segurança, evidência, merge, auditoria pós-merge e atualização deste Handoff foram comprovados.
- **Inconclusiva:** a evidência não permite afirmar sucesso nem falha sem inventar informação.

Uma validação pontual, confirmação verbal, workflow verde isolado ou teste em poucos tickers não conclui uma fase.

## Decisões vigentes que substituem decisões anteriores

| Decisão vigente | Decisão substituída | Estado | Evidência ou motivo |
|---|---|---|---|
| Este Handoff v6.13.0 é a única referência canônica quando houver divergência. | Handoffs paralelos ou cópias antigas. | Vigente | Evita decisões concorrentes. |
| Fases 1 e 2 estão formalmente concluídas. | Conclusão baseada apenas em fundos sentinela. | Concluída | Regressões globais e catálogo auditado. |
| As Sprints 3.5 e 3.6 estão formalmente concluídas; a 3.7 foi implementada, testada e mesclada, mas ainda não está formalmente concluída. | Sprint 3.7 planejada e não iniciada. | Implementada / bloqueada | PR #134, merge `7391791b09b1615a86e29c2002b74f95f55e833e`; deployment de produção recusado por quota diária do Vercel. |
| A Sprint 3.5 é executada um fundo por PR. | Execução monolítica dos seis fundos. | Vigente | Cada caso tem evidência, hashes, testes e auditoria próprios. |
| Fase 3.5-A — DEVA11 está formalmente concluída. | DEVA11 pendente. | Concluída | 85/85 documentos. |
| Fase 3.5-B1 — VSLH11 está formalmente concluída. | VSLH11 pendente. | Concluída | 79/79 documentos. |
| Fase 3.5-B2 — KNCR11 está formalmente concluída. | KNCR11 pendente. | Concluída | 52/52 documentos e 48 competências. |
| Fase 3.5-B3 — KNSC11 está formalmente concluída. | KNSC11 como próxima fase. | Concluída | PR #118, merge `1925b53a268f90b4c2f9a2733c4ac8df645a14ec`, 52/52 documentos e 48 competências. |
| Fase 3.5-B4 — MCCI11 está formalmente concluída. | MCCI11 pendente. | Concluída | PR #122, merge `d2000807cc51f66288491ccf715f7ed84ab63fb2`, 48/48 documentos e 46 competências selecionadas. |
| Fase 3.5-B5 — RBRY11 está formalmente concluída. | RBRY11 pendente. | Concluída | PR #125, merge `c616437a0a44c1543015a709911c67f70f390b7d`, 54/54 documentos e 47 competências contínuas. |
| Fase 3.5-C — dataset final e backtest está formalmente concluída. | Dataset/backtest pendente. | Concluída | 318 observações, cobertura de 83,33%, zero falso negativo, um falso positivo e um inconclusivo. |
| A Sprint 3.6 — calibração e homologação está formalmente concluída. | Ruleset `0.1.0` não homologado. | Concluída | Ruleset `0.2.0`, 100% de acurácia nos cinco casos verificáveis, zero falso positivo e zero falso negativo. |
| A Sprint 3.7 possui integração read-only, Prompt Premium v3 e Modo Gestor mesclados, mas a próxima unidade continua sendo concluir deployment e ativação controlada. | Promover automaticamente SEO-S1 ou Radar após o merge funcional. | Bloqueada | O runtime recebeu Preview Ready; produção recusou o deploy por `api-deployments-free-per-day` e a flag permanece desligada por padrão. |
| Correções de parser ou cálculo são gerais e testadas. | Patch especial por ticker. | Obrigatória | Evita corrigir um fundo e manter o defeito no universo. |
| Preview Vercel é preferencial; fallback de build só é válido quando o diff não altera código de produto e a indisponibilidade externa está documentada. | Bloquear trabalho por quota externa ou dispensar deployment sem prova equivalente. | Vigente | PR #118 executou typecheck e `next build` no SHA final; mudanças de runtime continuam exigindo deployment real. |
| Risk Lab está integrado ao Premium em modo read-only atrás de feature flag desligada por padrão; notificações continuam proibidas. | Risk Lab totalmente fora do Premium. | Parcial / bloqueada | Código, testes e Preview concluídos; produção e ativação controlada pendentes. |
| O Relatório Premium v2 executa cálculos determinísticos, Risk Lab read-only e Modo Gestor antes da IA. | IA recalculando regras e preenchendo lacunas. | Implementada; rollout pendente | Prompt Premium v3 foi mesclado na PR #134; ativação depende do deployment e da flag. |
| Plano SEO de 90 dias é trilha oficial paralela. | SEO sem ordem ou critérios. | Planejada | Fundação técnica, páginas prioritárias, diferenciação e autoridade. |
| Radar/Acompanhar fundo pertence à Fase 4; Grátis até 1 e Premium até 10. | Radar antecipado. | Planejada | Entitlement precisa ser validado no servidor. |
| Mês corrente não entra em consolidações históricas. | Mês aberto tratado como fechado. | Decidida; PR #65 pendente | Evita divergência navegador versus snapshot. |
| Alertas exigem mudança material e podem virar digest. | Alertas diários repetidos. | Parcial | Reduz ruído e falso alerta. |
| IFIX segue janeiro, maio e setembro, com execução manual no Admin. | Sincronização diária. | Parcial | Menor custo sem perda funcional. |
| Telegram permanece adiado; WhatsApp continua decisão aberta. | Multicanal imediato. | Vigente | Depende de custo, opt-in e templates. |

---

## 1. Estado atual do projeto

### Resumo executivo

- Fases 1 e 2 estão formalmente concluídas.
- Risk Lab 3.0–3.4 e reorganização 3.5-R estão concluídos.
- Fases 3.5-A/DEVA11, 3.5-B1/VSLH11, 3.5-B2/KNCR11, 3.5-B3/KNSC11, 3.5-B4/MCCI11, 3.5-B5/RBRY11 e 3.5-C/dataset e backtest estão formalmente concluídas.
- A Sprint 3.5 está formalmente concluída.
- O backtest consolidou 318 observações e terminou como `completed_requires_calibration`: 3 verdadeiros positivos, 1 verdadeiro negativo, 1 falso positivo, 0 falsos negativos e 1 inconclusivo.
- Cobertura: 83,33%; lead time médio: 220,52 dias.
- A Sprint 3.6 está formalmente concluída; o ruleset `0.2.0` foi homologado com 100% de acurácia nos cinco casos verificáveis, zero falso positivo e zero falso negativo.
- MCCI11 permanece `inconclusive_unscored`, fora da otimização e das métricas pontuadas.
- A Sprint 3.7 foi implementada, testada e mesclada no `main` pelo commit `7391791b09b1615a86e29c2002b74f95f55e833e`.
- O runtime final recebeu Preview Vercel Ready no commit `6bc5940b9ee15cbb8f25865f16a1191074425489`; após isso, somente documentação, manifesto e teste foram alterados.
- O deployment de produção do merge foi recusado por quota diária do Vercel; a feature flag `ENABLE_RISK_LAB_PREMIUM_READONLY` permanece desligada por padrão.
- A Sprint 3.7 não está formalmente concluída e nenhuma etapa seguinte deve iniciar antes da produção e ativação controlada.
- Notificações do Risk Lab continuam proibidas.
- SEO-S1, Prompt Premium v3, Radar, Inteligência documental, Carteira histórica verdadeira, Screener quantitativo e Fair value e sustentabilidade da renda ainda não foram concluídos.

### Auditoria do estado

| Área | Código/evidência | Testes | Deployment aplicável | Status |
|---|---:|---:|---:|---|
| Fase 1 — Regulatory Engine | Sim | Sim | Sim | **Concluída** |
| Fase 2 — Core Intelligence | Sim | Sim | Sim | **Concluída** |
| Risk Lab 3.0–3.4 | Sim | Sim | Sim | **Concluído até 3.4** |
| 3.5-R — reorganização | Sim | Sim | n/a | **Concluída** |
| 3.5-A — DEVA11 | Sim | Sim | Sem efeito de produto | **Concluída** |
| 3.5-B1 — VSLH11 | Sim | Sim | Preview saudável; sem efeito de produto | **Concluída** |
| 3.5-B2 — KNCR11 | Sim | Sim | Preview saudável; sem efeito de produto | **Concluída** |
| 3.5-B3 — KNSC11 | Sim | Sim | Preview Ready durante a PR; build final saudável; sem código de produto no diff | **Concluída** |
| 3.5-B4 — MCCI11 | Sim | Sim | Preview Ready; sem integração de produto | **Concluída** |
| 3.5-B5 — RBRY11 | Sim | Sim | Preview Ready; sem integração de produto | **Concluída** |
| 3.5-C — dataset e backtest | Sim | Sim | Build final saudável; Preview anterior Ready; quota externa documentada; sem integração de produto | **Concluída; requer calibração** |
| Sprint 3.5 completa | Sim | Sim | Produto permanece bloqueado até 3.6 | **Formalmente concluída** |
| Sprint 3.6 — calibração | Sim | Sim | Preview Ready; sem integração de produto | **Formalmente concluída e homologada** |
| Sprint 3.7 — integração read-only | Sim | Sim | Preview do runtime Ready; produção bloqueada por quota | **Mesclada; conclusão formal pendente** |
| Regra de meses encerrados | PR #65 | Testes declarados | Não mesclada | **Em implementação** |
| SEO 90 dias | Plano | n/a | Não iniciado | **Planejada** |
| Prompt Premium v3 | Sim | Sim | Runtime em Preview; produção pendente | **Mesclado na 3.7** |
| Radar/Acompanhar fundo | Não | Não | Não | **Planejada para 4.x** |

### Pendências de dados conhecidas

- Lacuna externa permanece `null`, acompanhada de fonte, data e aviso; nunca vira zero inventado.
- Dados PF/PJ não publicados continuam sinalizados como indisponíveis.
- Divergências históricas de ISIN permanecem sob revisão nos casos documentados.
- Ativos inativados mantêm histórico e evidência oficial.

---

## 2. Fases concluídas

### Fase 1 — Regulatory Engine

Concluída: parser CVM v2, FII/FIAGRO, reconciliação, QA, staging/produção, backup, hash, publicação protegida e rollback.

### Fase 2 — Core Intelligence & Product Foundation

Concluída: `RegulatoryDataService`, repositório, normalização, validação, cache, tipos, `ScoreEngine`, Health, Validation, Admin, Timeline, relatórios, AI Insights, observabilidade, monitor, catálogo, notificações e jobs.

A conclusão não se baseia apenas em TGAR11, VGIA11, MXRF11, KNCA11 ou BODB11; exige regressões globais e cobertura do universo aplicável.

### Fase 3 — Risk Lab

- Sprints 3.0 a 3.4: concluídas.
- 3.5-R: concluída.
- 3.5-A — DEVA11: concluída.
- 3.5-B1 — VSLH11: concluída.
- 3.5-B2 — KNCR11: concluída.
- 3.5-B3 — KNSC11: concluída.
- 3.5-B4 — MCCI11: concluída.
- 3.5-B5 — RBRY11: concluída.
- 3.5-C — dataset e backtest sem look-ahead: concluída; resultado requer calibração.
- Sprint 3.5 completa: formalmente concluída.
- Sprint 3.6 completa: formalmente concluída; ruleset `0.2.0` homologado.
- Sprint 3.7: implementada, testada e mesclada; deployment de produção e ativação controlada pendentes.
- Integração Premium: read-only atrás de feature flag desligada por padrão.
- Notificações do Risk Lab: proibidas.

### Evidência canônica da Fase 3.5-A — DEVA11

- PR `#105`; merge `498654f03ce66bd54598d5a4677c18bbe5bbdc86`;
- documentos descobertos/classificados: `85/85`;
- pendências: `0`; conflitos: `0`;
- observações brutas: `67`; competências: `65`;
- lacuna explícita: `2024-07`;
- índice de evidência: `62a19d9b20b57b49489d7ab51ed85d72505625ca68f47762a5045fc3c650993b`.

### Evidência canônica da Fase 3.5-B1 — VSLH11

- issue `#111`; PR funcional `#112`;
- merge funcional: `1c4c96e571b7daa80a56d9a5be35e2af050e6469`;
- documentos descobertos/classificados: `79/79`;
- pendências: `0`; conflitos: `0`;
- observações brutas: `66`; competências: `64`;
- lacuna explícita: `2023-12`;
- índice de evidência: `952c88ec36f930ce83d153bedb07344226cf8d9029d14ada1576514214269092`.

### Evidência canônica da Fase 3.5-B2 — KNCR11

- issue `#114`; PR funcional `#115`;
- merge funcional: `52c02e41a64a09eaa6d6649c30cd6ddb8f9fb693`;
- documentos descobertos/classificados: `52/52`;
- pendências: `0`; conflitos: `0`;
- observações brutas e competências selecionadas: `48/48`;
- período contínuo: `2022-01` a `2025-12`;
- índice de evidência: `c11de46d43de21e98a3eb6986a8fb5c0692465672c412b3329f20d86a9bfd1bb`.

### Evidência canônica da Fase 3.5-B3 — KNSC11

- issue `#117`; PR funcional `#118`;
- merge funcional: `1925b53a268f90b4c2f9a2733c4ac8df645a14ec`;
- documentos descobertos/classificados: `52/52`;
- observações brutas: `49`; competências selecionadas: `48`;
- período contínuo: `2022-01` a `2025-12`;
- pendências: `0`; conflitos: `0`; lacunas: `0`; maior sequência: `48` meses;
- classes secundárias: `283956`/KNSC13, `283976`/KNSC14 e `283999`/KNSC15;
- reapresentação `2022-01`: `261675` versão 2 substitui `261396` versão 1;
- checkpoint de entrada: `740df8717b831fa892e3a32d35e4cff636381118146676b6191f044a2b006edf`;
- checkpoint finalizado: `1aaccf1822f73a50689899d0f8d7c644da6e9fbb421e16a3ea8ec684e8816216`;
- caso: `4eddc7ed639e97d3828bce8a54d905105d4f60031a1ed8f332695ea97f31b4c2`;
- auditoria: `ec34755f95f6bd25f1af7421b66fc6874d9c73eeb2ab3b924471f765be04a22a`;
- observações: `00ddf8ec44c0f02757b766f3b98781d80649bc1fca973c4b46cf05a866014045`;
- índice de evidência: `149ababbbd26ac4cf21b5462022e0c921cff3ff10a1797f0d4047fda2d3bdb65`.


### Evidência canônica da Fase 3.5-B4 — MCCI11

- issue `#121`; PR funcional `#122`;
- merge funcional: `d2000807cc51f66288491ccf715f7ed84ab63fb2`;
- documentos descobertos/classificados: `48/48`;
- observações brutas: `47`; competências selecionadas: `46`;
- período observado: `2022-01` a `2025-11`;
- pendências: `0`; conflitos: `0`; lacuna explícita: `2025-02`;
- classe secundária: `301632`/MCCI13;
- deriva temporal `255155`: competência corrigida para `2021-12`, fora da coorte;
- índice de evidência: `14c6ad2e55053d020688c0c99252e35a45c91a748cd946fd403b9acd0d99a817`.

### Evidência canônica da Fase 3.5-B5 — RBRY11

- issue `#124`; PR funcional `#125`;
- merge funcional: `c616437a0a44c1543015a709911c67f70f390b7d`;
- documentos descobertos/classificados: `54/54`;
- observações brutas no diagnóstico: `49`; após retentativa: `50`; após sanitização: `49`;
- competências selecionadas: `47`, contínuas de `2022-01` a `2025-11`;
- pendências: `0`; conflitos: `0`; lacunas: `0`; maior sequência: `47` meses;
- recuperação oficial: `987180`, competência `2025-08`, R$ 1,25 por cota;
- classes secundárias: `300850`/RBRY15, `300852`/RBRY14, `300855`/RBRY13 e `350224`/RBRY13;
- deriva temporal `254829`: competência corrigida para `2021-12`, fora da coorte;
- reapresentações: `427520` v2 substitui `427474` v1; `1009923` v2 substitui `1009913` v1;
- índice de evidência: `938b856f5a74edcd404b494f68a33654c1f68b4ae01a392de56e6cbc5c741ed1`.


### Evidência canônica da Fase 3.5-C — dataset e backtest sem look-ahead

- issue `#127`; PR funcional `#128`;
- merge funcional: `ef0c621f2f813009fdb3999b721e4f4a6568c134`;
- dataset: `risk-lab-credit-oos-phase-c-v1`, versão `1.0.0`, metodologia `3.5-C.1`, ruleset `0.1.0`;
- observações consolidadas: `318`;
- duas execuções independentes com hashes idênticos;
- hash da identidade da coorte: `97a3fc3bea0adde463ee3a8d06a9e40a6e90dc0f22303bad85e3dd488bfb7726`;
- hash do dataset: `f18f61b7ddb5cc63955fa9791c6e5e3e43552134aaa28a9dd622a96ee587fcae`;
- hash da evidência do backtest: `4b0ced4e8ef662a23317e850353209b72804745be3afa7dc128e05356b2e7c6f`;
- índice final: `edb90face1dddff390dcbf260cf60dc0bb3c053f20ea4ea5a17a0788b98c308e`;
- resultados: DEVA11 verdadeiro positivo, VSLH11 verdadeiro positivo, KNCR11 verdadeiro negativo, KNSC11 falso positivo, MCCI11 inconclusivo e RBRY11 verdadeiro positivo;
- métricas: cobertura `83,33%`, lead time médio `220,52 dias`, mínimo `90,04` e máximo `422,26`;
- falsos negativos: `0`; falso positivo: `1`; inconclusivo: `1`;
- bloqueadores metodológicos: `0`; calibração obrigatória: `true`; homologação permitida: `false`;
- Premium integrado: `false`; notificações enviadas: `false`.


### Evidência canônica da Sprint 3.6 — calibração e homologação

- issue `#130`; PR funcional `#131`;
- merge funcional: `bfdc186057652a535025d19beae061856624d5c1`;
- ruleset de origem: `0.1.0`; ruleset homologado: `0.2.0`;
- estrutura preservada: 6 meses de baseline, 3 de estresse e 3 de recuperação;
- parâmetros: estresse `80%`, recuperação `89%`, margem mínima `0,5 ponto percentual`;
- espaço pré-registrado: 10 candidatos válidos, de `81%` a `90%`;
- validação: cinco folds leave-one-verified-case-out, todos selecionando `89%`, estáveis e corretos no holdout;
- métricas: 5/5 casos verificáveis corretos, acurácia `100%`, cobertura `83,33%`, falsos positivos `0`, falsos negativos `0`;
- disposições: DEVA11 e VSLH11 `elevated_risk`; KNCR11 `none`; KNSC11 e RBRY11 `informational_recovery`;
- MCCI11: `inconclusive_unscored`, excluído da otimização e das métricas pontuadas;
- hash da configuração: `91bf016c119ebbc929409c28f08a751ec4bcc6cb4f6f344656cfa7ef6818a4ec`;
- hash do relatório: `22b84180531f3687c9b3ebeb691020e75e6cb608777276061997b734090d701a`;
- hash da evidência: `fd695ecf4cbc759f9953ddcaf15ef14f28ba43a0b3d74098dd5cd1938baa9c81`;
- índice final: `35dd492e433855e50849cba05990bb9c5255be6f209fbcce5d5a9cb832ef0017`;
- homologação permitida: `true`; Premium integrado: `false`; notificações enviadas: `false`.

### Evidência canônica da Sprint 3.7 — integração read-only no Premium

- issue `#133`; PR funcional `#134`;
- merge funcional: `7391791b09b1615a86e29c2002b74f95f55e833e`;
- registro runtime: `premium-readonly-v1`, SHA-256 `982b1c9911610eb58ad6e0af5ea6ed801063c2b9f80783a5ee9c0b45b6de9ac9`;
- manifesto autoconsistente: `de2d1abd481e2a66b296dc7eab667277cc8072c807872f9f7b3982da8aa9bbcd`;
- Prompt Premium: `premium-fund-analysis-v3`; Modo Gestor: `premium-manager-mode-v3`;
- feature flag: `ENABLE_RISK_LAB_PREMIUM_READONLY`, padrão `false`;
- disposições preservadas: DEVA11/VSLH11 risco histórico elevado; KNCR11 sem estresse qualificante; KNSC11/RBRY11 recuperação informativa; MCCI11 inconclusivo e não pontuado;
- fundos fora da coorte recebem indisponibilidade explícita, sem classificação por semelhança;
- 16 testes específicos, suíte Risk Lab, regressão Fase 2, política de notificações, typecheck e build verdes;
- Preview do runtime: commit `6bc5940b9ee15cbb8f25865f16a1191074425489`, status Ready;
- head funcional aprovado: `f43f174a417be7a8218f015353a05cc65d1d2dcd`;
- zero review threads; nenhuma notificação ou efeito externo;
- deployment de produção do merge recusado por quota `api-deployments-free-per-day`;
- conclusão formal: `false`; ativação controlada: pendente.

---

## 3. Sprint atual

### Sprint 3.7 — Risk Lab read-only no Premium + Prompt Premium v3

Estado: **implementada, testada e mesclada; conclusão formal bloqueada por deployment de produção**.

Entregas comprovadas:

1. ruleset homologado `0.2.0` consumido em modo read-only;
2. cálculos determinísticos e Modo Gestor executados antes da IA;
3. Prompt Premium v3 sem recomendação automática de investimento;
4. MCCI11 preservado como `inconclusive_unscored`;
5. feature flag, autorização, auditoria, fallback e rollback implementados;
6. notificações e efeitos externos proibidos e testados;
7. Preview real do runtime Ready e CI completa verde.

Bloqueadores de conclusão:

- deployment de produção do merge `7391791b09b1615a86e29c2002b74f95f55e833e` recusado pela quota diária do Vercel;
- `ENABLE_RISK_LAB_PREMIUM_READONLY` deve ser configurada de forma controlada no ambiente após o deployment;
- smoke test autenticado do endpoint Premium em produção ainda não foi executado.

Nenhuma etapa seguinte deve iniciar até esses bloqueadores serem removidos, a produção ser auditada e a issue #133 ser encerrada.

---

## 4. Ordem oficial das próximas sprints

1. **3.7-D — concluir deployment de produção, ativação controlada e smoke test** — bloqueada por quota Vercel.
2. **SEO-S1, dias 1–15** — não iniciar antes do encerramento formal da 3.7, salvo decisão explícita do usuário.
3. **4.1 — Radar: acompanhar fundo fora da carteira**.
4. **Fase 4+** — Inteligência documental, Carteira histórica verdadeira, Screener quantitativo, Fair value e sustentabilidade da renda.

---

## 5. Escopo e critérios de aceite de cada sprint

### 3.5-B4 — MCCI11 — concluída

Escopo concluído: processar somente MCCI11 com regras gerais já validadas, acrescentando regra nova apenas com evidência oficial e teste generalizável.

Critérios mínimos:

- 100% dos documentos descobertos classificados;
- zero pendências ou conflitos não explicados;
- série mensal, proveniência e hashes reproduzíveis;
- duas execuções com resultado idêntico;
- nenhum hardcode por ticker;
- testes sintéticos e integrais;
- gates DEVA11, VSLH11, KNCR11 e KNSC11 preservados;
- CI central e deployment aplicável saudáveis;
- merge e auditoria pós-merge antes da atualização canônica.

### 3.5-B5 — RBRY11 — concluída

- 54/54 documentos classificados;
- retentativa oficial auditada sem alterar observações anteriores;
- classes secundárias, deriva temporal e reapresentações resolvidas por regras gerais;
- 47 competências contínuas, sem lacunas ou conflitos;
- testes sintéticos, integrais, CI, build, Preview, merge e auditoria do `main` concluídos.

### 3.5-C — dataset e backtest — concluída

- seis casos completos e imutáveis;
- verdade-terreno primária com PDFs críticos e hashes;
- 318 observações consolidadas;
- nenhum uso de informação futura;
- duas execuções com hashes idênticos;
- cobertura de 83,33%, 3 verdadeiros positivos, 1 verdadeiro negativo, 1 falso positivo, 0 falsos negativos e 1 inconclusivo;
- resultado `completed_requires_calibration`;
- nenhum efeito em Premium ou notificações;
- evidência persistida no Git e gate permanente na CI.

### 3.6 — calibração — concluída

- dataset e hashes da 3.5-C preservados integralmente;
- espaço de candidatos limitado e versionado antes da seleção;
- nenhuma exceção ou parâmetro por ticker;
- zero look-ahead;
- zero falsos positivos e zero falsos negativos nos cinco casos verificáveis;
- KNSC11 corrigido como recuperação informativa, sem apagar o falso positivo histórico da 3.5-C;
- MCCI11 mantido inconclusivo e fora da otimização;
- todos os folds fora da amostra aprovados;
- ruleset `0.2.0`, evidência, testes, CI, build, Preview, merge e auditoria do `main` concluídos.

### 3.7 — integração read-only — mesclada; produção pendente

- cálculo determinístico antes da IA: concluído;
- IA interpreta, não inventa dados nem recalcula score: concluído;
- conteúdo informativo, sem recomendação de investimento: concluído;
- feature flag, auditoria, fallback e rollback: concluídos;
- Prompt Premium v3 com glossário e impacto prático: concluído;
- Preview real do runtime: concluído;
- deployment e smoke test de produção: pendentes;
- ativação controlada da flag: pendente;
- notificações: continuam proibidas.

### SEO-S1

- fundação técnica, indexação, metadados, sitemap, canonicals e páginas prioritárias;
- medição em Search Console e analytics;
- nenhum conflito com segurança, dados regulatórios ou Risk Lab.

### 4.1 — Radar

- Grátis até 1 fundo;
- Premium até 10 fundos;
- limite validado no servidor;
- acompanhamento fora da carteira, notícias e relatório pré-compra;
- alertas somente por mudança material.

---

## 6. Regras arquiteturais obrigatórias

1. Nenhuma API nova acessa Firestore diretamente; usa `RegulatoryDataService` ou serviço de domínio equivalente.
2. Correções de parser, normalização e cálculo são globais e testadas no universo aplicável.
3. Ausência de dado não vira zero; permanece `null` com proveniência e aviso.
4. Artefatos de Risk Lab são imutáveis, versionados e verificáveis por SHA-256.
5. Seleção de reapresentações é determinística e falha fechado em conflito econômico.
6. GitHub Actions valida o SHA; não é fila persistente, banco, cron infinito ou polling.
7. Estado operacional pertence ao backend/Firestore; runner não permanece aguardando lock.
8. Nenhuma regra de fundo pode conter exceção hardcoded por ticker sem regra geral comprovada.
9. Premium só consome Risk Lab em modo read-only e atrás de feature flag; alertas e efeitos externos permanecem proibidos.
10. IA recebe fatos e cálculos determinísticos; não completa lacunas nem cria evidência.
11. Toda fase tem rollback, logs, métricas, evidência e gate automatizado aplicável.
12. Segurança e autorização são verificadas no servidor; interface não é barreira de segurança.
13. Fallback de build por indisponibilidade externa usa credenciais descartáveis no runner, nunca credenciais reais copiadas ao GitHub.
14. Se o diff alterar código de runtime, build local/CI não substitui Preview ou deployment real.

---

## 7. Arquivos, branches, commits e PRs existentes

### Commits e PRs canônicos recentes

- PR #105 — DEVA11; merge `498654f03ce66bd54598d5a4677c18bbe5bbdc86`.
- PR #112 — VSLH11; merge `1c4c96e571b7daa80a56d9a5be35e2af050e6469`.
- PR #115 — KNCR11; merge `52c02e41a64a09eaa6d6649c30cd6ddb8f9fb693`.
- PR #118 — KNSC11; merge `1925b53a268f90b4c2f9a2733c4ac8df645a14ec`.
- PR #122 — MCCI11; merge `d2000807cc51f66288491ccf715f7ed84ab63fb2`.
- PR #125 — RBRY11; merge `c616437a0a44c1543015a709911c67f70f390b7d`.
- PR #128 — dataset e backtest 3.5-C; merge `ef0c621f2f813009fdb3999b721e4f4a6568c134`.
- PR #131 — calibração e homologação 3.6; merge `bfdc186057652a535025d19beae061856624d5c1`.
- PR #134 — Risk Lab read-only no Premium e Prompt Premium v3; merge `7391791b09b1615a86e29c2002b74f95f55e833e`.
- PR #65 — regra de mês corrente; aberta e precisa de rebase/CI antes de qualquer merge.

### Evidências principais

- `docs/production-evidence/risk-lab/deva11-phase-a/`
- `docs/production-evidence/risk-lab/vslh11-phase-b1/`
- `docs/production-evidence/risk-lab/kncr11-phase-b2/`
- `docs/production-evidence/risk-lab/knsc11-phase-b3/`
- `docs/production-evidence/risk-lab/mcci11-phase-b4/`
- `docs/production-evidence/risk-lab/rbry11-phase-b5/`
- `docs/production-evidence/risk-lab/cohort-phase-c/`
- `docs/production-evidence/risk-lab/cohort-phase-c-manifest.json`
- `docs/production-evidence/risk-lab/calibration-phase-3-6/`
- `docs/production-evidence/risk-lab/calibration-phase-3-6-manifest.json`
- `docs/production-evidence/risk-lab/premium-readonly-phase-3-7-manifest.json`
- `docs/risk-lab/sprint-3-7-premium-readonly.md`
- `docs/premium/PROMPT_PREMIUM_V3.md`
- `src/lib/risk-lab/RiskLabPremiumReadModel.ts`
- `src/lib/risk-lab/risk-lab-premium-readonly-v1.json`
- `tests/risk-lab-premium-readonly.test.ts`
- `tests/risk-lab-premium-integration.test.mjs`
- `docs/risk-lab/sprint-3-6-calibration.md`
- `src/lib/risk-lab/RiskLabRulesetV020.ts`
- `src/lib/risk-lab/FrozenCalibrationPhase36.ts`
- `tests/risk-lab-calibration-phase-3-6.test.ts`
- `tests/risk-lab-calibration-phase-3-6-evidence.test.mjs`
- `docs/risk-lab/sprint-3-5-c-dataset-backtest.md`
- `src/lib/risk-lab/FrozenCohortPhaseC.ts`
- `tests/risk-lab-cohort-phase-c-evidence.test.mjs`
- `tests/risk-lab-frozen-cohort-phase-c.test.ts`
- `docs/risk-lab/sprint-3-5-b3-knsc11.md`
- `docs/risk-lab/sprint-3-5-b4-mcci11.md`
- `docs/risk-lab/sprint-3-5-b5-rbry11.md`
- `tests/risk-lab-knsc11-evidence.test.mjs`
- `tests/canonical-handoff.test.mjs`
- `docs/strategy/PLANO_SEO_90_DIAS_DADOS_FII.md`
- `docs/sources/premium-prompt/REFERENCIAS_PROMPT_PREMIUM_FII.md`

### Branches

Branches de fase são temporárias. O estado aceito pertence ao `main`; branch ou PR aberta não equivale a conclusão.

---

## 8. Funcionalidades concluídas, parciais e pendentes

### Concluídas

- Engine regulatória, FII/FIAGRO, reconciliação e rollback.
- RegulatoryDataService, scores, Health, Validation e Admin.
- Timeline, relatórios, AI Insights e observabilidade.
- Catálogo básico e validações globais da Fase 2.
- Risk Lab até 3.4, Sprint 3.5 e Sprint 3.6 formalmente concluídas; ruleset `0.2.0` homologado.
- Governança central de GitHub Actions, build automatizado do Risk Lab e teste canônico do Handoff.

### Parciais

- Sprint 3.7: código, testes, merge e Preview concluídos; deployment de produção, ativação controlada e smoke test permanecem pendentes.
- Notificações materiais e digest: política definida, revisão ampla ainda necessária.
- IFIX: calendário oficial e card manual parcialmente implantados.
- Regra de meses encerrados: PR #65 não integrada.
- Worker persistente FNET: arquitetura definida, implementação pendente.

### Pendentes

- Deployment de produção, ativação controlada e smoke test da Sprint 3.7.
- SEO-S1 e plano de 90 dias.
- Radar/Acompanhar fundo.
- Inteligência documental e “o que mudou”.
- Carteira histórica verdadeira.
- Screener quantitativo.
- Fair value e sustentabilidade da renda.
- Forma final de cobrança dos planos.

---

## 9. Decisões de segurança

- Admin exige autenticação, e-mail verificado e autorização de servidor.
- `ADMIN` é papel de autorização, não plano comercial.
- Segredos nunca usam prefixo `NEXT_PUBLIC_`.
- Endpoints administrativos são `POST`, autenticados, auditáveis e protegidos contra abuso.
- Jobs automáticos usam segredo próprio e não confiam em parâmetros do cliente.
- Logs não expõem tokens, cookies, payloads pessoais ou dados sensíveis.
- Relatórios são informativos e não prometem retorno ou recomendação personalizada.
- Dados de carteira permanecem segregados por usuário.
- Entitlements de plano são validados no backend.
- Risk Lab só altera o conteúdo do relatório Premium quando a feature flag read-only está ativa; nunca dispara alertas nem efeitos externos.
- Credenciais temporárias de CI são geradas no runner e destruídas no fim do job; não representam acesso real ao Firebase.

---

## 10. Variáveis de ambiente

### Confirmadas ou usadas

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `ADMIN_EMAILS`
- `ENABLE_AUTOMATIC_MONITOR`
- `ENABLE_RISK_LAB_PREMIUM_READONLY`
- credenciais Firebase Admin no servidor
- chave do provedor de IA no servidor
- segredos de jobs/cron no servidor

### Regras

- validar Preview e Produção separadamente quando houver código de runtime;
- não copiar `projectId` do app iOS sem confirmar o projeto web;
- não registrar valores secretos neste documento;
- variável ausente deve produzir erro explícito e observável;
- `ENABLE_RISK_LAB_PREMIUM_READONLY` permanece desligada por padrão e deve ser ativada separadamente por ambiente após deployment saudável;
- valores sintéticos do build nunca são usados em deployment nem persistidos como segredo.

### Pendentes de decisão

- provedor e variáveis de cobrança;
- WhatsApp e templates;
- worker persistente FNET;
- armazenamento e retenção de artefatos operacionais fora do Git.

---

## 11. Testes obrigatórios

### Gates permanentes

- `npm run test:risk-lab`
- testes determinísticos DEVA11
- testes determinísticos VSLH11
- testes determinísticos KNCR11
- testes determinísticos KNSC11
- testes determinísticos MCCI11
- testes determinísticos RBRY11
- testes do dataset e backtest da Fase 3.5-C
- testes de calibração, leave-one-case-out e homologação da Sprint 3.6
- `npm run test:sprint3.7`
- teste de hash integral do registro e manifesto autoconsistente da Sprint 3.7
- `npm run test:workflow-governance`
- `npm run test:handoff`
- `npm run typecheck`
- `npm run test:sprint2`
- `next build` no SHA das PRs de Risk Lab
- Preview Vercel aplicável quando houver alteração de runtime

### Regra de deployment aplicável

- Preview/deployment real é obrigatório quando o diff altera código executado pelo produto.
- Quando a plataforma recusa o deploy antes do build por quota externa e o diff contém somente workflow, testes, documentação, evidência ou código offline do Risk Lab não importado pelo runtime do produto, o `next build` automatizado no SHA pode cumprir o gate.
- A exceção exige registro do erro externo, credenciais descartáveis no runner, typecheck verde e ausência comprovada de integração com código executado pelo produto.
- O fallback de build só é válido quando o diff não altera o comportamento do produto em runtime.
- Se o diff alterar código de runtime, build local/CI não substitui Preview ou deployment real.

### Regra de conclusão

Uma fase só pode ser marcada como concluída quando:

- código está em `main`;
- CI obrigatória está verde no SHA da PR;
- universo aplicável foi coberto;
- correções são globais e testadas;
- evidência final está no Git;
- deployment aplicável foi identificado e está saudável;
- não existem review threads pendentes;
- auditoria pós-merge confirmou o conteúdo no `main`;
- issue da fase só é encerrada após auditoria da `main`;
- Handoff canônico foi atualizado e protegido por teste.

Testes manuais podem complementar, mas não substituir gates automatizados.

---

## 12. Pendências e decisões ainda abertas

### Próxima execução

- Reexecutar o deployment de produção do merge `7391791b09b1615a86e29c2002b74f95f55e833e` quando a quota Vercel permitir.
- Configurar `ENABLE_RISK_LAB_PREMIUM_READONLY=true` de forma controlada no ambiente alvo somente após deployment saudável.
- Executar smoke test autenticado do endpoint Premium e confirmar auditoria `premium-read`.
- Manter notificações bloqueadas e não iniciar SEO-S1 ou Radar antes do encerramento formal da issue #133.

### Decisões de produto

- forma de cobrança e nomes finais dos planos;
- WhatsApp: custo, opt-in, templates e limites;
- Telegram continua adiado;
- escopo do Super Premium;
- política final de retenção dos relatórios e dados históricos.

### Dívidas técnicas e operacionais

- rebase e auditoria da PR #65;
- worker persistente para processamento FNET;
- consolidação do digest de alertas;
- completar dados abertos quando novas fontes oficiais existirem;
- iniciar SEO-S1 sem interromper a ordem do Risk Lab.

### Regra de parada

Este documento registra as Sprints 3.5 e 3.6 como formalmente concluídas e a Sprint 3.7 como implementada, testada e mesclada, porém ainda não formalmente concluída. O Risk Lab read-only e o Prompt Premium v3 estão no `main`, mas o deployment de produção, a ativação controlada e o smoke test permanecem pendentes; notificações continuam proibidas e nenhuma fase seguinte deve iniciar.
