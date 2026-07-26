Este documento substitui todos os planejamentos anteriores quando houver divergência.

# Dados FII — Documento Canônico de Handoff

**Versão:** 6.14.0  
**Data:** 26/07/2026  
**Repositório:** `IsraelJr/dados-fii`  
**Branch principal:** `main`  
**Base funcional auditada:** `a3b4f2c010fba3e62e52ed50b8fcacf2706474d2`  
**Estado da Fase 3:** formalmente concluída  
**Próxima unidade de trabalho:** SEO-S1 — fundação técnica e páginas prioritárias; próxima fase funcional: 4.1 — Radar/Acompanhar fundo  
**Política documental:** existe somente um Handoff canônico versionado: `DADOS_FII_HANDOFF.md`.

## Como interpretar os status

- **Planejada:** decisão registrada, sem implementação iniciada.
- **Em implementação:** existe branch, issue ou PR ativa, mas os critérios ainda não foram integralmente atingidos.
- **Implementada:** código ou evidência foi versionado.
- **Testada:** testes automatizados foram executados no mesmo SHA aplicável.
- **Implantada:** o commit exato possui deployment aplicável identificado e saudável.
- **Formalmente concluída:** código, testes, cobertura, segurança, evidência, merge, produção, auditoria pós-merge e Handoff foram comprovados.
- **Inconclusiva:** a evidência não permite afirmar sucesso ou falha sem inventar informação.

Uma confirmação verbal, um workflow isolado ou testes em poucos tickers não concluem fase.

## Decisões vigentes que substituem decisões anteriores

| Decisão vigente | Decisão substituída | Estado | Evidência |
|---|---|---|---|
| Este Handoff v6.14.0 é a única referência canônica quando houver divergência. | Handoffs paralelos ou cópias antigas. | Vigente | Teste `canonical-handoff`. |
| Fases 1, 2 e 3 estão formalmente concluídas. | Fase 3 pendente de produção/ativação. | Concluída | Release `a3b4f2c...`, Vercel `success` e gate de produção `success`. |
| Risk Lab integra o Premium somente em modo read-only. | Risk Lab totalmente isolado do Premium. | Implantada | PRs #134, #136, #137 e #138. |
| O ruleset vigente é `0.2.0`. | Ruleset `0.1.0` não homologado. | Homologada | Calibração 3.6 e registro `premium-readonly-v1`. |
| Notificações e efeitos externos do Risk Lab permanecem proibidos. | Possível promoção automática a alertas. | Vigente | Contrato, testes e health check retornam `false`. |
| Fundo fora da coorte recebe indisponibilidade explícita. | Inferência por semelhança. | Vigente | `outside_verified_cohort`. |
| MCCI11 permanece inconclusivo e não pontuado. | Forçar classificação binária. | Vigente | `inconclusive_unscored`. |
| Correções de parser/cálculo são gerais e testadas. | Patch por ticker. | Obrigatória | Gates de regressão e arquitetura. |
| Radar/Acompanhar fundo pertence à Fase 4.1. | Antecipar Radar na Fase 3. | Planejada | Grátis até 1; Premium até 10; limite no servidor. |
| Telegram permanece adiado; WhatsApp segue decisão aberta. | Multicanal imediato. | Vigente | Depende de custo, opt-in e templates. |

---

## 1. Estado atual do projeto

### Resumo executivo

- Fase 1 — Regulatory Engine: formalmente concluída.
- Fase 2 — Core Intelligence & Product Foundation: formalmente concluída.
- Fase 3 — Risk Lab: formalmente concluída em 26/07/2026.
- Sprint 3.5: seis fundos, dataset e backtest concluídos.
- Sprint 3.6: ruleset `0.2.0` homologado.
- Sprint 3.7: integração Premium read-only, Prompt Premium v3, Modo Gestor, feature flag, autorização, auditoria, fallback, rollback, health check e gate pós-deploy concluídos.
- Release funcional auditada: `a3b4f2c010fba3e62e52ed50b8fcacf2706474d2`.
- Deployment Vercel do mesmo SHA: `success`.
- Commit status `Risk Lab Premium Production Gate`: `success`.
- Execução do gate: `30219287742`.
- Evidência final: `docs/production-evidence/risk-lab/phase-3-final-closure.json`.
- Notificações do Risk Lab continuam proibidas.

