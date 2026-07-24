Este documento substitui todos os planejamentos anteriores quando houver divergência.

# Dados FII — Documento Canônico de Handoff

**Versão:** 6.6.0  
**Data:** 24/07/2026  
**Repositório:** `IsraelJr/dados-fii`  
**Branch principal:** `main`  
**Base funcional auditada:** `1c4c96e571b7daa80a56d9a5be35e2af050e6469`  
**Sprint corrente:** 3.5 — Coorte externa e backtest sem informação futura  
**Próxima unidade de trabalho:** 3.5-B2 — KNCR11  
**Política documental:** existe apenas um Handoff canônico versionado no repositório: `DADOS_FII_HANDOFF.md`.

## Como interpretar os status

- **Planejada:** decisão registrada, sem implementação iniciada.
- **Em implementação:** existe branch, issue ou PR ativa, mas os critérios de aceite não foram atingidos.
- **Implementada:** existe código versionado.
- **Testada:** existem testes automatizados versionados no mesmo SHA.
- **Implantada:** o commit exato possui deployment aplicável identificado e saudável.
- **Formalmente concluída:** código, testes, cobertura do universo, segurança, evidência, merge, auditoria pós-merge e atualização deste Handoff foram comprovados.
- **Inconclusiva:** a evidência não permite afirmar sucesso nem falha sem inventar informação.

Uma validação pontual, confirmação verbal, workflow verde ou teste de poucos tickers não conclui isoladamente uma fase.

## Decisões vigentes que substituem decisões anteriores

| Decisão vigente | Decisão substituída | Estado | Motivo/evidência |
|---|---|---|---|
| Este Handoff v6.6.0 é a única referência canônica quando houver divergência. | Handoffs versionados paralelos, inclusive cópias antigas da Biblioteca. | Vigente | Evita decisões concorrentes. |
| Fases 1 e 2 estão formalmente concluídas em Produção sob evidência global. | Fase 2 apenas validada funcionalmente ou por fundos sentinela. | Concluída | Catálogo, double check, checks de domínio e regressões globais persistidos. |
| Sprint corrente é a 3.5. | Sprint 3.4 como corrente. | Em andamento | A coorte externa ainda possui quatro fundos, dataset e backtest pendentes. |
| A Sprint 3.5 é executada um fundo por PR. | Execução monolítica dos seis fundos e recovery por commits. | Parcial | DEVA11 e VSLH11 comprovaram o modelo faseado. |
| Fase 3.5-A — DEVA11 está formalmente concluída. | DEVA11 pendente ou dependente de aprovação manual. | Concluída | 85/85 documentos, zero pendências, zero conflitos e hashes reproduzíveis. |
| Fase 3.5-B1 — VSLH11 está formalmente concluída. | VSLH11 como próxima fase planejada ou não iniciada. | Concluída | PR #112, merge `1c4c96e571b7daa80a56d9a5be35e2af050e6469`, 79/79 documentos, zero pendências, zero conflitos e 64 competências. |
| A próxima fase é 3.5-B2 — KNCR11 e não inicia automaticamente. | Manter VSLH11 como próximo ou processar vários fundos em paralelo. | Planejada | Cada caso exige evidência, hashes, testes e auditoria próprios. |
| GitHub Actions é ferramenta de engenharia ligada ao SHA. | Actions como cron, fila, polling, storage ou mecanismo de retry. | Concluída | PR #101 removeu cascatas e escrita operacional no Git. |
| Estado operacional pertence ao backend/Firestore. | Runner aguardando locks, dormindo ou processando continuamente. | Parcial | Kickoff curto; worker persistente ainda pendente. |
| Toda correção de dados, cálculo ou parser deve ser global e testada. | Patch especial por ticker. | Obrigatória | O mesmo defeito pode afetar todo o universo. |
| O Relatório Premium recebe cálculos determinísticos antes da IA. | IA recalculando regras, pesos, scores ou preenchendo lacunas. | Parcial | Prompt Premium v3 entra após homologação do Risk Lab. |
| Análise técnica fica fora do núcleo do Premium. | Stop, target, strong buy/sell e sinais técnicos no relatório principal. | Vigente | Exigiria módulo separado, séries, backtest e revisão jurídica. |
| Plano SEO de 90 dias é trilha oficial paralela. | SEO sem ordem ou critério de saída. | Planejada | Foundation → páginas prioritárias → diferenciação → autoridade. |
| Radar/Acompanhar fundo pertence à Fase 4; limite-base: 1 Grátis e 10 Premium. | Radar antecipado para Fase 3 ou limite apenas na interface. | Planejada | Entitlement deve ser validado no servidor. |
| Mês corrente não participa de maior/menor mês, total, média ou consolidações históricas. | Mês corrente tratado como fechado. | Decidida; PR #65 pendente | Evita divergência navegador versus Firestore. |
| Notificações exigem mudança material e alertas correlatos viram digest. | Notificações diárias sem mudança e múltiplos e-mails no ciclo. | Parcial | Reduz ruído e falso alerta. |
| IFIX segue ciclo oficial de janeiro, maio e setembro, com execução manual no Admin. | Sincronização diária. | Parcial | Menor custo sem perda funcional. |
| `ADMIN` é autorização, não plano comercial. | ADMIN exibido como plano. | Vigente | Separa segurança de monetização. |
| Telegram permanece adiado; WhatsApp continua decisão aberta. | Multicanal obrigatório imediato. | Vigente | Canal depende de custo, opt-in, templates e métricas. |

