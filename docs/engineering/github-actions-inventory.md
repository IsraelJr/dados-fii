# Inventário e orçamento do GitHub Actions

**Atualizado em:** 26/07/2026  
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

## 2. Workflows ativos

| Workflow | Finalidade oficial | Gatilho | Timeout | Escrita | Classificação |
|---|---|---|---:|---|---|
| `phase-2-closure.yml` | CI central, governança, Handoff, typecheck e regressão da Fase 2 | PRs relevantes e configuração em `main` | 20 min | nenhuma | Essencial |
| `portfolio-notifications-ci.yml` | Regressões específicas de notificações | PR do domínio e execução manual | 8 min | nenhuma | Essencial |
| `risk-lab.yml` | Suíte completa e especializada do Risk Lab | PR do domínio e execução manual | 20 min | nenhuma | Essencial |
| `risk-lab-cohort-backtest.yml` | Kickoff curto de tentativa vinculada a SHA | `workflow_dispatch` | 5 min | nenhuma | Processamento no backend |
| `risk-lab-frozen-dividend-notices.yml` | Coleta FNET congelada e controlada | `workflow_dispatch` | 30 min, exceção documentada | nenhuma | Temporário e manual |
| `risk-lab-premium-production-gate.yml` | Double check pós-deploy da integração Premium read-only | evento `status` do Vercel bem-sucedido para commit presente em `main` | 3 min | nenhuma | Gate permanente da Fase 3 |

## 3. Gate Premium de produção

O workflow `risk-lab-premium-production-gate.yml` substitui qualquer necessidade de validação manual do rollout da Sprint 3.7.

Regras:

1. reage somente a status `Vercel = success`;
2. exige que o SHA pertença à branch `main`;
3. realiza uma única rodada de consulta ao endpoint `/api/health/risk-lab-premium`;
4. confirma que o SHA retornado é o mesmo SHA implantado;
5. exige `enabled=true`, `mode=read_only` e ruleset `0.2.0`;
6. exige `notificationsAllowed=false` e `externalEffectsAllowed=false`;
7. falha imediatamente em divergência, sem polling, `sleep` ou commit operacional.

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
| SHA incorreto em produção | falha imediata |
| Lock de processamento | backend/Firestore |
| Retomada de backtest | mesma tentativa e mesmo SHA no backend |
| Cron de aplicação | Vercel/backend |
| Evidência de CI | status checks e logs nativos |

## 7. Criticidade

- `phase-2-closure.yml`, `portfolio-notifications-ci.yml`, `risk-lab.yml` e `risk-lab-premium-production-gate.yml` são gates essenciais.
- `risk-lab-cohort-backtest.yml` apenas inicia processamento idempotente no backend.
- `risk-lab-frozen-dividend-notices.yml` é exceção temporária até existir worker persistente.

## 8. Controle de recorrência

`tests/github-actions-governance.test.mjs` impede:

- workflow não inventariado;
- retorno de workflow legado;
- escrita no repositório;
- `gh workflow run` como retry;
- polling, `sleep` ou retry ilimitado;
- timeout fora do orçamento;
- instalação mutável;
- falta de `concurrency` cancelável;
- schedule de aplicação;
- permissões de escrita;
- retenção excessiva de artefatos;
- gatilho automático em workflows pesados.
