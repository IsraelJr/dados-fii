Este documento substitui todos os planejamentos anteriores quando houver divergência.

# Dados FII — Documento Canônico de Handoff

**Versão:** 10.2.0  
**Data:** 27/07/2026  
**Repositório:** `IsraelJr/dados-fii`  
**Branch principal:** `main`  
**Branch de trabalho:** `agent/product-validation-phase-1`  
**Issue:** `#154`  
**PR:** `#155`  
**SHA validado em Preview:** `797e0cd2f608157d4d728c578e696160cac78bb7`  
**Sprint atual:** `PV-1 — Jornada principal da carteira e histórico manual`

## Decisões vigentes que substituem decisões anteriores

| Decisão vigente | Decisão substituída | Efeito |
|---|---|---|
| O projeto está na fase **Produto Validável**. | SEO-S1 e expansão de páginas eram a frente principal. | Ativação, retenção, confiança e conversão passam à frente de tráfego genérico. |
| `PV-1` é a única sprint funcional prioritária até produção. | Múltiplas frentes funcionais concorrentes. | Novas ideias não furam a fila sem impacto direto em ativação, retenção, confiança ou receita. |
| Google AdSense está congelado. | AdSense era tratado como marco de monetização. | Nenhuma funcionalidade depende de propaganda ou desbloqueio por anúncio. |
| Histórico manual do ano corrente é gratuito. | Limite de dois meses e anúncio assistido estavam em avaliação. | A função é mecanismo de ativação e retenção. |
| Premium será visível para descoberta e beta antes do checkout. | Premium era invisível exceto para o proprietário. | Demanda será medida antes de construir cobrança. |
| A carteira é um copiloto de decisões, não um narrador de oscilações. | Alertas poderiam enfatizar variação diária. | O produto separa ruído de mudança material e explica impacto. |
| O legado iOS não é mesclado automaticamente na página web. | O login do proprietário recebia tratamento específico de histórico antigo. | Todos os usuários, inclusive o proprietário, seguem o mesmo fluxo web. |
| O inventário completo de ambiente fica em `docs/operations/runtime-environment-inventory.md`. | O Handoff repetia uma lista extensa e facilmente desatualizada. | O Handoff referencia um inventário versionado e testado sem expor valores. |
| O Handoff v10.2.0 é a única fonte canônica ativa. | Handoffs v10.1.0 e anteriores. | Evidências históricas válidas são preservadas; estado atual é reconciliado abaixo. |

## 1. Estado atual do projeto

### Estado executivo

- Fases 1, 2 e 3 permanecem formalmente concluídas quanto às evidências históricas já aprovadas.
- Release corretivo histórico: `0e029f78560d11d12720c447f2f9058c482e4277`.
- Gate read-only histórico: run `30236078462`.
- Production Premium Smoke histórico: run `30236078473`, artifact `8641670026`.
- PV-1 foi implementada na branch `agent/product-validation-phase-1` e PR `#155`.
- O mesmo SHA `797e0cd2f608157d4d728c578e696160cac78bb7` foi aprovado por:
  - `Portfolio Notifications CI` run `30314601269`;
  - `Phase 2 Closure CI` run `30314601226`;
  - Preview Vercel com status `success`.
- A cadeia aprovou governança, Handoff, audit, secret scan, lint, TypeScript, suíte completa, Firestore Emulator, cobertura crítica, mutation sanity, build, smoke HTTP e E2E desktop/mobile.
- A implementação está pronta para revisão e merge.
- PV-1 ainda não é formalmente concluída em produção porque faltam merge em `main`, deploy do mesmo SHA e smoke pós-deploy.

### Implementado na PV-1

- domínio `PortfolioHistory` tipado e versionado;
- competência canônica `YYYY-MM`;
- moeda pt-BR fail-closed;
- zero válido separado de ausência;
- proveniência `manual`, `automatic_snapshot` e `legacy`;
- conflito explícito e snapshots imutáveis;
- repository server-side e adapter Firestore;
- ownership por identidade resolvida no servidor;
- rotas finas `/api/portfolio/history` e `/api/portfolio/history/migrate`;
- migração idempotente limitada ao ano corrente;
- remoção do carregamento automático do legado iOS;
- painel gratuito de inclusão, edição e exclusão de meses manuais;
- snapshots automáticos e legado como somente leitura;
- telemetria allowlistada sem valores financeiros;
- E2E da inclusão, edição, exclusão e privacidade da telemetria.

