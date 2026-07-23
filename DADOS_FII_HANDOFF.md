Este documento substitui todos os planejamentos anteriores quando houver divergência.

# Dados FII — Documento Canônico de Handoff

**Versão:** 6.4.1  
**Data:** 23/07/2026  
**Repositório:** `IsraelJr/dados-fii`  
**Branch principal:** `main`  
**Último commit auditado no repositório e com deployment saudável:** `498654f03ce66bd54598d5a4677c18bbe5bbdc86`  
**Evidência de conclusão da Fase 3.5-A:** PR #105, merge `498654f03ce66bd54598d5a4677c18bbe5bbdc86`  
**Sprint corrente:** 3.5 — Coorte externa e backtest sem informação futura  
**Fase ativa seguinte:** 3.5-B1 — VSLH11, ainda não iniciada

## Como interpretar os status

- **Implementada:** existe código versionado no Git.
- **Testada em repositório:** existem testes automatizados versionados.
- **Implantada:** o commit exato possui deployment identificado e saudável.
- **Validada funcionalmente:** houve smoke test documentado ou validação operacional.
- **Formalmente concluída:** código, CI, deployment aplicável, cobertura do universo da fase, segurança, custo e evidências foram auditados.

Uma validação pontual ou manual não conclui, sozinha, uma fase.

## Decisões vigentes que substituem decisões anteriores

| Decisão vigente | Decisão substituída | Motivo |
|---|---|---|
| Fases 1 e 2 estão formalmente concluídas em Produção sob a evidência schema v2. | Fase 2 apenas validada funcionalmente. | Carga, double check, checks globais e casos estratificados foram persistidos. |
| Sprint corrente canônica: 3.5. | Sprint 3.4 corrente. | Sprint 3.4 foi homologada; a coorte externa segue em fases independentes. |
| Fase 3.5-A — DEVA11 está formalmente concluída. | DEVA11 pendente ou dependente de workflow temporário. | 85/85 documentos classificados, zero pendências, zero conflitos, hashes reproduzíveis, CI e deployment verdes, merge e auditoria concluídos. |
| A próxima fase técnica é 3.5-B1 — VSLH11, mas não começa automaticamente. | Retomar os seis fundos em uma execução monolítica. | Cada fundo deve possuir PR, evidência, testes e hash próprios. |
| GitHub Actions é usado apenas no ciclo de engenharia ligado ao código/SHA. | Actions como cron, fila, polling, storage e recovery. | Reduz custo e elimina cascatas sem remover testes. |
| Backtest da Sprint 3.5 possui kickoff manual curto; casos, locks e auditoria ficam no backend/Firestore. | Workflow de 90 minutos processando seis fundos e esperando locks. | O estado operacional pertence ao backend. |
| Recovery por commit, push em `main` e arquivo marcador são proibidos. | Commits `ci: reaciona deploy...` e marcador de tentativas. | Git não é banco operacional nem mecanismo de retry. |
| Coleta FNET pesada fica manual e limitada até migrar para fila/worker. | Gatilho automático por push com timeout de 120 minutos. | Evita consumo automático; migração definitiva depende da infraestrutura adequada. |
| Correções de dados/cálculos são globais e testadas, nunca patches por ticker. | Correções pontuais para fundos sentinela. | O mesmo problema pode afetar todo o universo. |
| Relatório Premium usa cálculo determinístico e dados estruturados antes da IA. | IA decidindo regras ou preenchendo lacunas. | Segurança, consistência e redução de custo. |
| Telegram permanece adiado; WhatsApp continua decisão aberta. | Telegram obrigatório. | Prioridade vigente do produto. |
| IFIX é sincronizado no ciclo oficial de janeiro, maio e setembro, com execução manual no Admin. | Sincronização diária. | Menor custo sem perda funcional. |
| Notificações exigem mudança material e e-mails correlatos viram digest. | Notificação diária e múltiplos e-mails por ciclo. | Redução de ruído. |
| `ADMIN` é autorização, não plano comercial. | Exibir ADMIN como plano. | Separa segurança de monetização. |

---

## 1. Estado atual do projeto

### Resumo executivo