### Auditoria do estado

| Área | Código | Testes | Produção | Status |
|---|---:|---:|---:|---|
| Fase 1 | Sim | Sim | Sim | **Formalmente concluída** |
| Fase 2 | Sim | Sim | Sim | **Formalmente concluída** |
| Risk Lab 3.0–3.4 | Sim | Sim | Sim | **Concluído** |
| Sprint 3.5 | Sim | Sim | Sem integração de produto | **Formalmente concluída** |
| Sprint 3.6 | Sim | Sim | Registro homologado | **Formalmente concluída** |
| Sprint 3.7 | Sim | Sim | Vercel + gate pós-deploy verdes | **Formalmente concluída** |
| Fase 3 completa | Sim | Sim | Sim | **Formalmente concluída** |
| SEO-S1 | Plano | n/a | Não iniciado | **Próxima unidade** |
| Fase 4.1 — Radar | Não | Não | Não | **Planejada** |

### Pendências de dados conhecidas

- Lacuna externa permanece `null`, com fonte, data e aviso; nunca vira zero inventado.
- Dados PF/PJ não publicados permanecem sinalizados como indisponíveis.
- Divergências históricas de ISIN permanecem sob revisão quando documentadas.
- Ativos inativados preservam histórico e evidência oficial.

---

## 2. Fases concluídas

### Fase 1 — Regulatory Engine

Concluída com parser CVM v2, suporte FII/FIAGRO, reconciliação, QA, publicação protegida, backup, hash, rollback e auditoria.

### Fase 2 — Core Intelligence & Product Foundation

Concluída com `RegulatoryDataService`, repositório, normalização, validação, cache, tipos, `ScoreEngine`, Health, Validation, Admin, Timeline, relatórios, AI Insights, observabilidade, monitor, catálogo, notificações e jobs.

A conclusão não depende apenas de TGAR11, VGIA11, MXRF11, KNCA11 ou BODB11; os gates cobrem o universo aplicável.

### Fase 3 — Risk Lab

Formalmente concluída:

- 3.0–3.4: infraestrutura, regras determinísticas, persistência, auditoria e produção.
- 3.5-R: reorganização.
- 3.5-A — DEVA11: 85/85 documentos.
- 3.5-B1 — VSLH11: 79/79 documentos.
- 3.5-B2 — KNCR11: 52/52 documentos e 48 competências.
- 3.5-B3 — KNSC11: 52/52 documentos e 48 competências.
- 3.5-B4 — MCCI11: 48/48 documentos; caso preservado como inconclusivo.
- 3.5-B5 — RBRY11: 54/54 documentos e 47 competências contínuas.
- 3.5-C: 318 observações, backtest sem look-ahead e evidência imutável.
- 3.6: calibração leave-one-case-out e homologação do ruleset `0.2.0`.
- 3.7: integração read-only no Premium e Prompt Premium v3 em produção.

Métricas homologadas da coorte verificável:

- acurácia: `100%` em cinco casos verificáveis;
- cobertura: `83,33%`;
- falsos positivos: `0`;
- falsos negativos: `0`;
- MCCI11: `inconclusive_unscored`, fora da otimização e das métricas pontuadas.

---

## 3. Sprint atual

Não existe Sprint da Fase 3 em aberto.

A Sprint 3.7 foi formalmente concluída com:

1. ruleset `0.2.0` e hashes conferidos;
2. cálculos determinísticos antes da IA;
3. IA restrita a interpretação;
4. feature flag `ENABLE_RISK_LAB_PREMIUM_READONLY`;
5. código fail-closed, com padrão `false`;
6. ativação explícita no deployment;
7. autorização Premium no servidor;
8. auditoria `premium-read`;
9. fallback fora da coorte;
10. MCCI11 inconclusivo;
11. notificações e efeitos externos bloqueados;
12. Preview, produção e smoke test no mesmo SHA;
13. rollback por flag ou reversão de commit.

---

## 4. Ordem oficial das próximas sprints

1. **SEO-S1 — dias 1–15:** fundação técnica, indexação, metadados, sitemap, canonicals e páginas prioritárias.
2. **Fase 4.1 — Radar/Acompanhar fundo:** acompanhamento fora da carteira.
3. **Fase 4+:** inteligência documental, “o que mudou”, carteira histórica verdadeira, screener quantitativo, fair value e sustentabilidade da renda.

SEO-S1 pode avançar como trilha paralela sem alterar as regras de segurança ou a evidência congelada do Risk Lab.

---

## 5. Escopo e critérios de aceite de cada sprint

### Sprint 3.5 — concluída

- seis casos processados com regras gerais;
- documentos classificados e conflitos explicados;
- séries mensais com proveniência e hashes;
- duas execuções reproduzíveis;
- nenhum hardcode condicional por ticker;
- dataset congelado e backtest sem informação futura;
- evidência no Git e gates permanentes.

### Sprint 3.6 — concluída

- espaço de candidatos limitado e pré-registrado;
- calibração sem look-ahead;
- folds leave-one-verified-case-out;
- zero falso positivo e zero falso negativo nos casos verificáveis;
- MCCI11 fora da otimização;
- ruleset `0.2.0` homologado.

### Sprint 3.7 — concluída

- cálculo determinístico antes da IA;
- integração Premium read-only;
- Prompt Premium v3;
- Modo Gestor com limitações explícitas;
- autorização e auditoria no servidor;
- feature flag e rollback;
- fallback fora da coorte;
- health check operacional sem dados sensíveis;
- gate pós-deploy no SHA exato;
- nenhum alerta, e-mail, WhatsApp, Telegram ou alteração de carteira.

### SEO-S1 — próxima

- indexação técnica saudável;
- metadados e canonicals consistentes;
- sitemap e páginas prioritárias;
- medição em Search Console e analytics;
- nenhum conflito com segurança, dados regulatórios ou Risk Lab.

### Fase 4.1 — Radar

- Grátis acompanha até 1 fundo;
- Premium acompanha até 10 fundos;
- limite validado no backend;
- acompanhamento fora da carteira;
- notícias e relatório pré-compra;
- alertas somente por mudança material.

---

## 6. Regras arquiteturais obrigatórias

1. APIs novas usam `RegulatoryDataService` ou serviço de domínio equivalente; não acessam Firestore diretamente.
2. Correções de parser, normalização e cálculo são globais e testadas.
3. Ausência de dado permanece `null`; não vira zero.
4. Artefatos do Risk Lab são imutáveis, versionados e verificáveis por SHA-256.
5. Reapresentações são selecionadas deterministicamente e conflitos econômicos falham fechado.
6. GitHub Actions não é fila, banco, cron de aplicação ou mecanismo de polling.
7. Estado operacional pertence ao backend/Firestore.
8. Não existe exceção hardcoded por ticker sem regra geral comprovada.
9. IA recebe fatos determinísticos e não recalcula score nem preenche lacunas.
10. Segurança e entitlement são validados no servidor.
11. Runtime alterado exige Preview e deployment real.
12. Toda fase exige logs, métricas, evidência, rollback e gate automatizado aplicável.
13. O Risk Lab Premium permanece read-only até uma futura fase aprovar outro contrato.
14. Notificações do Risk Lab continuam proibidas até gate específico futuro.

---

## 7. Arquivos, branches, commits e PRs existentes

