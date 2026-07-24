Este documento substitui todos os planejamentos anteriores quando houver divergência.

# Dados FII — Documento Canônico de Handoff

**Versão:** 6.8.0  
**Data:** 24/07/2026  
**Repositório:** `IsraelJr/dados-fii`  
**Branch principal:** `main`  
**Base funcional auditada:** `1925b53a268f90b4c2f9a2733c4ac8df645a14ec`  
**Sprint corrente:** 3.5 — Coorte externa e backtest sem informação futura  
**Próxima unidade de trabalho:** 3.5-B4 — MCCI11  
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
| Este Handoff v6.8.0 é a única referência canônica quando houver divergência. | Handoffs paralelos ou cópias antigas. | Vigente | Evita decisões concorrentes. |
| Fases 1 e 2 estão formalmente concluídas. | Conclusão baseada apenas em fundos sentinela. | Concluída | Regressões globais e catálogo auditado. |
| A Sprint corrente é a 3.5. | Sprint 3.4 como corrente. | Em andamento | Restam MCCI11, RBRY11, dataset e backtest. |
| A Sprint 3.5 é executada um fundo por PR. | Execução monolítica dos seis fundos. | Vigente | Cada caso tem evidência, hashes, testes e auditoria próprios. |
| Fase 3.5-A — DEVA11 está formalmente concluída. | DEVA11 pendente. | Concluída | 85/85 documentos. |
| Fase 3.5-B1 — VSLH11 está formalmente concluída. | VSLH11 pendente. | Concluída | 79/79 documentos. |
| Fase 3.5-B2 — KNCR11 está formalmente concluída. | KNCR11 pendente. | Concluída | 52/52 documentos e 48 competências. |
| Fase 3.5-B3 — KNSC11 está formalmente concluída. | KNSC11 como próxima fase. | Concluída | PR #118, merge `1925b53a268f90b4c2f9a2733c4ac8df645a14ec`, 52/52 documentos e 48 competências. |
| A próxima fase é 3.5-B4 — MCCI11 e não inicia automaticamente. | Processar vários fundos em paralelo. | Planejada | Regra de parada entre unidades. |
| Correções de parser ou cálculo são gerais e testadas. | Patch especial por ticker. | Obrigatória | Evita corrigir um fundo e manter o defeito no universo. |
| Preview Vercel é preferencial; fallback de build só é válido quando o diff não altera código de produto e a indisponibilidade externa está documentada. | Bloquear trabalho por quota externa ou dispensar deployment sem prova equivalente. | Vigente | PR #118 executou typecheck e `next build` no SHA final; mudanças de runtime continuam exigindo deployment real. |
| Risk Lab permanece fora do Premium e das notificações até 3.5/3.6. | Integração antecipada. | Bloqueada | Produto não pode consumir metodologia não homologada. |
| O Relatório Premium recebe cálculos determinísticos antes da IA. | IA recalculando regras e preenchendo lacunas. | Parcial | Prompt Premium v3 entra depois do Risk Lab. |
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
- Fases 3.5-A/DEVA11, 3.5-B1/VSLH11, 3.5-B2/KNCR11 e 3.5-B3/KNSC11 estão concluídas.
- Sprint 3.5 completa permanece aberta.
- Próxima unidade: 3.5-B4 — MCCI11.
- Depois de MCCI11 ainda restam RBRY11, composição do dataset da coorte e backtest sem look-ahead.
- Risk Lab permanece isolado de Premium e notificações até os gates das Sprints 3.5 e 3.6.
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
| Sprint 3.5 completa | Parcial | Parcial | Produto bloqueado | **Em andamento** |
| Regra de meses encerrados | PR #65 | Testes declarados | Não mesclada | **Em implementação** |
| SEO 90 dias | Plano | n/a | Não iniciado | **Planejada** |
| Prompt Premium v3 | Contrato | Casos definidos | Não implantado | **Planejada para 3.7** |
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
- Sprint 3.5 completa: aberta.
- Integração com Premium/notificações: proibida antes dos gates 3.5/3.6.

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

---

## 3. Sprint atual

### Sprint 3.5 — Coorte externa e backtest sem informação futura

Estado: **em andamento**.

Ordem interna vigente:

1. 3.5-A — DEVA11: concluída.
2. 3.5-B1 — VSLH11: concluída.
3. 3.5-B2 — KNCR11: concluída.
4. 3.5-B3 — KNSC11: concluída.
5. 3.5-B4 — MCCI11: próxima, não iniciada.
6. 3.5-B5 — RBRY11: planejada.
7. Composição do dataset imutável da coorte.
8. Backtest sem look-ahead e relatório de performance.
9. Gate de encerramento da Sprint 3.5.

A conclusão de um fundo não promove automaticamente o seguinte. Cada unidade exige issue, branch, PR, CI, evidência, merge, auditoria do `main` e atualização canônica.

---

## 4. Ordem oficial das próximas sprints