### Matriz atual

| Área | Estado |
|---|---|
| Segurança, CI e Risk Lab históricos | Formalmente concluídos |
| PV-1A — domínio e contratos | Aprovada em CI/Preview |
| PV-1B — persistência e ownership | Aprovada em CI/Preview |
| PV-1C — interface e jornada | Aprovada em CI/Preview |
| PV-1D — telemetria e E2E | Aprovada em CI/Preview |
| Merge em `main` | Pendente |
| Produção e smoke pós-deploy | Pendente |
| Premium comercial | Não validado comercialmente |
| Checkout/cobrança | Não implementado e fora da PV-1 |
| AdSense | Congelado |

## 2. Fases concluídas

### Fase 1 — Regulatory Engine

**Estado:** formalmente concluída.

Inclui parser regulatório, normalização, reconciliação, QA, publicação, backup, rollback e auditoria.

### Fase 2 — Core Intelligence & Product Foundation

**Estado:** formalmente concluída quanto à base histórica.

Inclui `RegulatoryDataService`, repositórios, cache, scores, Health, Validation, Admin, relatórios, AI Insights, monitor, catálogo, carteira e jobs.

### Fase 3 — Risk Lab

**Estado:** formalmente concluída.

Inclui dataset, backtest, ruleset `0.2.0`, Premium read-only, bloqueio de efeitos externos, smoke OIDC e auditoria persistida.

### Fase Produto Validável

**Estado:** em execução.

PV-1 está tecnicamente validada em CI e Preview. A conclusão formal depende de produção no mesmo SHA.

## 3. Sprint atual

### PV-1 — Jornada principal da carteira e histórico manual

**Objetivo:** entregar o fluxo:

`cadastro/login → carteira → histórico → diagnóstico → retorno posterior sem perda de dados`.

### Escopo entregue

- cadastro manual de ano, mês, patrimônio e dividendos;
- edição e exclusão de registros manuais;
- duplicidade bloqueada por owner, carteira e competência;
- snapshots automáticos e legado imutáveis;
- ownership server-side;
- API server-side;
- telemetria sanitizada;
- interface gratuita e sem propaganda;
- E2E desktop/mobile.

### Gate de conclusão formal

PV-1 só muda para concluída após:

1. merge da PR `#155` sem bypass;
2. deploy em produção do mesmo SHA validado ou do merge commit com árvore equivalente;
3. smoke não destrutivo em produção;
4. confirmação da persistência e leitura do histórico;
5. confirmação de ausência de carregamento automático do legado iOS;
6. atualização deste Handoff com SHA de produção e IDs do smoke.

## 4. Ordem oficial das próximas sprints

1. **PV-1 — merge, produção e smoke da jornada principal.**
2. **PV-2 — descoberta do Premium e beta controlado, sem checkout falso.**
3. **PV-3 — telemetria, retenção e validação de disposição a pagar.**
4. **PV-4 — relatório incremental: “o que mudou desde a última análise”.**
5. **PV-5 — Radar/Acompanhar fundo fora da carteira.**
6. **PV-6 — cobrança, somente após evidência comercial suficiente.**
7. **PV-7 — carteira histórica verdadeira, retorno total e atribuição.**
8. **PV-8 — screener, comparador, filtros salvos e fair value por categoria.**

SEO editorial, AdSense, WhatsApp, Telegram e novas ferramentas não antecipam PV-1 a PV-3.

## 5. Escopo e critérios de aceite de cada sprint

### PV-1

Aceite técnico já comprovado no SHA `797e0cd2f608157d4d728c578e696160cac78bb7` pelos runs `30314601269` e `30314601226` e pelo Preview Vercel.

Aceite final pendente: produção e smoke do mesmo código.

### PV-2

Escopo:

- tornar a proposta Premium visível;
- exibir benefícios, diferenças e amostra;
- registrar interesse e consentimento;
- permitir beta por allowlist server-side;
- manter checkout indisponível.