- Fundação regulatória, RegulatoryDataService, scores, validação, Dashboard, Timeline, relatórios, IA, observabilidade, monitor e notificações estão implementados.
- Fases 1 e 2 estão formalmente concluídas em Produção.
- Catálogo auditado: 504/504 ativos com cadastro básico; 97,81% de cobertura essencial aplicável; zero CNPJ duplicado no run canônico.
- Sprint 3.4 do Risk Lab foi concluída em Produção com 11/11 checks, 6/6 casos e zero blockers.
- Sprint 3.5 permanece aberta até a coorte completa possuir evidência primária, dataset congelado e backtest conclusivo sem look-ahead.
- Fase 3.5-R está concluída.
- Fase 3.5-A — DEVA11 está formalmente concluída no merge `498654f03ce66bd54598d5a4677c18bbe5bbdc86`.
- A otimização do GitHub Actions foi integrada no merge `d3c98666f083e6fe2a89c5fe3ce78a6c884eb1f9` e está concluída.
- O fluxo anterior de recovery foi removido e não deve ser reativado.
- A Fase 3.5-B1 — VSLH11 é a próxima etapa, ainda não iniciada.

### Estado da automação de engenharia

Baseline anterior:

- 7 workflows ativos;
- 2 workflows pesados automáticos;
- timeout de até 90 e 120 minutos;
- polling, sleeps e recovery por commits;
- instalação e suítes repetidas;
- artefatos de 14/30 dias.

Estado integrado em `main`:

- 5 workflows ativos;
- 2 workflows removidos;
- nenhum workflow escreve no repositório;
- nenhum workflow pesado dispara por push;
- nenhum sleep/polling operacional;
- timeouts máximos de 20 minutos, com uma exceção manual documentada de 30 minutos;
- `npm ci` e cache em todos os jobs Node;
- diagnóstico de falha com retenção de 3 dias;
- redução mensal projetada de 2.140 para 529 minutos no cenário documentado, equivalente a 75,3%;
- após a migração definitiva da coleta para worker, projeção de aproximadamente 504 minutos mensais.

### Auditoria de conclusão

| Área | Código | Testes | Deployment/Produção | Evidência | Status |
|---|---:|---:|---:|---:|---|
| Fase 1 — Regulatory Engine | Sim | Sim | Sim | Schema v2 e trilhas de publicação | Concluída |
| Fase 2 — Core Intelligence | Sim | Sim | Sim | 25/25 checks e universo global | Concluída |
| Fase 3 — Risk Lab até 3.4 | Sim | Sim | Sim | 11/11 checks e 6/6 casos | Concluída até 3.4 |
| Fase 3.5-R — reorganização | Sim | Sim | n/a | Plano faseado e recovery pausado/removido | Concluída |
| Fase 3.5-A — DEVA11 | Sim | Sim | Deployment do SHA saudável; sem integração de produto | 85/85, 65 meses, hashes e dossiê | Concluída |
| Sprint 3.5 completa | Parcial | Sim | Parcial | Outros cinco fundos/dataset/backtest pendentes | Em andamento |
| Otimização GitHub Actions | Sim | Sim | Deployment saudável | Inventário, política, auditoria e CI | Concluída |
| SEO 90 dias | Plano pronto | n/a | Não iniciado | Baseline pendente | Pendente |

### Pendências de dados conhecidas

- PF/PJ não publicado nas fontes estruturadas para `BFCC11`, `BRHT11`, `BTML11`, `FINF11`, `IDUA11`, `MTOF11`, `PBLV11`, `REME11`, `RRES11` e `SPAF11`.
- `RJDA11` também sem cotas emitidas, patrimônio líquido e total de cotistas nos layouts usados.
- Divergências históricas de ISIN em revisão: `KISU11`, `SPTW11` e `TRXF11`.
- `HGPO11` inativado com evidência oficial e histórico preservado.
- Lacuna externa permanece `null`, com fonte/data/aviso; nunca zero inventado.

---

## 2. Fases concluídas e situação de certificação

### Fase 1 — Regulatory Engine

Concluída: parser CVM v2, FII/FIAGRO, reconciliação, QA, staging/produção, backup, hash, publicação protegida, rollback e CI.

### Fase 2 — Core Intelligence & Product Foundation

Concluída: RegulatoryDataService/Repository/Normalizer/Validator/Cache/Types; ScoreEngine; Health; Validation; Admin; Timeline; relatórios; AI Insights; observabilidade; monitor; catálogo; notificações e jobs.

### Fase 3 — Risk Lab

- Sprints 3.0 a 3.4 concluídas.
- Fase 3.5-R concluída.
- Fase 3.5-A — DEVA11 concluída.
- Sprint 3.5 completa ainda aberta.
- Risk Lab continua isolado do Premium e das notificações enquanto não houver gate formal da Sprint completa.