---

## 1. Estado atual do projeto

### Resumo executivo

- Fundação regulatória, `RegulatoryDataService`, scores, validação, Dashboard Admin, Timeline, relatórios, IA, observabilidade, monitor e notificações estão implementados.
- Fases 1 e 2 estão formalmente concluídas.
- Catálogo auditado: `504/504` ativos com cadastro básico, `97,81%` de cobertura essencial aplicável e zero CNPJ duplicado no run canônico.
- Risk Lab 3.0–3.4 está concluído; Sprint 3.4 foi homologada com `11/11` checks, `6/6` casos e zero blockers.
- Fases 3.5-R, 3.5-A/DEVA11 e 3.5-B1/VSLH11 estão concluídas.
- Sprint 3.5 completa permanece aberta.
- Próxima unidade: 3.5-B2 — KNCR11.
- Risk Lab permanece isolado do Premium e das notificações até os gates das Sprints 3.5 e 3.6.
- O merge funcional do VSLH11 passou por Risk Lab integral, gates DEVA11/VSLH11, governança, Handoff, typecheck, regressão da Fase 2 e Preview Vercel.
- A evidência final do VSLH11 foi auditada em `main` no commit `1c4c96e571b7daa80a56d9a5be35e2af050e6469`.
- SEO-S1, Radar, Prompt Premium v3, ledger histórico, risco avançado, screener e fair value ainda não foram concluídos.

### Auditoria do estado

| Área | Código | Testes | Deployment aplicável | Evidência no Git | Status |
|---|---:|---:|---:|---:|---|
| Fase 1 — Regulatory Engine | Sim | Sim | Sim | Schema v2, publicação e rollback | **Concluída** |
| Fase 2 — Core Intelligence | Sim | Sim | Sim | Checks globais e catálogo | **Concluída** |
| Risk Lab 3.0–3.4 | Sim | Sim | Sim | 11/11 checks e 6/6 casos | **Concluído até 3.4** |
| 3.5-R — reorganização | Sim | Sim | n/a | Plano faseado e recovery removido | **Concluída** |
| 3.5-A — DEVA11 | Sim | Sim | Saudável; sem efeito de produto | 85/85 e 65 competências | **Concluída** |
| 3.5-B1 — VSLH11 | Sim | Sim | Preview saudável; sem efeito de produto | 79/79 e 64 competências | **Concluída** |
| Sprint 3.5 completa | Parcial | Parcial | Produto bloqueado | Quatro fundos, dataset e backtest faltam | **Em andamento** |
| Otimização GitHub Actions | Sim | Sim | Saudável | Política e teste de governança | **Concluída** |
| Regra de meses encerrados | PR #65 | Testes declarados na branch | Não mesclada | PR desatualizada | **Em implementação** |
| SEO 90 dias | Não | n/a | Não iniciado | Plano versionado | **Planejada** |
| Prompt Premium v3 | Contrato | Casos definidos | Não implantado | Referências versionadas | **Planejada para 3.7** |
| Radar/Acompanhar fundo | Não | Não | Não | Regras definidas | **Planejada para 4.x** |

### Pendências de dados conhecidas