Aceite:

- nenhum botão de pagamento falso;
- `premium_viewed` e `premium_interest_submitted` medidos;
- custo de IA limitado e auditável;
- entitlement server-side.

### PV-3

Escopo:

- funil de ativação;
- retenção D7 e D30;
- coorte beta externa;
- entrevistas orientadas a comportamento e preço.

Aceite:

- métricas reproduzíveis;
- eventos sem carteira, valores, e-mail ou ticker desnecessário;
- decisão documentada sobre preço e cobrança;
- validação não baseada apenas no proprietário.

### PV-4

Relatório-base mais delta desde a última análise. Não repetir relatório completo quando nada relevante mudou.

### PV-5

Acompanhar fundo fora da carteira. Grátis até 1 fundo; Premium até 10. Ausência de mudança não notifica.

### PV-6

Checkout, recorrência, cancelamento, webhooks, conciliação e entitlement. Só inicia após demanda comercial comprovada.

## 6. Regras arquiteturais obrigatórias

1. Route Handler → autenticação/schema → controller/application service → domínio → repository → Firestore/provedor.
2. Nenhum `route.ts` importa Firestore diretamente.
3. Componente React não contém regra financeira, conflito ou persistência de domínio.
4. Repository não importa React, `NextResponse` ou apresentação.
5. Carteira e histórico possuem tipos fortes e schemas versionados.
6. Competência usa `YYYY-MM`.
7. Ausência não vira zero; `NaN`, infinito, data futura e valor inválido falham fechado.
8. Identidade do registro usa owner, carteira e competência.
9. Snapshot automático não é editável como manual.
10. Conflito manual/snapshot é explícito.
11. Proveniência e timestamps são obrigatórios.
12. Logs e telemetria não contêm valores financeiros, posições, e-mail, token ou cookie.
13. Plano, admin e identidade vêm do servidor.
14. Risk Lab permanece read-only no Premium.
15. Correções são gerais, sem hardcode por ticker, e-mail ou usuário.
16. CI é gate de merge e deploy.
17. Node 22 strip-only deve ser suportado pelos módulos executados diretamente nos testes.

## 7. Arquivos, branches, commits e PRs existentes

### Estado histórico

- Release corretivo: `0e029f78560d11d12720c447f2f9058c482e4277`.
- PRs históricas principais: `#141`, `#142`, `#143`, `#146`, `#147`, `#148`, `#149`, `#150`, `#151`, `#152`, `#153`.
- PR `#65`: encerrada sem merge por substituição canônica.

### PV-1

- Branch: `agent/product-validation-phase-1`.
- Issue: `#154`.
- PR: `#155`.
- SHA validado: `797e0cd2f608157d4d728c578e696160cac78bb7`.
- CI principal: run `30314601226` — sucesso.
- CI de notificações: run `30314601269` — sucesso.
- Preview Vercel: sucesso.
- Documento de direção: `docs/product/product-validation-phase-1.md`.
- Auditoria: `docs/product/pv-1-wallet-gap-analysis.md`.
- Inventário de ambiente: `docs/operations/runtime-environment-inventory.md`.

### Arquivos centrais

- `src/lib/portfolio/PortfolioHistory.ts`;
- `src/lib/portfolio/PortfolioHistoryRepository.ts`;
- `src/lib/portfolio/PortfolioHistoryService.ts`;
- `src/lib/portfolio/LegacyPortfolioHistoryMigration.ts`;
- `src/server/repositories/FirestorePortfolioHistoryRepository.ts`;
- `src/server/auth/WalletIdentityResolver.ts`;
- `src/server/controllers/PortfolioHistoryController.ts`;
- `src/server/controllers/PortfolioHistoryMigrationController.ts`;
- `src/app/api/portfolio/history/route.ts`;
- `src/app/api/portfolio/history/migrate/route.ts`;
- `src/app/components/PortfolioHistoryPanel.tsx`;
- `src/lib/product/ProductEvent.ts`;
- `src/server/controllers/ProductEventController.ts`;
- `tests/portfolio-history*.test.*`;
- `tests/e2e/critical-journeys.spec.ts`.

