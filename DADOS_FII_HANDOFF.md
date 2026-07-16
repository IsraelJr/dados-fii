# Dados FII — Documento Canônico de Handoff

**Versão:** 4.0.0  
**Data:** 16/07/2026

> Este documento substitui todos os planejamentos anteriores quando houver divergência.

## Objetivo

Este documento consolida o estado oficial do projeto Dados FII, servindo como referência única para continuidade do desenvolvimento.

Sempre que houver divergência entre documentos, conversas, prompts ou planejamentos antigos, este documento prevalece.

---

## 1. Estado atual do projeto

### Status geral

**Fases 1 e 2 implementadas; aceite global reaberto pelo gate de qualidade de dados**

Situação atual:

- Engine regulatória implementada
- Parser v2 consolidado
- Publicação protegida
- Rollback implementado
- Backup imutável
- Aprovação humana
- QA operacional
- CI existente
- Arquitetura de serviços pronta para evolução
- Catálogo normalizado B3/CVM implementado e auditado localmente

A avaliação anterior foi otimista ao considerar componentes funcionais e alguns fundos sentinela como prova de conclusão. A partir desta versão, uma fase só recebe aceite total depois de cobertura integral do universo aplicável, deploy, carga protegida, double check pós-carga e homologação de relatórios/IA. O código do hardening está pronto, mas a carga e a auditoria final de Produção ainda estão pendentes.

---

## 2. Fase concluída

### Fase 1 — Regulatory Engine

**Concluído:**

- Parser CVM v2
- Suporte FII
- Suporte FIAGRO
- Reconciliação automática
- QA Operacional
- Aprovação humana
- Backup imutável
- Publicação protegida
- Rollback
- Hash de aprovação
- Separação Staging x Produção
- Pipeline CI
- Testes reais

Fundos utilizados na homologação:

- TGAR11
- VGIA11
- MXRF11
- KNCA11

Todos aprovados.

---

## 3. Sprint atual

### Gate transversal — Data Quality Hardening

**Objetivo:** normalizar, conciliar, completar e auditar o catálogo inteiro antes de encerrar as Fases 1 e 2.

**Status:** código e auditoria externa local concluídos; integração, deploy, aplicação administrativa e double check de Produção pendentes.

**Auditoria de 16/07/2026:**

- 511/511 candidatos B3 conciliados com cadastro CVM;
- zero CNPJ duplicado entre ativos;
- 504/504 fundos ativos com cadastro básico completo;
- 491/502 fundos aplicáveis com indicadores essenciais completos (97,81%);
- 11 exceções essenciais atribuídas a ausência nos layouts estruturados, sem zeros inventados;
- HGPO11 identificado para inativação por ausência B3 + liquidação CVM;
- sete tickers presentes na B3 e em liquidação preservados em revisão;
- três divergências históricas de ISIN preservadas para revisão sem trocar CNPJ.

Detalhes, fontes, contrato, custos e procedimento: `docs/data-quality-hardening.md`.

---

## 4. Ordem oficial das próximas Sprints

| Sprint | Entrega principal |
|---|---|
| 2.1 | RegulatoryDataService |
| 2.2 | Score Engine |
| 2.3 | Health System |
| 2.4 | Validation System |
| 2.5 | Dashboard Administrativo |
| 2.6 | Timeline Regulatória |
| 2.7 | Relatório Gratuito |
| 2.8 | AI Insights Engine |
| 2.9 | Relatório Premium |
| 2.10 | Observabilidade |
| 2.11 | Monitor Automático |

---

## 5. Escopo e critérios de aceite

### Sprint 2.1 — RegulatoryDataService

Criar:

- RegulatoryRepository
- RegulatoryDataService
- RegulatoryNormalizer
- RegulatoryValidator
- RegulatoryCache
- RegulatoryTypes

Critérios:

- Nenhuma API acessar Firestore diretamente.
- Todas utilizam RegulatoryDataService.

### Sprint 2.2 — Score Engine

Criar:

- ScoreEngine

Subscores:

- Risk
- Dividend
- Governance
- Growth
- Liquidity
- Quality
- Premium

Critério:

- Novo FII deve gerar todos os scores automaticamente.

### Sprint 2.3 — Health API

Criar:

- `GET /api/admin/system/health`

Retorno:

- Firestore
- Parser
- QA
- Publicação
- Rollback
- Cache
- Score

### Sprint 2.4 — Validation Runner

Criar:

- `POST /api/admin/system/run-validation`
- Validation History
- Parser Health
- System Health

### Sprint 2.5 — Dashboard Admin

Cards:

- Saúde
- Parser
- Firestore
- QA
- Publicação
- Rollback
- Histórico

### Sprint 2.6 — Timeline

Mostrar:

- Documentos
- Eventos
- Fatos relevantes
- Assembleias
- Regulamentos

### Sprint 2.7 — Relatório Gratuito

- Gerado automaticamente.

### Sprint 2.8 — AI Insights Engine

Gerar:

- Resumo executivo
- Mudanças
- Riscos
- Oportunidades
- Alertas
- Linguagem simples

### Sprint 2.9 — Relatório Premium

Adicionar:

- Valuation
- Stress test
- Cenários
- Comparativos
- Recomendações
- Análise IA

### Sprint 2.10 — Observabilidade

Métricas:

- Tempo
- Retries
- Falhas
- Ingestão
- Parser
- QA
- Publicação

### Sprint 2.11 — Monitor Automático

Alertas via:

- Painel
- Firestore
- E-mail
- Telegram

---

## 6. Regras arquiteturais obrigatórias

### Regra 1 — Acesso ao Firestore

Nenhuma API nova pode acessar Firestore diretamente.

