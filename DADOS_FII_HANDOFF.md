# Dados FII — Documento Canônico de Handoff

**Versão:** 3.0.0  
**Data:** 14/07/2026

> Este documento substitui todos os planejamentos anteriores quando houver divergência.

## Objetivo

Este documento consolida o estado oficial do projeto Dados FII, servindo como referência única para continuidade do desenvolvimento.

Sempre que houver divergência entre documentos, conversas, prompts ou planejamentos antigos, este documento prevalece.

---

## 1. Estado atual do projeto

### Status geral

**Fases 1 e 2 concluídas em código**

Situação atual:

- Engine regulatória implementada
- Parser v2 consolidado
- Publicação protegida
- Rollback implementado
- Backup imutável
- Aprovação humana
- QA operacional
- CI validado
- Arquitetura pronta para evolução

A camada de inteligência, relatórios, observabilidade e monitoramento da Fase 2 está implementada no PR #6. Merge, configuração das variáveis e deploy de produção continuam sendo etapas operacionais separadas.

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

### Encerramento da Fase 2

**Objetivo:** revisar, integrar e publicar as Sprints 2.1 a 2.11.

**Status:** todas as Sprints da Fase 2 estão implementadas no PR #6 e aguardam revisão, merge, configuração das flags/integrações e deploy de produção.

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

**Última execução conhecida antes das Sprints 2.3–2.4:** Success

**Tempo:** 2m54s

**PR atual:** #6 — `Fase 2 completa: Sprints 2.1–2.11` (draft)

**Branch:** `agent/sprint-2-1-2-2-regulatory-admin`

---

## 8. Funcionalidades

### Concluídas

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

### Implementadas no PR #6, pendentes de merge/deploy

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

### Pendentes de código na Fase 2

- Nenhum item canônico.

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

---

## 12. Pendências

### Alta prioridade

- Revisar e fazer merge do PR #6.
- Configurar as variáveis de produção e habilitar `ENABLE_REPORT_PREMIUM` e `ENABLE_AUTOMATIC_MONITOR` quando as integrações estiverem prontas.
- Validar o deploy, o cron diário das 12:00 UTC e as entregas por e-mail/Telegram em produção.

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

---

## Objetivo estratégico

Ao final da Fase 2, o Dados FII possui em código uma arquitetura orientada a serviços, com ingestão regulatória consolidada, inteligência reutilizável, observabilidade completa e capacidade de gerar relatórios gratuitos e Premium de forma consistente, auditável e escalável, preservando segurança, rastreabilidade e facilidade de evolução futura.