### Commits e PRs canônicos da Fase 3

- PR #105 — DEVA11; merge `498654f03ce66bd54598d5a4677c18bbe5bbdc86`.
- PR #112 — VSLH11; merge `1c4c96e571b7daa80a56d9a5be35e2af050e6469`.
- PR #115 — KNCR11; merge `52c02e41a64a09eaa6d6649c30cd6ddb8f9fb693`.
- PR #118 — KNSC11; merge `1925b53a268f90b4c2f9a2733c4ac8df645a14ec`.
- PR #122 — MCCI11; merge `d2000807cc51f66288491ccf715f7ed84ab63fb2`.
- PR #125 — RBRY11; merge `c616437a0a44c1543015a709911c67f70f390b7d`.
- PR #128 — dataset/backtest 3.5-C; merge `ef0c621f2f813009fdb3999b721e4f4a6568c134`.
- PR #131 — calibração 3.6; merge `bfdc186057652a535025d19beae061856624d5c1`.
- PR #134 — integração funcional 3.7; merge `7391791b09b1615a86e29c2002b74f95f55e833e`.
- PR #135 — estado canônico pendente de produção; merge `4577ace58220e3ca800c3f1a89500ff31b7bfcd2`.
- PR #136 — ativação controlada; merge `3062d8c5b568af90733451d1fe973a99637b1a58`.
- PR #137 — health check e gate pós-deploy; merge `b19b6dda25142814d4e0e0ac72c65a733f8ab3e0`.
- PR #138 — status auditável do gate; merge `a3b4f2c010fba3e62e52ed50b8fcacf2706474d2`.
- Issue #133 — encerrada como `completed` após o merge da evidência final.
- PR #65 — regra de mês corrente; permanece separada da Fase 3 e requer rebase/auditoria.

### Evidências principais

- `docs/production-evidence/risk-lab/cohort-phase-c/`
- `docs/production-evidence/risk-lab/calibration-phase-3-6/`
- `docs/production-evidence/risk-lab/premium-readonly-phase-3-7-manifest.json`
- `docs/production-evidence/risk-lab/phase-3-final-closure.json`
- `src/lib/risk-lab/RiskLabRulesetV020.ts`
- `src/lib/risk-lab/RiskLabPremiumReadModel.ts`
- `src/lib/risk-lab/risk-lab-premium-readonly-v1.json`
- `src/app/api/health/risk-lab-premium/route.ts`
- `.github/workflows/risk-lab-premium-production-gate.yml`

---

## 8. Funcionalidades concluídas, parciais e pendentes

### Concluídas

- Regulatory Engine e publicação protegida.
- Core Intelligence e serviços de dados.
- Relatório gratuito e Premium.
- AI Insights e Prompt Premium v3.
- Modo Gestor determinístico.
- Risk Lab 3.0–3.7.
- Integração Premium read-only do Risk Lab.
- Health check e gate automatizado pós-deploy.
- Autorização, auditoria, fallback e rollback da integração.

### Parciais

- Alertas: mudança material implementada parcialmente; digest unificado ainda é dívida.
- IFIX: calendário oficial e execução manual parcialmente implantados.
- Regra de meses encerrados: PR #65 não integrada.
- Worker persistente FNET: arquitetura definida, implementação pendente.

### Pendentes

- SEO-S1.
- Radar/Acompanhar fundo.
- Inteligência documental e “o que mudou”.
- Carteira histórica verdadeira.
- Screener quantitativo.
- Fair value e sustentabilidade da renda.
- Forma final de cobrança e escopo do Super Premium.

---

## 9. Decisões de segurança