- PF/PJ não publicado nas fontes estruturadas para `BFCC11`, `BRHT11`, `BTML11`, `FINF11`, `IDUA11`, `MTOF11`, `PBLV11`, `REME11`, `RRES11` e `SPAF11`.
- `RJDA11` também sem cotas emitidas, patrimônio líquido e total de cotistas nos layouts usados.
- Divergências históricas de ISIN em revisão: `KISU11`, `SPTW11` e `TRXF11`.
- `HGPO11` inativado com evidência oficial e histórico preservado.
- Lacuna externa permanece `null`, com fonte, data e aviso; nunca vira zero inventado.

---

## 2. Fases concluídas

### Fase 1 — Regulatory Engine

**Concluída:** parser CVM v2, FII/FIAGRO, reconciliação, QA, staging/produção, backup, hash, publicação protegida, rollback e CI.

### Fase 2 — Core Intelligence & Product Foundation

**Concluída:** `RegulatoryDataService`, repositório, normalização, validação, cache, tipos, `ScoreEngine`, Health, Validation, Admin, Timeline, relatórios, AI Insights, observabilidade, monitor, catálogo, notificações e jobs.

A conclusão não se baseia apenas em TGAR11, VGIA11, MXRF11, KNCA11 ou BODB11; exige regressões globais e cobertura do universo aplicável.

### Fase 3 — Risk Lab

- Sprints 3.0 a 3.4: concluídas.
- 3.5-R: concluída.
- 3.5-A — DEVA11: concluída.
- 3.5-B1 — VSLH11: concluída.
- Sprint 3.5 completa: aberta.
- Integração com Premium/notificações: proibida antes dos gates 3.5/3.6.

### Evidência canônica da Fase 3.5-A — DEVA11

- PR `#105`; merge `498654f03ce66bd54598d5a4677c18bbe5bbdc86`;
- documentos descobertos/classificados: `85/85`;
- pendências: `0`; conflitos: `0`;
- observações brutas: `67`; competências: `65`;
- lacuna explícita: `2024-07`;
- checkpoint: `6b923ceeff2a0a9ddcd27d72b4d8125d3b2cc6aca6109c57531c3efed36d4a89`;
- caso: `fca3de0e38755c8213d7e37d5112b51733c794dd29a2f2f7cb5be82980313aa2`;
- auditoria: `157e807f7a61c4d9bb34eedc324e761c8a19c25ac93505023606f6ffcd2159af`;
- observações: `6788292746eeb5321d36cd198c75b5810c3797cead357341cc04df9254fee20c`;
- índice: `62a19d9b20b57b49489d7ab51ed85d72505625ca68f47762a5045fc3c650993b`.

### Evidência canônica da Fase 3.5-B1 — VSLH11

- issue `#111`; PR funcional `#112`;
- merge funcional: `1c4c96e571b7daa80a56d9a5be35e2af050e6469`;
- documentos descobertos/classificados: `79/79`;
- pendências: `0`; conflitos: `0`;
- observações brutas após reconciliação: `66`; competências selecionadas: `64`;
- período: fevereiro de 2021 a junho de 2026;
- lacuna explícita: `2023-12`;
- maior sequência contínua: `34` meses;
- abortos transitórios recuperados por evidência oficial: `312220` e `1055396`;
- treze classes secundárias `VSLH13`, `VSLH14` e `VSLH15` classificadas pela regra geral de família;
- reapresentações: `152886 → 153493` e `191952 → 192026`;
- duas execuções independentes com hashes idênticos;
- checkpoint principal: `2de8f866fd4b4400b309090830a282f2bb1ccc97689ce1745a6c0faca251d755`;
- checkpoint reconciliado: `29c18ce11077894d024738513882ca8e7cfe7a09c7e5eeb7659f4552e8c1277f`;
- reconciliação: `b6d944ea86854254cba6bfd22a1a15f388574bb83a4e1b0a546f71718a76eb25`;
- caso: `a24d0185599fa80c2606dfc8a462dfe77bc4fad76a4a86e82dc8dc127768299d`;
- auditoria: `ece06fcc7b4ac7317d80e00747f3be458ec3ff322c5284020ebaead73e23365f`;
- observações: `2551679cf4a16ecb389c474f26c541670db69c7c39f34484a28cc6a61cae85ea`;
- índice de evidência: `952c88ec36f930ce83d153bedb07344226cf8d9029d14ada1576514214269092`;
- auditoria pós-merge confirmou o índice completo em `main`.

### Ainda não concluído

Sprint 3.5 completa; Risk Lab no produto; Prompt Premium v3; alertas de impacto; Radar; SEO Foundation; ledger; risco avançado; screener; fair value; monetização e canais definitivos.