### Evidência canônica da Fase 3.5-A

- PR: `#105`;
- merge: `498654f03ce66bd54598d5a4677c18bbe5bbdc86`;
- documentos descobertos/classificados: `85/85`;
- pendências: `0`;
- conflitos: `0`;
- observações brutas: `67`;
- competências mensais selecionadas: `65`;
- lacuna explícita: `2024-07`;
- hash do checkpoint: `6b923ceeff2a0a9ddcd27d72b4d8125d3b2cc6aca6109c57531c3efed36d4a89`;
- hash do caso: `fca3de0e38755c8213d7e37d5112b51733c794dd29a2f2f7cb5be82980313aa2`;
- hash da auditoria: `157e807f7a61c4d9bb34eedc324e761c8a19c25ac93505023606f6ffcd2159af`;
- hash das 65 observações combinadas: `6788292746eeb5321d36cd198c75b5810c3797cead357341cc04df9254fee20c`;
- hash do índice: `62a19d9b20b57b49489d7ab51ed85d72505625ca68f47762a5045fc3c650993b`.

---

## 3. Sprint atual

### Sprint 3.5 — Coorte externa e backtest sem informação futura

**Objetivo:** verificar a coorte pré-registrada em fontes primárias, congelar o dataset e executar backtest sem look-ahead, preservando o ruleset `v0.1.0`.

**Coorte:** `DEVA11`, `VSLH11`, `KNCR11`, `KNSC11`, `MCCI11`, `RBRY11`.

**Estado faseado:**

1. 3.5-R — reorganização e pausa operacional: concluída;
2. 3.5-A — DEVA11: concluída;
3. 3.5-B1 — VSLH11: próxima, não iniciada;
4. 3.5-B2 — KNCR11: pendente;
5. 3.5-B3 — KNSC11: pendente;
6. 3.5-B4 — MCCI11: pendente;
7. 3.5-B5 — RBRY11: pendente;
8. 3.5-C — dataset congelado da coorte: pendente;
9. 3.5-D — backtest offline: pendente;
10. 3.5-E — automação controlada: pendente;
11. 3.5-F — validação em Produção e decisão de produto: pendente.

**Trabalho obrigatório restante:**

1. concluir os outros cinco fundos sem exceção por ticker;
2. confirmar `knownAt`, URL, trecho, página, hash e versão em cada caso;
3. congelar dataset com hash reproduzível;
4. executar coorte completa e medir falsos positivos, falsos negativos, inconclusão, cobertura e antecedência;
5. manter `executionAllowed=false` quando faltar evidência primária;
6. persistir locks, tentativas, casos e auditoria no Firestore quando a automação for ativada;
7. publicar somente a evidência final relevante.

**Critério de aceite da Sprint completa:** seis casos completos; zero pendências/conflitos não explicados; nenhum controle saudável com vermelho injustificado; ambiguidades inconclusivas; zero look-ahead; hashes válidos; auditoria e CI verdes.

### Arquitetura operacional vigente da Sprint 3.5

- GitHub workflow inicia uma tentativa somente por `workflow_dispatch` e SHA explícito.
- O kickoff faz uma chamada única e termina em até 5 minutos.
- O Admin protegido oferece `advance`, que decide automaticamente inicialização, próximo fundo ou finalização.
- Estado fica nas coleções `RiskLabCohortBacktestRuns`, `Attempts`, `Audit` e `Locks`.
- Não existem commits de retry, marcador ou polling no runner.
- Coleta FNET completa ainda é exceção manual de até 30 minutos, com artefato de 3 dias; migração para fila/worker permanece dívida técnica.
- Evidência por fundo deve ser legível, particionada quando necessário e validada pelo mesmo gate especializado do Risk Lab.

---

## 4. Ordem oficial das próximas sprints

### Trilha principal

1. Sprint 3.5-B1 a 3.5-F — concluir a coorte e o backtest.
2. Sprint 3.6 — Métricas, calibração e gate formal.
3. Sprint 3.7 — Risk Lab read-only no Premium e Prompt Premium v3.
4. Sprint 3.8 — Impacto na carteira e alertas opt-in.
5. Sprint 4.1 — Radar: acompanhar fundo fora da carteira.
6. Sprint 4.2 — Radar: eventos, tese e relatório pré-compra.
7. Sprint 4.3 — Planos, preferências, canais e monetização.
8. Sprint 5.1 — Carteira histórica e ledger de eventos.
9. Sprint 5.2 — Motor de risco/exposição/atribuição.
10. Sprint 5.3 — Inteligência sobre comunicados oficiais.
11. Sprint 5.4 — Screener quantitativo, pares e fair value.
12. Sprint 5.5 — Benchmark, retorno total, calendário, fiscal e simuladores.