- Admin exige autenticação, e-mail verificado e autorização no servidor.
- `ADMIN` é papel de autorização, não plano comercial.
- Segredos nunca usam prefixo `NEXT_PUBLIC_`.
- Endpoints administrativos são autenticados, auditáveis e protegidos contra abuso.
- Jobs automáticos usam segredo próprio.
- Logs não expõem tokens, cookies ou dados pessoais.
- Carteiras são segregadas por usuário.
- Entitlements são validados no backend.
- Relatórios são informativos e não prometem retorno.
- Risk Lab não envia notificações nem altera carteira.
- Health check expõe somente estado operacional não sensível.
- O gate de produção possui apenas `statuses: write`; não escreve conteúdo nem cria PR.
- Rollback imediato: `ENABLE_RISK_LAB_PREMIUM_READONLY=false`.

---

## 10. Variáveis de ambiente

### Confirmadas ou usadas

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `ADMIN_EMAILS`
- `ENABLE_AUTOMATIC_MONITOR`
- `ENABLE_REPORT_PREMIUM`
- `ENABLE_RISK_LAB_PREMIUM_READONLY`
- credenciais Firebase Admin no servidor
- chave do provedor de IA no servidor
- segredos de jobs/cron no servidor

### Regras

- Preview e Produção são validados separadamente quando há runtime.
- `ENABLE_RISK_LAB_PREMIUM_READONLY` tem padrão de código `false`.
- A ativação em produção é explícita e versionada.
- Variável ausente produz fallback seguro e observável.
- Valores secretos não são registrados neste documento.
- Credenciais sintéticas de CI não são usadas em deployment real.

### Pendentes de decisão

- provedor e variáveis de cobrança;
- WhatsApp e templates;
- worker persistente FNET;
- retenção de artefatos operacionais fora do Git.

---

## 11. Testes obrigatórios

### Gates permanentes

- `npm run test:risk-lab`
- testes determinísticos de DEVA11, VSLH11, KNCR11, KNSC11, MCCI11 e RBRY11
- testes do dataset/backtest 3.5-C
- testes de calibração 3.6
- `npm run test:sprint3.7`
- teste de configuração de rollout
- teste do health check
- teste do gate de produção
- `npm run test:workflow-governance`
- `npm run test:handoff`
- `npm run typecheck`
- `npm run test:sprint2`
- `next build`
- Preview Vercel quando há runtime
- Vercel de produção no SHA final
- commit status `Risk Lab Premium Production Gate = success`

### Regra de conclusão

Uma fase só pode ser concluída quando:

- código está em `main`;
- CI obrigatória está verde;
- universo aplicável foi coberto;
- correções são gerais e testadas;
- evidência final está no Git;
- deployment aplicável está saudável;
- review threads abertas são zero;
- auditoria pós-merge confirmou o conteúdo;
- issue foi encerrada após auditoria;
- Handoff foi atualizado e protegido por teste.

Testes manuais podem complementar, mas não substituir gates automatizados.

---

## 12. Pendências e decisões ainda abertas

### Próxima execução

- iniciar SEO-S1 conforme o plano de 90 dias;
- depois iniciar Fase 4.1 — Radar/Acompanhar fundo;
- não modificar dataset, verdade-terreno ou hashes históricos da Fase 3;
- qualquer expansão da coorte exige nova evidência e nova fase.

### Decisões de produto

- forma de cobrança e nomes finais dos planos;
- escopo do Super Premium;
- WhatsApp: custo, opt-in, templates e limites;
- política de retenção de relatórios e dados históricos;
- Telegram permanece adiado.

### Dívidas técnicas e operacionais

- rebase e auditoria da PR #65;
- worker persistente FNET;
- digest unificado de alertas;
- completar dados abertos quando novas fontes oficiais existirem;
- executar SEO-S1 sem reabrir ou reescrever a evidência da Fase 3.

### Regra de parada

A Fase 3 está formalmente concluída. O Risk Lab `0.2.0` está em produção no Relatório Premium exclusivamente em modo read-only, com autorização e auditoria no servidor, fallback explícito, rollback, notificações bloqueadas e gate pós-deploy verde no SHA `a3b4f2c010fba3e62e52ed50b8fcacf2706474d2`.