---

## 3. Sprint atual

### Sprint 3.5 — Coorte externa e backtest sem informação futura

**Objetivo:** verificar a coorte pré-registrada em fontes primárias, congelar o dataset e executar backtest sem look-ahead, preservando o ruleset `v0.1.0` até calibração formal.

**Coorte:** `DEVA11`, `VSLH11`, `KNCR11`, `KNSC11`, `MCCI11`, `RBRY11`.

**Sequência obrigatória:**

1. 3.5-R — reorganização: concluída;
2. 3.5-A — DEVA11: concluída;
3. 3.5-B1 — VSLH11: concluída;
4. 3.5-B2 — KNCR11: próxima, não iniciada;
5. 3.5-B3 — KNSC11: pendente;
6. 3.5-B4 — MCCI11: pendente;
7. 3.5-B5 — RBRY11: pendente;
8. 3.5-C — dataset congelado: pendente;
9. 3.5-D — backtest offline: pendente;
10. 3.5-E — automação controlada: pendente;
11. 3.5-F — validação e decisão de produto: pendente.

**Contrato obrigatório por fundo:** branch/PR próprias; documentos oficiais classificados; zero pendências ou estado inconclusivo formal; zero conflitos não explicados; série auditável; fonte, versão e hash; seleção/exclusão explícitas; duas execuções idênticas; regra reutilizável; testes sintéticos e reais; CI; deployment aplicável; merge e auditoria da `main`.

**Aceite da Sprint completa:** seis casos, zero look-ahead, dataset congelado com hash, métricas de falso positivo/negativo, cobertura, inconclusão e antecedência, automação controlada, auditoria, segurança, custo e rollback.

**Proibido:** recalibrar com a mesma coorte antes da 3.6; integrar ao produto; pedir aprovação técnica fundo a fundo; concluir por workflow sem evidência; criar regra por ticker.

---

## 4. Ordem oficial das próximas sprints

### Trilha principal

1. **3.5-B2 a 3.5-F — concluir os quatro fundos restantes, dataset e backtest.**
2. **3.6 — métricas, calibração independente e gate formal.**
3. **3.7 — Risk Lab read-only no Premium + Prompt Premium v3.**
4. **3.8 — impacto por posição/carteira + alertas opt-in.**
5. **4.1 — Radar: acompanhar fundo fora da carteira.**
6. **4.2 — Radar: eventos, tese e relatório pré-compra.**
7. **4.3 — planos, preferências, canais e monetização.**
8. **5.1 — carteira histórica e ledger imutável.**
9. **5.2 — risco, exposição, correlação e atribuição.**
10. **5.3 — inteligência sobre comunicados oficiais.**
11. **5.4 — screener, filtros, pares e fair value.**
12. **5.5 — benchmarks, retorno total, calendário, fiscal e simuladores.**

### SEO em paralelo

- SEO-S1, dias 1–15: Foundation/indexação;
- SEO-S2, dias 16–45: aproximadamente 20 páginas prioritárias;
- SEO-S3, dias 46–70: long tails, comparações e diferenciação;
- SEO-S4, dias 71–90: autoridade e estudos originais.

Incidente de segurança, dados ou Produção interrompe a ordem normal.

---

## 5. Escopo e critérios de aceite de cada sprint

### 3.5 — Coorte externa

Aceite definido na seção 3. Não concluir com fundo faltante, artefato opaco ou exceção por ticker.

### 3.6 — Métricas e calibração

**Escopo:** antecedência, falsos positivos/negativos, inconclusão, cobertura e estabilidade; calibração em conjunto separado.

**Aceite:** denominadores explícitos; thresholds versionados; comparação antes/depois; controles saudáveis; nenhuma remoção silenciosa; decisão formal de rejeitar, manter em laboratório ou promover.

### 3.7 — Premium v3

**Escopo:** sinais homologados read-only e contrato do Prompt Premium v3.

**Aceite:** snapshot de entrada; cálculos no servidor; fatos/cálculos/estimativas/inferências separados; modelos por categoria; confiança e idade; modo degradado; pares equivalentes; sem ordem automática; testes de tijolo, papel, desenvolvimento, FoF, FIAGRO e FI-Infra; consistência com Relatório, ScoreEngine e Risk Lab; custo medido.

### 3.8 — Impacto e alertas

**Escopo:** impacto absoluto/marginal por posição e carteira; alertas por severidade e digest.

