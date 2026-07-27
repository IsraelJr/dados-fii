# Inventário e orçamento do GitHub Actions

**Atualizado em:** 27/07/2026
**Política associada:** `docs/engineering/github-actions-policy.md`  
**Gate automatizado:** `tests/github-actions-governance.test.mjs`

## 1. Princípios vigentes

- GitHub Actions valida código e executa gates curtos; não funciona como fila, banco, scheduler ou worker persistente.
- Workflows não criam commits, não fazem push, não abrem ou mesclam PRs e não acionam cadeias artificiais de workflows.
- Polling, `sleep` e retries prolongados permanecem proibidos.
- Estado operacional, locks e retomadas pertencem ao backend e ao Firestore.
- Cron de negócio permanece no `vercel.json` ou em scheduler próprio da aplicação.
- Todo job declara `concurrency` cancelável, timeout econômico e permissões mínimas.
- Dependências são instaladas com `npm ci` e lockfile quando instalação é necessária.
- Artefatos operacionais possuem retenção máxima de sete dias.
- A única escrita GitHub permitida ao gate reativo é publicar o próprio commit status; o smoke OIDC grava somente evidência de auditoria no backend. Conteúdo, branches, PRs e Actions permanecem somente leitura.

## 2. Workflows ativos

| Workflow | Finalidade oficial | Gatilho | Timeout | Escrita | Classificação |
|---|---|---|---:|---|---|
| `phase-2-closure.yml` | CI central completa: audit, segredos, lint, typecheck, suíte, Emulator, cobertura, build, HTTP e E2E | PRs relevantes e configuração em `main` | 30 min, exceção documentada | nenhuma | Essencial |
| `portfolio-notifications-ci.yml` | Regressões específicas de notificações | PR do domínio e execução manual | 8 min | nenhuma | Essencial |
| `production-premium-smoke.yml` | Geração Premium real e releitura da auditoria com identidade OIDC vinculada ao SHA publicado | evento único `status` do Vercel bem-sucedido em `main`; `workflow_dispatch` como fallback | 10 min | evidência no backend e commit status auditável | Gate pós-deploy |
| `risk-lab.yml` | Suíte completa e especializada do Risk Lab | PR do domínio e execução manual | 20 min | nenhuma | Essencial |
| `risk-lab-cohort-backtest.yml` | Kickoff curto de tentativa vinculada a SHA | `workflow_dispatch` | 5 min | nenhuma | Processamento no backend |
| `risk-lab-frozen-dividend-notices.yml` | Coleta FNET congelada e controlada | `workflow_dispatch` | 30 min, exceção documentada | nenhuma | Temporário e manual |
| `risk-lab-premium-production-gate.yml` | Double check pós-deploy da integração Premium read-only | evento `status` do Vercel bem-sucedido para commit presente em `main` | 3 min | somente commit status | Gate permanente da Fase 3 |

## 3. Gates Premium de produção

O workflow `risk-lab-premium-production-gate.yml` valida flags e SHA sem ação manual. Ele não é prova funcional suficiente isoladamente.

Regras:

1. reage somente a status `Vercel = success`;
2. exige que o SHA pertença à branch `main`;
3. realiza uma única rodada de consulta ao endpoint `/api/health/risk-lab-premium`;
4. confirma que o SHA retornado é o mesmo SHA implantado;
5. exige `enabled=true`, `mode=read_only` e ruleset `0.2.0`;
6. exige `notificationsAllowed=false` e `externalEffectsAllowed=false`;
7. falha imediatamente em divergência, sem polling, `sleep` ou commit operacional;
8. publica `Risk Lab Premium Production Gate = success|failure` no SHA validado, com link para a execução.

O workflow obrigatório `production-premium-smoke.yml` usa OIDC efêmero, sem segredo estático, e comprova a jornada que o health check não cobre: reconstrói o snapshot de pares, gera um relatório Premium sintético no backend, relê o evento `premium-read` persistido e grava evidência imutável para o SHA ativo. Ele inicia automaticamente uma única vez após o status Vercel `success` do `main`, publica o contexto `Production Premium Smoke` no mesmo SHA e mantém `workflow_dispatch` apenas como fallback operacional.

A permissão `statuses: write` é estritamente limitada à publicação dessa evidência. O workflow não possui permissão de escrita em conteúdo, Actions ou pull requests.

## 4. Orçamento mensal de referência

A projeção é comparativa e deve ser recalibrada com uso real:

| Workflow | Referência mensal |
|---|---:|
| CI central | 420 min |
| Notificações | 18 min |
| Risk Lab | 64 min |
| Backtest kickoff | 2 min |
| Coleta FNET manual | 25 min |
| Gate Premium pós-deploy | até 3 min por release elegível |
| Smoke Premium OIDC | até 10 min por release |

O gate Premium adiciona custo marginal baixo porque não instala dependências, não faz checkout e executa uma única validação HTTP.

## 5. Workflows e mecanismos removidos

Devem permanecer ausentes:

- `patch-portfolio-notification-types.yml`;
- `risk-lab-cohort-deploy-recovery.yml`;
- `risk-lab-production-smoke.yml`;
- `risk-lab-production-smoke-release.yml`;
- `risk-lab-closure.yml`;
- `risk-lab-3-4-finalize-pr59.yml`;
- marcadores Git de deploy ou retomada;
- scripts que criam branch, PR ou merge automaticamente;
- runners que aguardam lock ou deployment com polling.

## 6. Estado e retries

| Tema | Regra atual |
|---|---|
| Deploy ainda não concluído | o gate só inicia após status de sucesso do Vercel |
| SHA incorreto em produção | falha imediata e commit status de falha |
| Lock de processamento | backend/Firestore |
| Retomada de backtest | mesma tentativa e mesmo SHA no backend |
| Cron de aplicação | Vercel/backend |
| Evidência de CI | status checks, commit status e logs nativos |

## 7. Criticidade

- `phase-2-closure.yml`, `portfolio-notifications-ci.yml`, `risk-lab.yml`, `risk-lab-premium-production-gate.yml` e `production-premium-smoke.yml` são gates essenciais.
- `risk-lab-cohort-backtest.yml` apenas inicia processamento idempotente no backend.
- `risk-lab-frozen-dividend-notices.yml` é exceção temporária até existir worker persistente.

## 8. Controle de recorrência

`tests/github-actions-governance.test.mjs` impede:

- workflow não inventariado;
- retorno de workflow legado;
- escrita em conteúdo, branches ou PRs;
- `gh workflow run` como retry;
- polling, `sleep` ou retry ilimitado;
- timeout fora do orçamento;
- instalação mutável;
- falta de `concurrency` cancelável;
- schedule de aplicação;
- permissões excessivas de escrita;
- retenção excessiva de artefatos;
- gatilho automático em workflows pesados.