### SEO em paralelo

1. Dias 1–15: fundação técnica/indexação.
2. Dias 16–45: vinte páginas prioritárias.
3. Dias 46–70: long tails/comparações.
4. Dias 71–90: autoridade e estudos originais.

Incidente de segurança, dados ou Produção interrompe a ordem normal.

---

## 5. Escopo e critérios de aceite das sprints

### Sprint 3.5

Aceite definido na seção 3. Não concluir com amostra parcial, artefato pendente ou workflow verde sem evidência de domínio.

Cada fundo das fases A/B deve possuir:

- documentos oficiais classificados;
- zero pendências dentro da janela;
- zero conflitos não explicados;
- série mensal legível e auditável;
- hash reproduzível em duas execuções;
- regras reutilizáveis, sem exceção por ticker;
- testes sintéticos e teste da evidência real;
- PR e auditoria do SHA final.

### Sprint 3.6

Métricas por papel, antecedência, falsos positivos/negativos, cobertura, calibração fora da coorte e gate de produto.

### Sprint 3.7

Integração read-only no Premium; IA apenas explica dados determinísticos; fallback explícito; cache e auditoria.

### Sprint 3.8

Impacto por posição/carteira e alertas opt-in, com cooldown, digest e thresholds configuráveis.

### Sprints 4.x

Radar fora da carteira, tese/eventos/relatório pré-compra e monetização/entitlements.

### Sprints 5.x

Ledger histórico, risco/atribuição, comunicados, screener/fair value e ferramentas avançadas.

---

## 6. Regras arquiteturais obrigatórias

### Dados e APIs

1. APIs novas não acessam Firestore diretamente quando existe serviço/repositório de domínio.
2. RegulatoryDataService centraliza cache, regras, métricas e auditoria regulatória.
3. Dado oficial ausente não é inventado.
4. Toda correção é generalizada e coberta por regressão.
5. IA não decide regra, score, alerta ou verdade-terreno.
6. Artefato metodológico deve preservar fonte, identidade, janela, versão, hash e decisão de seleção/exclusão.
7. Lacuna documental é explícita e não pode ser preenchida por inferência silenciosa.

### GitHub Actions

1. Usar apenas para ciclo de código, status check, schema, build/auditoria ligada a SHA ou kickoff curto.
2. Proibido cron de negócio, fila, polling, sleep, storage operacional e monitor contínuo.
3. Proibido commit/push/PR/merge/retry artificial dentro de workflow operacional.
4. CI em PR; push somente `main` para pós-merge curto.
5. Todo workflow possui `concurrency` e `cancel-in-progress: true`.
6. `npm ci`, lockfile e cache obrigatórios.
7. Timeout comum até 20 minutos; exceção manual documentada até 30 minutos.
8. Artefato operacional até 7 dias; padrão atual 3 dias.
9. Workflow pesado somente manual/condicional.
10. `tests/github-actions-governance.test.mjs` bloqueia regressões.
11. Teste de domínio aprovado no mesmo SHA não é repetido em workflow operacional sem justificativa.

Documentos normativos:

- `docs/engineering/github-actions-policy.md`
- `docs/engineering/github-actions-inventory.md`
- `docs/engineering/github-actions-audit-2026-07-22.md`

### Vercel e operação

- Fluxo: PR → CI rápida → merge → deploy único → validação curta → negócio no backend → evidência final.
- Cron de negócio pertence ao `vercel.json`/backend.
- Nenhum cron novo agressivo será criado sem confirmar limite/custo do plano.
- O deployment do código da Fase 3.5-A não ativa backtest, Premium ou notificações.

---

## 7. Arquivos, branches, commits e PRs relevantes

### `main` e merges canônicos

- otimização do GitHub Actions: PR #101, merge `d3c98666f083e6fe2a89c5fe3ce78a6c884eb1f9`;
- Fase 3.5-A — DEVA11: PR #105, merge `498654f03ce66bd54598d5a4677c18bbe5bbdc86`.

### PRs históricas preservadas/encerradas