**Aceite:** opt-in, cooldown, deduplicação, idempotência, limiar configurável, padrão patrimonial de 3% onde aplicável, nenhuma notificação sem mudança material, fonte/competência/impacto visíveis e métricas de falso alerta.

### 4.1 — Radar/Acompanhar fundo

**Escopo:** acompanhar fundo ainda fora da carteira.

**Regras:** Grátis até 1; Premium até 10; Super Premium aberto; fundo da carteira não consome vaga; limite no servidor; histórico de entrada/saída.

**Aceite:** adicionar/listar/remover; impedir duplicidade e excesso; múltiplos dispositivos; freshness; autorização; concorrência; troca de plano; custo medido.

### 4.2 — Radar pré-compra

**Escopo:** timeline, eventos, dividendos, emissões, risco e relatório “o que preciso saber antes de comprar?”.

**Aceite:** evento oficial versionado; “o que mudou” e “por que importa”; tese, riscos, renda, pares e gatilhos; estado inconclusivo; alertas somente por mudança material.

### 4.3 — Planos, canais e monetização

**Aceite:** matriz de entitlements; preços, trial, cancelamento, reembolso, impostos e inadimplência; backend testado; downgrade sem perda silenciosa; WhatsApp somente com provedor/custo/opt-in/templates; Telegram fora até nova decisão.

### 5.1 — Ledger histórico

**Aceite:** eventos imutáveis; reprocessamento idempotente; posição e preço médio reproduzíveis; reconciliação; mês corrente fora de consolidações; eventos corporativos e retroatividade testados.

### 5.2 — Risco e atribuição

**Aceite:** exposições por fundo, segmento, gestor, inquilino/devedor, indexador, garantia e geografia; cobertura mínima por dimensão; impacto em reais e pontos percentuais; preço, renda, total e retorno real separados; cenário com premissas.

### 5.3 — Comunicados oficiais

**Aceite:** event store; fonte oficial; score de confiança; reapresentações; fato versus declaração da gestão versus inferência; SLA; falha de extração inconclusiva; documento oficial acessível.

### 5.4 — Screener e fair value

**Aceite:** cobertura/universo visíveis; filtros salvos; ranking reproduzível; pares por mandato; faixa de valor justo com premissas; modelos específicos por categoria; teste contra falsa precisão.

### 5.5 — Benchmark, calendário e fiscal

**Aceite:** retorno de preço/renda/total/real; benchmarks documentados; calendário anúncio→data-com→pagamento; simuladores sem promessa; regras fiscais com competência e aviso jurídico.

### SEO-S1 a SEO-S4

Aceite: Search Console e baseline; sitemap/robots/canonical/redirects; SSR e páginas rastreáveis; aproximadamente 20 páginas substanciais; comparações e long tails; estudos originais e referências externas legítimas; nenhuma compra de links ou página rasa.

---

## 6. Regras arquiteturais obrigatórias

### Dados e APIs

1. APIs novas usam serviço/repositório de domínio; não acessam Firestore diretamente quando houver camada existente.
2. `RegulatoryDataService` centraliza cache, regras, métricas e auditoria regulatória.
3. Primitivas futuras: entity master, ledger, event store, factor store e alertas por impacto.
4. Dado ausente não é inventado nem convertido em zero.
5. Correção é global e possui regressão.
6. Campo avançado só fundamenta produto com cobertura comprovada.
7. IA não decide regra, score, alerta ou verdade-terreno.
8. Evidência preserva identidade, janela, fonte, URL, versão, hash, `knownAt` e decisão de seleção/exclusão.
9. Lacuna permanece explícita.
10. Reapresentação segue regra geral e versão oficial.

### Premium e IA

- Backend calcula pesos, metas, quantidades, saldos, concentração, variação e validade.
- IA interpreta tese, sustentabilidade, risco, cenário e consequência.
- Rótulos: `fact`, `calculation`, `estimate`, `inference`, `unavailable`, `inconclusive`.
- Governança forte não decorre de gestor/administrador identificados.
- CNPJ ausente é falha da base, não risco do fundo.
- Liquidez implausível é bloqueada.
- Ágio/desconto e DY não viram recomendação.
- Valor justo é faixa, com premissas.
- Mostrar fonte, competência, timestamp, idade e confiança.
- Texto visível: “Conteúdo informativo, sem recomendação de investimento.”

### GitHub Actions