Fluxo obrigatório:

```text
API
 ↓
RegulatoryDataService
 ↓
Firestore
```

### Regra 2 — RegulatoryRepository

Toda leitura regulatória passa pelo RegulatoryRepository.

### Regra 3 — Dados derivados

Dados derivados nunca serão gravados manualmente. Devem ser calculados.

### Regra 4 — Publicação

Toda publicação exige:

- Backup
- Aprovação
- Hash
- Rollback

### Regra 5 — Campos legados

Campos legados protegidos nunca podem ser sobrescritos automaticamente.

### Regra 6 — Inteligência artificial

Toda IA utiliza AI Insights Engine. Nenhuma API chama OpenAI diretamente.

### Regra 7 — Scores

Todo Score passa pelo ScoreEngine.

---

## 7. Branches, commits e PRs

### Estado conhecido

**Branch principal:** `main`

**CI:** configurado

O commit, PR e resultado de CI desta entrega de qualidade devem ser registrados aqui depois da publicação. Nenhum estado local é prova de deploy.

---

## 8. Funcionalidades

### Implementadas e existentes em Produção antes do hardening

- Parser
- QA
- Reconciliação
- Backup
- Rollback
- Publicação
- Approval
- Hash
- CI
- Staging
- Produção

### Componentes funcionais da Fase 2

- RegulatoryDataService
- Score Engine
- Health System
- Validation System
- Dashboard Administrativo
- Timeline Regulatória
- Relatório Gratuito
- AI Insights Engine
- Relatório Premium
- Observabilidade
- Monitor Automático

### Pendências para aceite total

- integrar e publicar o catálogo normalizado;
- aplicar a prévia em Produção com aprovação e hash;
- executar o double check pós-carga;
- confirmar as exceções essenciais no Admin;
- homologar relatórios, scores e IA em amostra estratificada;
- reavaliar formalmente o aceite das Fases 1 e 2.

---

## 9. Decisões de segurança

### APIs administrativas

Exigem:

- Firebase Authentication
- E-mail autorizado
- Perfil Admin

Nenhuma API administrativa será pública.

Logs obrigatórios:

- Publicação
- Rollback
- Validação
- Aprovação

Também são obrigatórios:

- Rate limiting
- Backup antes da publicação
- Rollback
- Hash

---

## 10. Variáveis de ambiente

Além das variáveis já existentes para OpenAI, Firebase e demais integrações, adicionar na Fase 2:

```text
ENABLE_SYSTEM_VALIDATION
ENABLE_HEALTH_MONITOR
ENABLE_AI_INSIGHTS
ENABLE_REPORT_PREMIUM
ENABLE_SCORE_ENGINE
ENABLE_AUTOMATIC_MONITOR
ENABLE_PORTFOLIO_REGULATORY_INTELLIGENCE
PREMIUM_PREVIEW_EMAILS
MONITOR_ALERT_COOLDOWN_MS
MONITOR_ALERT_EMAILS
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASS
SMTP_FROM
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
CRON_SECRET
```

---

## 11. Testes obrigatórios

Antes de qualquer deploy:

- CI
- Parser
- QA
- Reconciliação
- Publicação
- Rollback
- Backup
- Health
- Validation

Todo parser novo deve homologar, no mínimo:

- 1 FII
- 1 FIAGRO

antes da produção.

Além dos sentinelas, todo fechamento de fase exige auditoria do universo completo aplicável, 100% de conciliação de identidade, 100% de cadastro básico dos ativos, zero duplicidade de CNPJ e lista explícita das lacunas externas. Ver `docs/data-quality-hardening.md`.

---

## 12. Pendências

### Alta prioridade

- integrar o Data Quality Hardening ao branch principal e validar o CI;
- confirmar o deploy de Produção;
- gerar a prévia do catálogo no Admin e revisar 511/511, inativações e exceções;
- aplicar a carga protegida por hash e backup;
- executar o double check pós-carga;
- homologar relatório gratuito, Premium, scores e IA com fundos de tipos e níveis de completude diferentes;
- manter as 11 exceções essenciais visíveis e acompanhar novas competências CVM para preenchimento futuro.

### Decisões abertas

1. Modelo final do Premium.
2. Modelo de cobrança.
3. Estratégia de cache distribuído.
4. Monitoramento em tempo real.
5. Integração futura com novos provedores regulatórios.

### Decisões substituídas

As seguintes decisões passam a substituir planejamentos anteriores:

1. RegulatoryDataService obrigatório substitui qualquer acesso direto ao Firestore por novas APIs.
2. AI Insights Engine centralizado substitui a ideia anterior de cada relatório consumir IA diretamente.
3. ScoreEngine único substitui cálculos independentes por API.
4. Dashboard Administrativo com Health Score substitui o uso do GitHub Actions como principal mecanismo operacional para validações rotineiras.
5. Arquitetura baseada em serviços reutilizáveis substitui implementações específicas por endpoint.
6. Cobertura parcial ou homologação por poucos fundos não autoriza mais declarar uma fase totalmente concluída.
7. Quantidade de cotas, patrimônio e cotistas são snapshots datados, não campos cadastrais fixos.
8. A ausência de dado externo é `null` com aviso; nunca zero, risco do fundo ou inferência negativa da IA.

---

## Objetivo estratégico

O objetivo da Fase 2 permanece uma arquitetura orientada a serviços, com ingestão regulatória consolidada, inteligência reutilizável, observabilidade e relatórios consistentes. O aceite total só ocorrerá quando essa capacidade estiver comprovada em Produção sobre todo o universo aplicável, com qualidade, rastreabilidade e exceções documentadas.