## 8. Funcionalidades concluídas, parciais e pendentes

### Concluídas historicamente

- motor regulatório e catálogo;
- relatórios Free, AI Insights e Premium controlado;
- Risk Lab read-only;
- segurança, CI e produção corretiva;
- carteira básica e snapshots.

### Concluídas tecnicamente na PV-1

- histórico manual server-side;
- isolamento entre usuários;
- inclusão, edição e exclusão;
- proveniência e conflito;
- migração idempotente;
- remoção do autoload iOS;
- telemetria sanitizada;
- E2E desktop/mobile;
- Preview aprovado.

### Pendentes imediatas

- merge da PR `#155`;
- deploy em produção;
- smoke pós-deploy;
- confirmação do índice Firestore no ambiente de produção, quando necessário;
- atualização final do Handoff com SHA de produção.

### Pendentes de produto

- descoberta Premium e lista de interesse;
- beta externo;
- relatório incremental;
- Radar/Acompanhar fundo;
- cobrança;
- retorno total e atribuição;
- screener e comparador.

## 9. Decisões de segurança

- Segredos são server-only.
- `NEXT_PUBLIC_*` nunca concede plano, admin, ownership ou privilégio.
- Carteira e histórico são privados e `noindex`.
- Entitlement e identidade são resolvidos no servidor.
- Firestore cliente permanece fail-closed conforme arquitetura vigente.
- Escritas exigem autenticação, schema e ownership.
- Usuário só acessa e altera seus próprios registros.
- Snapshot automático não pode ser alterado como manual.
- Eventos analíticos não armazenam valores da carteira.
- Erros públicos não expõem detalhes internos.
- E-mail, `ownerId` e `userId` enviados no body não concedem identidade.
- Sessão por e-mail exige token persistido, válido e não expirado.
- Não existe exceção por e-mail pessoal.

## 10. Variáveis de ambiente

O inventário versionado e testado está em:

`docs/operations/runtime-environment-inventory.md`

Regras:

- valores nunca são registrados no Git, Handoff, logs ou evidências;
- toda variável nova exige classificação, owner, ambientes, fallback, rollback e teste;
- alias legado possui plano de remoção;
- feature flag temporária possui condição de remoção.

## 11. Testes obrigatórios

Gate obrigatório:

1. `npm ci`;
2. governança de workflows;
3. Handoff canônico;
4. audit de produção;
5. secret scan;
6. lint;
7. typecheck;
8. suíte unitária, integração e contratos;
9. Firestore Emulator;
10. cobertura crítica;
11. mutation sanity;
12. build;
13. smoke HTTP;
14. Chromium;
15. E2E desktop/mobile;
16. Preview Vercel;
17. produção e smoke pós-deploy.

Evidência atual do SHA `797e0cd2f608157d4d728c578e696160cac78bb7`:

- `Portfolio Notifications CI` run `30314601269`: aprovado;
- `Phase 2 Closure CI` run `30314601226`: aprovado;
- E2E da carteira e histórico manual: aprovado em desktop e mobile;
- Preview Vercel: aprovado.

Nenhuma validação manual substitui esses gates.

## 12. Pendências e decisões ainda abertas

### Bloqueadores imediatos

- revisar e mesclar PR `#155`;
- confirmar deploy do código validado em produção;
- executar smoke não destrutivo;
- registrar SHA e IDs finais.

### Comerciais

- preço do Premium;
- recorrência, anual ou compra avulsa;
- provedor de pagamento;
- cartão, Pix recorrente ou Pix avulso;
- política de beta e limites de IA.

### Produto

- tratamento visual avançado de conflito manual/snapshot;
- importação de anos anteriores;
- importação por planilha;
- definição final do diagnóstico gratuito;
- conteúdo da prévia Premium.

### Canais

- WhatsApp: custo, opt-in, template e frequência;
- Telegram permanece adiado;
- e-mail deve permanecer deduplicado e orientado a mudança material.

### Regra executiva

Uma demanda só antecipa PV-1 a PV-3 quando comprovar impacto direto em ativação, retenção, confiança, conversão ou redução de custo/risco.
