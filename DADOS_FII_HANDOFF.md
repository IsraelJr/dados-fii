Este documento substitui todos os planejamentos anteriores quando houver divergência.

# Dados FII — Documento Canônico de Handoff

**Versão:** 6.3.0  
**Data:** 22/07/2026  
**Repositório:** `IsraelJr/dados-fii`  
**Branch principal:** `main`  
**Último commit auditado em Produção:** `e9a5d6ec263c0aa87961133a361891f60175dba4`  
**Branch desta atualização:** `agent/github-actions-cost-architecture`  
**PR desta atualização:** a abrir após os testes controlados  
**Sprint corrente:** 3.5 — Coorte externa e backtest sem informação futura

## Como interpretar os status

- **Implementada:** existe código versionado no Git.
- **Testada em repositório:** existem testes automatizados versionados.
- **Implantada:** o commit exato possui deployment identificado e saudável.
- **Validada funcionalmente:** houve smoke test documentado ou validação operacional.
- **Formalmente concluída:** código, CI, deployment, cobertura do universo, segurança, custo e evidências foram auditados.

Uma validação pontual ou manual não conclui, sozinha, uma fase.

## Decisões vigentes que substituem decisões anteriores

| Decisão vigente | Decisão substituída | Motivo |
|---|---|---|
| Fases 1 e 2 estão formalmente concluídas em Produção sob a evidência schema v2. | Fase 2 apenas validada funcionalmente. | Carga, double check, checks globais e casos estratificados foram persistidos. |
| Sprint corrente canônica: 3.5. | Sprint 3.4 corrente. | Sprint 3.4 foi homologada em Produção; a coorte externa segue pendente. |
| GitHub Actions é usado apenas no ciclo de engenharia ligado ao código/SHA. | Actions como cron, fila, polling, storage e recovery. | Reduz custo e elimina cascatas sem remover testes. |
| Backtest da Sprint 3.5 possui kickoff manual curto; casos, locks e auditoria ficam no backend/Firestore. | Workflow de 90 minutos processando seis fundos e esperando locks. | O estado operacional já pertence ao backend. |
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
- A otimização do GitHub Actions está implementada nesta branch, mas não é considerada concluída antes de CI, auditoria do diff e merge.
- O fluxo anterior de recovery foi pausado e não deve ser reativado.

### Estado da automação de engenharia

Baseline de `main` antes desta branch:

- 7 workflows ativos;
- 2 workflows pesados automáticos;
- timeout de até 90 e 120 minutos;
- polling, sleeps e recovery por commits;
- instalação e suítes repetidas;
- artefatos de 14/30 dias.

Estado proposto nesta branch:

- 5 workflows ativos;
- 2 removidos;
- nenhum workflow escreve no repositório;
- nenhum workflow pesado dispara por push;
- nenhum sleep/polling;
- timeouts máximos de 20 minutos, com uma exceção manual documentada de 30;
- `npm ci` e cache em todos os jobs Node;
- redução mensal projetada de 2.140 para 529 minutos no cenário documentado (75,3%).

### Auditoria de conclusão

| Área | Código | Testes | Produção | Evidência | Status |
|---|---:|---:|---:|---:|---|
| Fase 1 — Regulatory Engine | Sim | Sim | Sim | Schema v2 e trilhas de publicação | Concluída |
| Fase 2 — Core Intelligence | Sim | Sim | Sim | 25/25 checks e universo global | Concluída |
| Fase 3 — Risk Lab até 3.4 | Sim | Sim | Sim | 11/11 checks e 6/6 casos | Concluída até 3.4 |
| Sprint 3.5 | Parcial | Sim | Parcial | Dataset/coorte final pendentes | Em andamento |
| Otimização GitHub Actions | Sim, na branch | Testes adicionados | Não se aplica antes do merge | Inventário e política | Em validação |
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
- Sprint 3.5 aberta.
- Risk Lab continua isolado do Premium e das notificações enquanto não houver gate formal.