- Somente ciclo de engenharia ligado ao SHA ou kickoff curto.
- Proibido cron de negócio, polling, sleep, storage operacional e retry artificial.
- Proibido commit/push/PR/merge operacional no workflow.
- CI em PR; pós-merge curto.
- `concurrency`, `cancel-in-progress`, `npm ci`, lockfile e cache obrigatórios.
- Timeout comum até 20 minutos; exceção manual documentada até 30.
- Artefatos com retenção curta.
- Workflow pesado somente manual/condicional.
- `tests/github-actions-governance.test.mjs` bloqueia regressões.

### Vercel e operação

Fluxo: PR → CI → merge → deploy único → validação curta → negócio no backend → evidência. Cron pertence ao backend/`vercel.json`. Coleta FNET deve migrar para fila/worker. Preview e Produção são auditados separadamente. Código de laboratório não ativa Premium ou alertas.

### Política documental

- `DADOS_FII_HANDOFF.md` é o único Handoff canônico.
- Não criar arquivo `DADOS_FII_HANDOFF_vX.Y.Z.md` no Git.
- Histórico fica nos commits.
- Pesquisa em `docs/` não substitui o Handoff.
- Cópias antigas da Biblioteca são consideradas substituídas e precisam de remoção manual quando possível.

---

## 7. Arquivos, branches, commits e PRs existentes

### Commits e PRs canônicos

- PR #101 / merge `d3c98666f083e6fe2a89c5fe3ce78a6c884eb1f9`: arquitetura econômica do Actions.
- PR #105 / merge `498654f03ce66bd54598d5a4677c18bbe5bbdc86`: DEVA11 funcional.
- PR #106: conclusão canônica do DEVA11.
- PR #108 / merge `c4261ceed914a1ca09dbe89a850ff86804cf7b4a`: Handoff v6.5.0.
- PR #110 / merge `432520068b71c000b068520f69e2a7a12c99a491`: teste do Handoff.
- PR #112 / merge `1c4c96e571b7daa80a56d9a5be35e2af050e6469`: VSLH11 funcional.
- PRs #5, #77, #80 e #109: fechadas como abordagens antigas/substituídas.
- PR #65: única PR funcional antiga ainda aberta; deve ser atualizada sobre `main` antes de decisão.
- Issue #111: Fase 3.5-B1; encerramento após merge e auditoria desta atualização documental.

### Arquivos DEVA11

- `docs/production-evidence/risk-lab/deva11-phase-a-manifest.json`
- `docs/production-evidence/risk-lab/deva11-phase-a/index.json`
- partições anuais 2021–2026
- `docs/risk-lab/sprint-3-5-a-deva11.md`
- `src/lib/risk-lab/SingleFrozenDividendCaseFinalizer.ts`
- `tests/risk-lab-deva11-phase-a.test.ts`
- `tests/risk-lab-deva11-evidence.test.mjs`

### Arquivos VSLH11

- `docs/production-evidence/risk-lab/vslh11-phase-b1-manifest.json`
- `docs/production-evidence/risk-lab/vslh11-phase-b1/index.json`
- partições `observations-2021.json` a `observations-2026.json`
- `docs/risk-lab/sprint-3-5-b1-vslh11.md`
- `src/lib/risk-lab/FrozenDividendCheckpointReconciler.ts`
- `tests/risk-lab-frozen-dividend-checkpoint-reconciler.test.ts`
- `tests/risk-lab-vslh11-evidence.test.mjs`
- gate compartilhado em `.github/workflows/risk-lab.yml`

### Fontes estratégicas

- `docs/strategy/PLANO_SEO_90_DIAS_DADOS_FII.md`
- `docs/sources/premium-prompt/REFERENCIAS_PROMPT_PREMIUM_FII.md`
- `docs/sources/premium-prompt/README.md`

### Removidos ou proibidos

- workflows de patch/recovery legados;
- workflow exclusivo por fundo;
- marcador de retry no Git;
- artefato monolítico opaco;
- Handoff paralelo versionado.

---

## 8. Funcionalidades concluídas, parciais e pendentes

### Concluídas

Fases 1 e 2; Risk Lab 3.0–3.4; 3.5-R; DEVA11; VSLH11; infraestrutura de relatório/IA/observabilidade; política de Actions; base de notificações; calendário e benchmarks básicos; snapshots mensais existentes.

### Parciais