- PR #96: retomadas em lotes; fechada e não mesclada.
- PR #100: primeira implementação isolada do DEVA11; fechada e substituída.
- PR #103: PR empilhada do DEVA11; fechada e substituída pela branch limpa.
- PR #104: tentativa técnica de sincronização; fechada sem merge.

### Arquivos da otimização

- `.github/workflows/phase-2-closure.yml`
- `.github/workflows/portfolio-notifications-ci.yml`
- `.github/workflows/risk-lab.yml`
- `.github/workflows/risk-lab-cohort-backtest.yml`
- `.github/workflows/risk-lab-frozen-dividend-notices.yml`
- `src/app/api/admin/system/risk-lab/cohort-backtest/route.ts`
- `tests/github-actions-governance.test.mjs`
- `docs/engineering/github-actions-policy.md`
- `docs/engineering/github-actions-inventory.md`

### Arquivos da Fase 3.5-A

- `docs/production-evidence/risk-lab/deva11-phase-a-manifest.json`
- `docs/production-evidence/risk-lab/deva11-phase-a/index.json`
- `docs/production-evidence/risk-lab/deva11-phase-a/observations-2021.json`
- `docs/production-evidence/risk-lab/deva11-phase-a/observations-2022.json`
- `docs/production-evidence/risk-lab/deva11-phase-a/observations-2023.json`
- `docs/production-evidence/risk-lab/deva11-phase-a/observations-2024.json`
- `docs/production-evidence/risk-lab/deva11-phase-a/observations-2025.json`
- `docs/production-evidence/risk-lab/deva11-phase-a/observations-2026.json`
- `docs/risk-lab/sprint-3-5-a-deva11.md`
- `src/lib/risk-lab/SingleFrozenDividendCaseFinalizer.ts`
- `scripts/finalize-frozen-dividend-case.ts`
- `tests/risk-lab-deva11-phase-a.test.ts`
- `tests/risk-lab-deva11-evidence.test.mjs`

### Removidos/proibidos

- `.github/workflows/patch-portfolio-notification-types.yml`
- `.github/workflows/risk-lab-cohort-deploy-recovery.yml`
- `.github/workflows/risk-lab-deva11-phase-a.yml`
- `docs/production-evidence/risk-lab/sprint-3-5-deploy-trigger.json`
- artefato monolítico `observations.json.gz.base64` do DEVA11.

---

## 8. Funcionalidades concluídas, parciais e pendentes

### Concluídas

- Fases 1 e 2;
- Risk Lab 3.0–3.4;
- Sprint 3.5-R;
- Sprint 3.5-A — DEVA11;
- infraestrutura de relatórios/IA/observabilidade;
- política e implementação de redução de GitHub Actions.

### Parciais

- Sprint 3.5: DEVA11 concluído; VSLH11, KNCR11, KNSC11, MCCI11, RBRY11, dataset congelado, backtest e automação final pendentes.
- Coleta FNET: coletor/testes/checkpoints existem; worker persistente fora do Actions pendente.
- Acompanhar fundo: regra planejada de 1 no Grátis e 10 no Premium; produto pendente.
- Prompt Premium v3: contrato pronto, implementação pendente.

### Pendentes

- Radar 4.x;
- ledger histórico 5.1;
- motor avançado de risco 5.2;
- comunicados/screener/fair value/fiscal/simuladores 5.3–5.5.

---

## 9. Decisões de segurança

- Admin exige sessão protegida, e-mail verificado e autorização.
- Endpoints operacionais usam mesma origem, rate limit e auditoria.
- Segredos não aparecem em logs/query/artifacts.
- Risk Lab permanece isolado de Premium/notificações até gate da Sprint completa.
- Proibido auto-merge de evidência metodológica.
- GitHub workflows usam permissões somente leitura nesta arquitetura.
- Dado técnico não é aprovado manualmente fundo a fundo pelo proprietário.
- Evidência insuficiente falha fechada; não é convertida em exclusão silenciosa.
- Classe secundária só é excluída por regra geral de identidade/família.
- Competência fora da janela só é excluída após normalização temporal auditável.

---

## 10. Variáveis de ambiente

Conhecidas/relevantes:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `ADMIN_EMAILS`
- `ENABLE_AUTOMATIC_MONITOR`
- `CRON_SECRET`
- `VERCEL_ENV`
- `VERCEL_GIT_COMMIT_SHA`
- `VERCEL_PROJECT_PRODUCTION_URL`
- variáveis de OpenAI/IA conforme ambiente

Regras:

- variáveis públicas apenas quando realmente públicas;
- segredo nunca versionado;
- Preview e Produção auditados separadamente;
- job não deve falhar por variável alheia ao seu escopo sem diagnóstico explícito;
- processamento offline de evidência congelada não depende de credencial de Produção.

---

## 11. Testes obrigatórios

### Gerais

- `npm run typecheck`
- `npm run test:sprint2`
- `npm run test:risk-lab`
- build de verificação quando aplicável

### Governança de automações

- `npm run test:workflow-governance`

Esse teste exige:

- inventário de todos os workflows;
- ausência dos arquivos legados;
- zero commit/push/PR/merge/`gh workflow run`;
- zero sleep/polling/retry ilimitado;
- timeout e concurrency em todos os jobs;
- `npm ci`/cache;
- zero cron e permissões de escrita;
- workflows pesados somente manuais;
- artefatos com retenção curta;
- kickoff com uma única chamada;
- orquestração `advance` no backend.

### Sprint 3.5

- parser FNET e anomalias temporais;
- coletor geral, sem exceção por ticker;
- checkpoint/retomada sem duplicação;
- hashes/dataset imutável;
- seleção de versões/no-look-ahead;
- locks/attempts/audit;
- controles saudáveis sem falso positivo;
- fechamento só com evidência primária completa.

### Fases 3.5-A/B por fundo

- `tests/risk-lab-deva11-phase-a.test.ts` como contrato geral de finalização isolada;
- `tests/risk-lab-deva11-evidence.test.mjs` como validação da evidência real do DEVA11;
- equivalentes para cada fundo seguinte;
- duas execuções com hashes idênticos;
- arquivos anuais/particionados legíveis e recomponíveis;
- zero regra hardcoded pelo ticker;
- ausência de workflow exclusivo por fundo;
- CI central, Risk Lab e deployment do SHA final verdes;
- auditoria pós-merge na `main`.

---

## 12. Pendências e decisões abertas

### Próximos bloqueadores técnicos

1. Iniciar a Fase 3.5-B1 — VSLH11 em branch e PR próprias.
2. Reutilizar o finalizador geral e o formato anual de evidência comprovado no DEVA11.
3. Confirmar que nenhuma regra nova depende do ticker.
4. Concluir B2–B5 um fundo por vez.
5. Somente depois formar o dataset congelado da coorte.
6. Executar backtest offline antes de qualquer integração de produto.

### Dívida técnica de infraestrutura

7. Migrar a coleta FNET para fila persistida e worker/backend.
8. Confirmar limites/custo do plano Vercel antes de definir frequência do scheduler.
9. Medir uso real de Actions por 30 dias e recalibrar orçamento.
10. Avaliar renomear `Phase 2 Closure CI` após confirmar regras de branch protection.

### Produto/monetização

11. Definir preços, trial, cobrança, cancelamento, reembolso e impostos.
12. Confirmar Super Premium e matriz final de entitlements.
13. Definir cache/quota/TTL/orçamento de IA.
14. Definir limite entre informação personalizada e recomendação regulada.

### Canais

15. WhatsApp: provedor, custo, opt-in e templates.
16. Telegram: adiado.
17. Medir abertura, opt-out, falsos alertas e digest.

### Dados/fornecedores

18. Resolver/documentar lacunas externas.
19. Avaliar licenciamento/SLA de cotações, volume e liquidez.
20. Manter documento não legível como inconclusivo.

### SEO

21. Registrar baseline técnico/Search Console.
22. Definir 20 fundos prioritários.
23. Não comprar backlinks nem publicar páginas rasas.

---

## Critérios para declarar fases concluídas

Uma fase só é concluída quando:

1. código está integrado à `main`;
2. CI obrigatória está verde no SHA da PR;
3. deployment exato está saudável quando aplicável;
4. smoke ou validação equivalente está documentado;
5. universo aplicável da fase foi coberto;
6. correções são globais e testadas;
7. ausências/conflitos/exceções estão explícitos;
8. double check/auditoria estão persistidos;
9. segurança, custo, rollback e observabilidade foram validados;
10. evidência final está no Git;
11. Handoff canônico foi atualizado;
12. issue da fase foi encerrada somente após auditoria da `main`.

**Formulação vigente:** Fases 1 e 2 concluídas; Fase 3 em andamento; Sprint 3.4 concluída; Fases 3.5-R e 3.5-A concluídas; Sprint 3.5 completa aberta; otimização de GitHub Actions concluída; próxima fase técnica 3.5-B1 — VSLH11, não iniciada.