---

## 3. Sprint atual

### Sprint 3.5 — Coorte externa e backtest sem informação futura

**Objetivo:** verificar a coorte pré-registrada em fontes primárias, congelar o dataset e executar backtest sem look-ahead, preservando o ruleset `v0.1.0`.

**Coorte:** `DEVA11`, `VSLH11`, `KNCR11`, `KNSC11`, `MCCI11`, `RBRY11`.

**Trabalho obrigatório:**

1. confirmar `knownAt`, URL, trecho, página, hash e versão;
2. concluir a coleta dos seis fundos sem exceção por ticker;
3. congelar dataset com hash reproduzível;
4. executar coorte completa e medir falsos positivos, falsos negativos, inconclusão, cobertura e antecedência;
5. manter `executionAllowed=false` quando faltar evidência primária;
6. persistir locks, tentativas, casos e auditoria no Firestore;
7. publicar somente a evidência final relevante.

**Critério de aceite:** seis casos completos; zero pendências/conflitos não explicados; nenhum controle saudável com vermelho injustificado; ambiguidades inconclusivas; zero look-ahead; hashes válidos; auditoria e CI verdes.

### Arquitetura operacional vigente da Sprint 3.5

- GitHub workflow inicia uma tentativa por `workflow_dispatch` e SHA explícito.
- O kickoff faz uma chamada única e termina em até 5 minutos.
- O Admin protegido oferece `advance`, que decide automaticamente inicialização, próximo fundo ou finalização.
- Estado fica nas coleções `RiskLabCohortBacktestRuns`, `Attempts`, `Audit` e `Locks`.
- Não existem commits de retry, marcador ou polling no runner.
- Coleta FNET completa ainda é exceção manual de até 30 minutos, com artefato de 3 dias; migração para fila/worker permanece dívida técnica.

---

## 4. Ordem oficial das próximas sprints

### Trilha principal

1. Sprint 3.5 — Coorte externa e backtest sem informação futura.
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

### GitHub Actions

1. Usar apenas para ciclo de código, status check, schema, build/auditoria ligada a SHA ou kickoff curto.
2. Proibido cron de negócio, fila, polling, sleep, storage operacional e monitor contínuo.
3. Proibido commit/push/PR/merge/retry artificial dentro de workflow operacional.
4. CI em PR; push somente `main` para pós-merge curto.
5. Todo workflow possui `concurrency` e `cancel-in-progress: true`.
6. `npm ci`, lockfile e cache obrigatórios.
7. Timeout comum até 20 min; exceção manual documentada até 30 min.
8. Artefato operacional até 7 dias; padrão atual 3 dias.
9. Workflow pesado somente manual/condicional.
10. `tests/github-actions-governance.test.mjs` bloqueia regressões.

Documentos normativos:

- `docs/engineering/github-actions-policy.md`
- `docs/engineering/github-actions-inventory.md`

### Vercel e operação

- Fluxo: PR → CI rápida → merge → deploy único → validação curta → negócio no backend → evidência final.
- Cron de negócio pertence ao `vercel.json`/backend.
- Nenhum cron novo agressivo será criado sem confirmar limite/custo do plano.

---

## 7. Arquivos, branches, commits e PRs relevantes

### Branches/PRs

- `main`: baseline `fb926f241a57a3d1c0f1a701f82701f302fece1a` antes desta otimização.
- `agent/github-actions-cost-architecture`: implementação atual.
- PR #96: retomadas em lotes; deve permanecer fechada/não mesclada.
- PR #100: DEVA11 isolado; workflow temporário deve ser removido antes de eventual merge.

### Arquivos principais desta otimização

- `.github/workflows/phase-2-closure.yml`
- `.github/workflows/portfolio-notifications-ci.yml`
- `.github/workflows/risk-lab.yml`
- `.github/workflows/risk-lab-cohort-backtest.yml`
- `.github/workflows/risk-lab-frozen-dividend-notices.yml`
- `src/app/api/admin/system/risk-lab/cohort-backtest/route.ts`
- `tests/github-actions-governance.test.mjs`
- `docs/engineering/github-actions-policy.md`
- `docs/engineering/github-actions-inventory.md`

