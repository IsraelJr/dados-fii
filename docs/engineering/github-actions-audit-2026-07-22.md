# Auditoria controlada — GitHub Actions

**Data:** 22/07/2026  
**Repositório:** `IsraelJr/dados-fii`  
**Baseline:** `fb926f241a57a3d1c0f1a701f82701f302fece1a`  
**Branch:** `agent/github-actions-cost-architecture`  
**PR:** #101  
**Status:** implementação pronta; merge bloqueado até o executor do GitHub voltar a iniciar jobs.

## 1. Resultado do inventário

O histórico completo entre o commit inicial e o baseline confirmou sete workflows ativos no `main`:

1. `patch-portfolio-notification-types.yml`;
2. `phase-2-closure.yml`;
3. `portfolio-notifications-ci.yml`;
4. `risk-lab.yml`;
5. `risk-lab-cohort-backtest.yml`;
6. `risk-lab-cohort-deploy-recovery.yml`;
7. `risk-lab-frozen-dividend-notices.yml`.

Após a refatoração permanecem cinco. O patch legado e o recovery por commits foram removidos.

## 2. Cenário controlado da PR #101

Ao abrir a PR e ao atualizar arquivos de código/workflow, foram criadas somente estas execuções:

- `Phase 2 Closure CI`;
- `Risk Lab CI`;
- `Portfolio Notifications CI`.

Não foram criadas execuções automáticas de:

- backtest da Sprint 3.5;
- recovery de deploy;
- coleta FNET congelada;
- retomada em lotes;
- workflow isolado do DEVA11.

Isso confirma que os workflows pesados ficaram exclusivamente em `workflow_dispatch` e que a cascata anterior foi interrompida.

### Runs observados

Primeiro head testado:

- Phase 2 Closure CI: `29946392916`;
- Risk Lab CI: `29946393156`;
- Portfolio Notifications CI: `29946392922`.

Head posterior:

- Phase 2 Closure CI: `29947561173`;
- Risk Lab CI: `29947560863`;
- Portfolio Notifications CI: `29947560957`.

Todos terminaram antes da primeira etapa: os jobs retornaram `steps: null`, sem checkout, instalação ou teste. Uma única repetição da CI central produziu o mesmo resultado. A falha é classificada como indisponibilidade/quota de provisionamento do executor, não como teste reprovado. Não foram feitas novas retentativas automáticas.

## 3. Testes executados fora do runner

### Governança dos workflows

Comando equivalente:

```bash
node --test tests/github-actions-governance.test.mjs
```

Resultado: **10/10 aprovados**.

Cobertura:

- inventário obrigatório;
- arquivos legados ausentes;
- zero commit/push/PR/merge/`gh workflow run`;
- zero sleep, polling ou retry ilimitado;
- timeout e `concurrency` em todos os jobs;
- `npm ci` e cache;
- zero schedule de aplicação e permissões de escrita;
- workflows pesados somente manuais;
- retenção máxima de sete dias;
- kickoff com uma chamada;
- orquestração no backend/planner.

### Planner idempotente da coorte

Comando equivalente:

```bash
node --import ./tests/register-ts-loader.mjs --experimental-strip-types \
  --test tests/risk-lab-cohort-advance-planner.test.ts
```

Resultado: **5/5 aprovados**.

Cobertura:

- inicialização sem tentativa ou com SHA anterior;
- seleção determinística do primeiro ticker pendente;
- finalização apenas após seis casos;
- `noop` após estado terminal;
- falha fechada para release/coorte inválida.

### Sintaxe YAML

Os cinco arquivos finais foram parseados individualmente: **5/5 válidos**, um job em cada workflow.

## 4. Build/deploy de Preview

O Preview Vercel do head auditado ficou `success`/`Ready`:

- deployment: `6Q7LsWQR7SHsfigEY3AQWXFZYPQP`;
- nenhuma regressão de build ou configuração foi identificada pelo deployment.

O Preview não substitui as suítes completas do GitHub, mas comprova que a aplicação e a configuração versionada são implantáveis.

## 5. Limpeza de automações temporárias

- PR #96 fechada sem merge; continha retomadas automáticas em até 12 lotes.
- PR #100 fechada sem merge; o código/evidência do DEVA11 permanece recuperável, mas o workflow temporário próprio não será integrado.
- marcador `sprint-3-5-deploy-trigger.json` removido.
- recovery que fazia commit/push em `main` removido.

## 6. Comparação de consumo

Cenário reproduzível documentado no inventário:

| Métrica | Antes | Depois |
|---|---:|---:|
| Workflows ativos | 7 | 5 |
| Workflows com escrita no Git | 3 | 0 |
| Workflows pesados automáticos | 2 | 0 |
| Timeout máximo | 120 min | 30 min manual; 20 min CI comum |
| Backtest por release | até 6 × 90 min | 1 kickoff de até 5 min |
| Projeção mensal | 2.140 min | 529 min |
| Redução | — | 1.611 min / 75,3% |

Após mover também a coleta FNET para fila/worker, a projeção é de 504 min/mês, redução de 76,4%.

## 7. Decisão de merge

A PR permanece draft e não deve ser mesclada enquanto as suítes obrigatórias não conseguirem iniciar no GitHub.

Gates já satisfeitos:

- inventário completo;
- política oficial;
- cascata removida;
- workflows pesados manuais;
- testes locais novos verdes;
- YAML válido;
- Preview Vercel verde;
- PRs temporárias neutralizadas.

Gate pendente por infraestrutura:

- execução efetiva de `Phase 2 Closure CI`, `Risk Lab CI` e `Portfolio Notifications CI` com steps e resultado verde.

Nenhum resultado foi marcado como aprovado por suposição.