- Sprint 3.5: DEVA11 e VSLH11 concluídos; KNCR11, KNSC11, MCCI11, RBRY11, dataset, backtest e automação pendentes.
- Coleta FNET: coletor/checkpoints existem; worker persistente pendente.
- Notificações: materialidade, digest único e auditoria patrimonial ainda precisam fechamento.
- Premium: versão atual existe; Prompt v3, Risk Lab read-only, confiança e modo degradado pendentes.
- Carteira: snapshots existem; ledger, preço médio, eventos e reconciliação pendentes.
- Valuation: P/VP/stress/scores existem; fair value por categoria e cobertura avançada pendentes.
- Scores: `ScoreEngine` existe; screener, filtros salvos e ranking pendentes.
- SEO: plano pronto; execução não iniciada.
- Meses encerrados: decisão tomada; PR #65 ainda não está em `main`.

### Pendentes de maior ganho competitivo

1. Inteligência documental: “o que mudou” e impacto para carteira/Radar.
2. Motor de risco, exposição e atribuição.
3. Carteira histórica verdadeira e reconciliação.
4. Alertas multigatilho e digest por impacto.
5. Screener quantitativo com filtros salvos.
6. Fair value e sustentabilidade da renda por categoria.
7. Retorno total versus renda e benchmarks.
8. Calendário anúncio → data-com → pagamento.
9. Radar/Acompanhar fundo com relatório pré-compra.

---

## 9. Decisões de segurança

- Admin exige sessão protegida, e-mail verificado e autorização.
- Endpoints operacionais usam mesma origem, rate limit e auditoria.
- Segredos não aparecem em logs, query string ou artefatos.
- Risk Lab permanece isolado de Premium/notificações até gate formal.
- Proibido auto-merge de evidência metodológica.
- Workflows usam permissões mínimas e somente leitura nesta arquitetura.
- Proprietário não aprova conteúdo técnico fundo a fundo.
- Evidência insuficiente falha fechada e vira inconclusiva.
- Classe secundária só é excluída por regra geral de identidade/família.
- Competência fora da janela só é excluída após normalização auditável.
- Recuperação transitória exige evidência oficial imutável e cobertura exata das pendências.
- Entitlements do Radar e planos são validados no servidor.
- Dados privados de carteira não entram em páginas públicas ou SEO.
- Nenhuma ordem, garantia de retorno ou recomendação definitiva é gerada.

---

## 10. Variáveis de ambiente

### Conhecidas

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `ADMIN_EMAILS`
- `ENABLE_AUTOMATIC_MONITOR`
- `CRON_SECRET`
- `VERCEL_ENV`
- `VERCEL_GIT_COMMIT_SHA`
- `VERCEL_PROJECT_PRODUCTION_URL`
- variáveis OpenAI/IA por ambiente

### Futuras, somente após decisão explícita

Credenciais de WhatsApp; IDs de produtos/preços; quotas por plano; scheduler/worker FNET; Search Console/analytics; fornecedores licenciados.

### Regras

Variável pública somente quando pública; segredo nunca versionado; Preview e Produção separados; job não falha por variável fora do escopo sem diagnóstico; evidência offline não depende de Produção; rotação e rollback documentados; nenhuma credencial de canal sem opt-in e política de custo.

---

## 11. Testes obrigatórios

### Gates gerais

- `npm run typecheck`
- `npm run test:sprint2`
- `npm run test:risk-lab`
- `npm run test:workflow-governance`
- `npm run test:handoff`
- build/Preview quando aplicável

### Sprint 3.5

- parser FNET e anomalias temporais;
- coletor geral sem ticker hardcoded;
- checkpoint/retomada sem duplicação;
- hash, versão e no-look-ahead;
- locks/attempts/audit;
- controles saudáveis;
- fechamento só com evidência primária;
- duas execuções idênticas;
- arquivos anuais recomponíveis;
- ausência de workflow exclusivo por fundo;
- auditoria pós-merge.

### Gates permanentes DEVA11/VSLH11

- `tests/risk-lab-deva11-phase-a.test.ts`
- `tests/risk-lab-deva11-evidence.test.mjs`
- `tests/risk-lab-frozen-dividend-checkpoint-reconciler.test.ts`
- `tests/risk-lab-vslh11-evidence.test.mjs`

O teste do VSLH11 recompõe 64 competências, todos os hashes, as duas recuperações, as treze classes secundárias e as duas reapresentações.

### Demais áreas