### Removidos

- `.github/workflows/patch-portfolio-notification-types.yml`
- `.github/workflows/risk-lab-cohort-deploy-recovery.yml`
- `docs/production-evidence/risk-lab/sprint-3-5-deploy-trigger.json`

### Commits desta branch até esta atualização

- remoção do patch legado;
- remoção do recovery/marcador;
- otimização das três CIs;
- redução dos fluxos pesados a manual/limitado;
- endpoint `advance` idempotente;
- testes de governança e atualização dos testes arquiteturais;
- política, inventário e orçamento.

---

## 8. Funcionalidades concluídas, parciais e pendentes

### Concluídas

- Fases 1 e 2;
- Risk Lab 3.0–3.4;
- infraestrutura de relatórios/IA/observabilidade;
- política e implementação de redução de Actions na branch.

### Parciais

- Sprint 3.5: DEVA11 em trabalho isolado; demais fundos/dataset/backtest pendentes.
- Coleta FNET: coletor/testes/checkpoint existem; worker persistente fora do Actions pendente.
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
- Risk Lab permanece isolado de Premium/notificações até gate.
- Proibido auto-merge de evidência metodológica.
- GitHub workflows usam permissões somente leitura nesta arquitetura.
- Dado técnico não é aprovado manualmente fundo a fundo pelo proprietário.

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
- job não deve falhar por variável alheia ao seu escopo sem diagnóstico explícito.

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

---

## 12. Pendências e decisões abertas

### Bloqueadores imediatos

1. Executar CI controlada da branch de otimização.
2. Auditar os cinco workflows finais e o diff completo.
3. Abrir/validar/mesclar a PR sem regressões.
4. Fechar a PR #96 e neutralizar o workflow temporário da PR #100.
5. Concluir dataset primário e backtest da Sprint 3.5.

### Dívida técnica de infraestrutura

6. Migrar a coleta FNET para fila persistida e worker/backend.
7. Confirmar limites/custo do plano Vercel antes de definir frequência do scheduler.
8. Medir uso real de Actions por 30 dias e recalibrar orçamento.
9. Avaliar renomear `Phase 2 Closure CI` após confirmar regras de branch protection.

### Produto/monetização

10. Definir preços, trial, cobrança, cancelamento, reembolso e impostos.
11. Confirmar Super Premium e matriz final de entitlements.
12. Definir cache/quota/TTL/orçamento de IA.
13. Definir limite entre informação personalizada e recomendação regulada.

### Canais

14. WhatsApp: provedor, custo, opt-in e templates.
15. Telegram: adiado.
16. Medir abertura, opt-out, falsos alertas e digest.

### Dados/fornecedores

17. Resolver/documentar lacunas externas.
18. Avaliar licenciamento/SLA de cotações, volume e liquidez.
19. Manter documento não legível como inconclusivo.

### SEO

20. Registrar baseline técnico/Search Console.
21. Definir 20 fundos prioritários.
22. Não comprar backlinks nem publicar páginas rasas.

---

## Critérios para declarar fases concluídas

Uma fase só é concluída quando:

1. código está integrado à `main`;
2. CI obrigatória está verde no SHA;
3. deployment exato está saudável;
4. smoke está documentado;
5. universo aplicável foi coberto;
6. correções são globais e testadas;
7. ausências/conflitos/exceções estão explícitos;
8. double check/auditoria estão persistidos;
9. segurança, custo, rollback e observabilidade foram validados;
10. evidência final está no Git.

**Formulação vigente:** Fases 1 e 2 concluídas; Fase 3 em andamento; Sprint 3.4 concluída; Sprint 3.5 aberta; otimização de GitHub Actions implementada em branch e aguardando validação/merge.