1. **3.5-B4 — MCCI11**.
2. **3.5-B5 — RBRY11**.
3. **3.5-C — dataset final e backtest externo sem informação futura**.
4. **3.6 — calibração e homologação do ruleset**.
5. **3.7 — Risk Lab read-only no Premium + Prompt Premium v3**.
6. **SEO-S1, dias 1–15** — pode avançar em paralelo sem alterar a ordem funcional do Risk Lab.
7. **4.1 — Radar: acompanhar fundo fora da carteira**.
8. **Fase 4+** — Inteligência documental, Carteira histórica verdadeira, Screener quantitativo, Fair value e sustentabilidade da renda.

---

## 5. Escopo e critérios de aceite de cada sprint

### 3.5-B4 — MCCI11

Escopo: processar somente MCCI11 com regras gerais já validadas, acrescentando regra nova apenas com evidência oficial e teste generalizável.

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

### 3.5-C — dataset e backtest

- seis casos completos e imutáveis;
- verdade-terreno primária;
- nenhum uso de informação futura;
- métricas de cobertura, lead time, falso positivo, falso negativo e inconclusivos;
- nenhum efeito em Premium ou notificações;
- resultado reproduzível e evidência persistida no Git.

### 3.6 — calibração

- regras congeladas e versionadas;
- parâmetros derivados sem vazamento de informação;
- controles saudáveis sem falso alerta injustificado;
- aprovação por evidência automatizada, não por revisão manual de conteúdo técnico.

### 3.7 — integração read-only

- cálculo determinístico antes da IA;
- IA interpreta, não inventa dados nem recalcula score;
- conteúdo informativo, sem recomendação de investimento;
- feature flag, auditoria, fallback e rollback;
- Prompt Premium v3 com glossário e impacto prático.

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
9. Premium e alertas não consomem Risk Lab antes das Sprints 3.5 e 3.6.
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
- PR #65 — regra de mês corrente; aberta e precisa de rebase/CI antes de qualquer merge.

### Evidências principais

- `docs/production-evidence/risk-lab/deva11-phase-a/`
- `docs/production-evidence/risk-lab/vslh11-phase-b1/`
- `docs/production-evidence/risk-lab/kncr11-phase-b2/`
- `docs/production-evidence/risk-lab/knsc11-phase-b3/`
- `docs/risk-lab/sprint-3-5-b3-knsc11.md`
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
- Risk Lab até 3.4 e casos DEVA11, VSLH11, KNCR11 e KNSC11 da Sprint 3.5.
- Governança central de GitHub Actions, build automatizado do Risk Lab e teste canônico do Handoff.

### Parciais

- Sprint 3.5: quatro de seis fundos concluídos.
- Notificações materiais e digest: política definida, revisão ampla ainda necessária.
- IFIX: calendário oficial e card manual parcialmente implantados.
- Regra de meses encerrados: PR #65 não integrada.
- Worker persistente FNET: arquitetura definida, implementação pendente.

### Pendentes

- MCCI11 e RBRY11.
- Dataset final, backtest e calibração.
- Prompt Premium v3 e integração read-only.
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
- Risk Lab não dispara alertas nem altera relatório enquanto estiver bloqueado pelos gates.
- Credenciais temporárias de CI são geradas no runner e destruídas no fim do job; não representam acesso real ao Firebase.

---

## 10. Variáveis de ambiente

### Confirmadas ou usadas

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `ADMIN_EMAILS`
- `ENABLE_AUTOMATIC_MONITOR`
- credenciais Firebase Admin no servidor
- chave do provedor de IA no servidor
- segredos de jobs/cron no servidor

### Regras

- validar Preview e Produção separadamente quando houver código de runtime;
- não copiar `projectId` do app iOS sem confirmar o projeto web;
- não registrar valores secretos neste documento;
- variável ausente deve produzir erro explícito e observável;
- flags de Risk Lab permanecem desligadas para Premium/notificações até homologação;
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
- `npm run test:workflow-governance`
- `npm run test:handoff`
- `npm run typecheck`
- `npm run test:sprint2`
- `next build` no SHA das PRs de Risk Lab
- Preview Vercel aplicável quando houver alteração de runtime

### Regra de deployment aplicável

- Preview/deployment real é obrigatório quando o diff altera código executado pelo produto.
- Quando a plataforma recusa o deploy antes do build por quota externa e o diff contém somente workflow, testes, documentação e evidência, o `next build` automatizado no SHA pode cumprir o gate.
- A exceção exige registro do erro externo, credenciais descartáveis no runner, typecheck verde e ausência comprovada de código de produto no diff.
- O fallback de build só é válido quando o diff não altera código de produto.
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

- Abrir issue e branch exclusivas para 3.5-B4 — MCCI11.
- Reutilizar regras gerais de DEVA11, VSLH11, KNCR11 e KNSC11.
- Não iniciar RBRY11 antes da parada e auditoria do MCCI11.

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

Este documento registra o KNSC11 como concluído e o MCCI11 como próximo. A Sprint 3.5 não está concluída, o Risk Lab não está liberado para Premium/notificações e nenhuma fase seguinte deve ser promovida sem evidência e testes próprios.