- Premium: categorias, dados completos/incompletos/conflitantes, concentração, metas, faixa de valor, jargão, evidência e custo.
- Radar: limites 1/10 no servidor, autorização, concorrência, downgrade, idempotência e opt-in.
- Ledger: mês corrente, snapshots, compra/venda/subscrição/eventos, retroatividade e reconciliação.
- SEO: sitemap, robots, canonical, redirects, noindex privado, SSR, schema, conteúdo único e Core Web Vitals.

### Critérios universais de conclusão

1. código está em `main`;
2. CI obrigatória está verde no SHA da PR;
3. deployment aplicável está saudável;
4. validação equivalente está documentada;
5. universo aplicável foi coberto;
6. correções são globais e testadas;
7. ausências/conflitos/exceções estão explícitos;
8. auditoria está persistida;
9. segurança, custo, rollback e observabilidade foram validados;
10. evidência final está no Git;
11. Handoff canônico foi atualizado;
12. issue da fase só é encerrada após auditoria da `main`.

---

## 12. Pendências e decisões ainda abertas

### Próximos bloqueadores técnicos

1. Criar branch/PR exclusiva para 3.5-B2 — KNCR11.
2. Reutilizar finalizador, reconciliador e formato anual de DEVA11/VSLH11.
3. Impedir regra dependente do ticker.
4. Concluir KNCR11, KNSC11, MCCI11 e RBRY11 um por vez.
5. Formar dataset congelado somente depois dos seis casos.
6. Executar backtest offline antes de produto.
7. Migrar coleta FNET para fila/worker.
8. Confirmar limites/custo Vercel antes de scheduler.
9. Medir Actions por 30 dias.
10. Reexecutar smoke direto de Produção quando houver ambiente de rede adequado.

### PRs e limpeza

11. Manter #5, #77, #80 e #109 fechadas como substituídas.
12. Atualizar PR #65 sobre `main`, revisar e executar CI.
13. Impedir Handoff paralelo.
14. Remover manualmente cópias antigas da Biblioteca quando a ferramenta permitir.

### Monetização

15. Definir preços, periodicidade, trial, cupom, inadimplência, cancelamento, reembolso e impostos.
16. Confirmar Super Premium e entitlements.
17. Definir downgrade do Radar.
18. Definir quota/cache/TTL/orçamento de IA.
19. Medir custo por relatório, fundo, alerta e usuário.
20. Validar juridicamente informação personalizada versus recomendação regulada.

### Canais

21. WhatsApp: provedor, custo, opt-in, templates, opt-out e fallback.
22. Telegram: adiado.
23. E-mail: digest, abertura, clique, bounce, unsubscribe e falso alerta.
24. Push/web notification: decidir após métricas.

### Produto, dados e SEO

25. Definir periodicidade/regeneração do Premium.
26. Definir experiência de dados insuficientes e política de correção.
27. Definir 20 fundos prioritários SEO-S2.
28. Definir relatório inicial do Radar automático ou sob demanda.
29. Resolver lacunas externas e avaliar SLA/licenciamento de cotação, liquidez e notícias.
30. Definir fontes/frequência para campos avançados.
31. Configurar Search Console e baseline.
32. Não comprar backlinks nem publicar conteúdo raso em massa.

### Referências visuais do Premium

33. Catálogo preservado em `docs/sources/premium-prompt/REFERENCIAS_PROMPT_PREMIUM_FII.md`.
34. Binários 01–09 não estavam recuperáveis; não foram recriados nem receberam hash inventado.
35. Quando disponíveis, adicionar em `images/`, registrar origem e SHA-256.
36. Não copiar marcas, logos ou texto integral; usar estrutura adaptada a FIIs.

---

## Estado canônico final em 24/07/2026

- **Fase 1:** concluída.
- **Fase 2:** concluída.
- **Fase 3:** em andamento.
- **Sprint 3.4:** concluída.
- **3.5-R:** concluída.
- **3.5-A — DEVA11:** concluída.
- **3.5-B1 — VSLH11:** concluída.
- **Sprint 3.5 completa:** aberta.
- **Próxima fase:** 3.5-B2 — KNCR11, não iniciada.
- **Risk Lab no Premium/alertas:** bloqueado até gates 3.5/3.6.
- **Prompt Premium v3:** especificado, não implementado.
- **Radar:** planejado para Fase 4, limite-base 1 Grátis/10 Premium.
- **SEO:** trilha paralela oficial; SEO-S1 não iniciada.
- **GitHub Actions:** arquitetura otimizada; worker FNET pendente.
- **Handoff no Git:** somente `DADOS_FII_HANDOFF.md` é canônico.
