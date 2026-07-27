Este documento substitui todos os planejamentos anteriores quando houver divergência.

# Dados FII — Documento Canônico de Handoff

**Versão:** 9.0.0

**Data:** 27/07/2026
**Repositório:** `IsraelJr/dados-fii`  
**Branch principal:** `main`  
**Último SHA de `main` auditado antes das correções:** `607dafefefaba5c88f986236eb365440c6fb8c94`

**Release corretivo aprovado em produção antes desta reconciliação documental:** `0e029f78560d11d12720c447f2f9058c482e4277`
**PRs corretivas mescladas:** `#141`, `#142` e `#143`
**Gate read-only pós-deploy:** run `30236078462` — aprovado
**Production Premium Smoke:** run `30236078473` — aprovado
**Artefato do smoke:** `8641670026`
**Hash da evidência Premium:** `8a9709056d046a8f2f73d4e20e7cdcb77c861706b592c24a6333fdf566ee983b`

**Sprint atual:** SEO-S1 — fundação técnica e páginas prioritárias

**Estado oficial:** Sprints Corretivas R0–R5 e Fase 3 formalmente concluídas; código, CI, deployment, geração Premium real, auditoria persistida e isolamento read-only foram comprovados no mesmo release
**Política documental:** este é o único Handoff corrente. Versões anteriores pertencem ao histórico do Git, não à árvore ativa.

## Como interpretar os status

- **Implementada no branch:** o código existe no branch corretivo, mas ainda não integra `main`.
- **Testada localmente:** o gate foi reproduzido no checkout auditado.
- **Aprovada no CI:** instalação limpa e todos os checks obrigatórios passaram no SHA do PR.
- **Implantada:** o SHA exato foi publicado no ambiente de produção.
- **Auditada em produção:** smoke e contratos não destrutivos comprovaram o comportamento no SHA publicado.
- **Formalmente concluída:** todos os estados anteriores estão comprovados, sem pendência bloqueadora.
- **Parcial:** parte do escopo existe, mas falta ao menos um gate.
- **Inconclusiva:** a evidência não permite afirmar sucesso ou falha.

Código, documento, teste unitário, HTTP 200, workflow ou deployment isolado não concluem uma Sprint.

## Decisões vigentes que substituem decisões anteriores

| Decisão vigente | Decisão substituída | Efeito |
|---|---|---|
| A auditoria independente de 26/07/2026, executada no SHA `607dafe…`, prevalece sobre a declaração anterior de conclusão da Fase 3; os bloqueadores foram corrigidos e revalidados no release `0e029f…`. | Handoff v6.14.0 declarava Fase 3 concluída sem os gates corretivos posteriores. | A Fase 3 volta a estar formalmente concluída com nova cadeia de evidências, sem reutilizar a aprovação antiga. |
| O Handoff v9.0.0 é a única fonte canônica ativa. | Handoffs v8.3.0, v7.0.0 externo, v6.14.0 do Git e arquivo `DADOS_FII_HANDOFF_SPRINT_3_5_CONTINUACAO.md`. | O arquivo de continuação foi removido; fontes antigas permanecem apenas como histórico. |
| HTTP 200 só representa evidência Risk Lab aprovada, atual e compatível com release/ruleset/metodologia. | Endpoint podia responder 200 com `ok:false` ou execução reprovada/antiga. | Ausência usa 404, incompatibilidade 409, execução 202, reprovação 422 e sucesso real 200. |
| Privilégio, plano, e-mail e identidade são resolvidos no servidor. | `isPremium`, e-mail ou segredo informado pelo cliente influenciavam autorização. | Mutação e entitlement falham fechado. |
| Segredo administrativo não é aceito em query, body ou headers legados. | Segredo compartilhado e estático era usado por rotas legadas. | Admin humano usa sessão HttpOnly; cron usa Bearer; GitHub usa OIDC efêmero vinculado ao workflow/SHA. |
| Firestore do cliente é fail-closed e nenhuma rota acessa a persistência diretamente. | Regras não versionadas e handlers com `adminDb`/`.collection()`. | Regras e índices estão no Git; handlers delegam à camada server. |
| DY canônico é dividendos pagos em 12 meses dividido pela cotação atual, com fonte, data-base e versão. | Campo legado de DY podia prevalecer sem proveniência. | Conflito fica registrado; ausência de preço invalida derivados. |
| Dados ausentes, inválidos, obsoletos e indisponíveis são estados diferentes. | Incompletude podia receber validação integral ou zero inventado. | Validator aplica invariantes, escala pt-BR, CNPJ, coerência e freshness. |
| Categorias Risk Lab sem calibração suficiente retornam `insufficient_data`. | Extrapolação por semelhança ou regra especial por ticker. | Nenhum alerta é inventado fora do domínio homologado. |
| Importação FNET válida é determinística, idempotente e automática; conflito é quarentena. | Aprovação técnica manual era parte do fluxo normal. | O proprietário não valida conteúdo técnico por fundo. |
| Premium lê snapshot de pares materializado, não varre o catálogo a cada requisição. | Até 1.000 leituras de pares por relatório. | Custo passa a ser constante por relatório; snapshot vencido falha fechado. |
| Carteira é privada, `noindex` e ausente do sitemap. Canonical raiz é relativo à rota. | `/carteira` aparecia no sitemap e páginas podiam herdar canonical da home. | SEO não indexa conteúdo privado nem consolida rotas distintas na raiz. |
| Risk Lab permanece read-only no Premium. | Possível uso automático para notificações, compra ou venda. | `notificationsAllowed=false` e `externalEffectsAllowed=false`. |

---

## 1. Estado atual do projeto

### Resumo executivo

- Fases 1 e 2 permanecem formalmente concluídas com evidências históricas preservadas.
- Risk Lab 3.0–3.6 possui implementação e evidência metodológica no Git.
- A integração 3.7 foi corrigida e novamente aprovada após auditoria independente, CI integral e smoke autenticado em produção.
- O SHA `607dafefefaba5c88f986236eb365440c6fb8c94` foi observado em produção antes das correções.
- As correções DEF-01 a DEF-20 foram mescladas pela PR `#141`; as regressões DEF-21/22 eliminaram o acionamento manual do smoke e a perda de OIDC por redirect nas PRs `#142` e `#143`.
- A PR `#141` foi mesclada no commit `f29a0287d52e2245a66184efd099192d27548c0d`.
- No primeiro CI da PR, Risk Lab `#319` e Portfolio Notifications `#552` passaram. O gate central `#354` aprovou todos os passos até o E2E, que revelou Login oculto fora de `localhost`, contraste insuficiente e regiões roláveis sem foco.
- O CI atuou como gate real: runs intermediários detectaram um locator ambíguo e quatro contrastes WCAG adicionais; nenhum achado foi ignorado ou convertido em exceção.
- No commit `c6af2a0…`, Portfolio Notifications `#556`, Risk Lab `#323` e Phase 2 Closure `#358` passaram; o gate central encerrou com E2E 12/12 em desktop e mobile.
- O release corretivo final de runtime `0e029f78560d11d12720c447f2f9058c482e4277` foi publicado no Vercel e aprovado pelos contextos `Vercel`, `Risk Lab Premium Production Gate` e `Production Premium Smoke`.
- O smoke OIDC reconstruiu um snapshot de 642 fundos, gerou o Premium v2.0.0 para TGAR11, confirmou impacto da carteira, persistiu e releu o evento `premium-read` `pKWEwtSiIbdatbauietl`.
- A evidência `8a9709056d046a8f2f73d4e20e7cdcb77c861706b592c24a6333fdf566ee983b` confirma read-only, notificações desativadas, efeitos externos desativados e ausência de blocker.
- O browser E2E está versionado para desktop e mobile. A execução local ficou bloqueada pelo CDN do browser no sandbox; o runner do GitHub comprovou as correções Chromium.
- Em 27/07/2026, a execução local aprovou 529 testes sem falha, skip ou pendência; Firestore Emulator, mutation sanity, build de 38 páginas e smoke HTTP 200/400/401/403/404/405/503 também passaram.
- A cobertura crítica medida foi 100% de linhas, 93,66% de branches e 98,53% de funções; `npm audit --omit=dev --audit-level=high` retornou zero vulnerabilidades.
- O endpoint interno de dividendos passou a exigir schema estrito, `Idempotency-Key`, lock distribuído e auditoria com ator pseudônimo, origem, correlation ID, quantidade e versão da regra.
- Limites administrativos são distribuídos no Firestore e falham fechado; respostas 5xx não expõem mensagens internas.

### Matriz de estado

| Área | Git corretivo | Teste local | Produção corretiva | Estado |
|---|---:|---:|---:|---|
| R0 — contenção | Sim | Sim | Sim | Formalmente concluída |
| R1 — dados/fórmulas | Sim | Sim | Sim | Formalmente concluída |
| R2 — CI/segurança | Sim | Sim; E2E CI 12/12 | Sim | Formalmente concluída |
| R3 — Premium/evidência | Sim | Sim | Sim | Smoke OIDC e auditoria aprovados |
| R4 — Risk Lab/FNET | Sim, fail-closed por categoria | Sim | Sim | Formalmente concluída |
| R5 — arquitetura/observabilidade/performance/UX | Sim | Sim; axe desktop/mobile aprovado | Sim | Formalmente concluída |
| Fase 3 completa | Sim | Sim | Sim | Formalmente concluída |
| SEO-S1 | Correções essenciais incluídas | Local/CI | Parcial | Sprint atual |
| Fase 4.1 — Radar | Não | Não | Não | Planejada |

### Defeitos cobertos

As PRs corretivas cobrem os vinte defeitos da auditoria e as duas regressões descobertas no fechamento:

- DEF-01/13/17: contrato público de evidência, smoke Premium real e documentação reconciliada;
- DEF-02: ticker inválido não vira listagem;
- DEF-03/04/05: qualidade, DY e invalidação de derivados;
- DEF-06/07/08/09/20: autorização, privilégio, admin, Firestore e headers;
- DEF-10/11/12: dependências, lint, cobertura, Emulator, HTTP, E2E e CI;
- DEF-14: política por categoria e automação FNET;
- DEF-15: Route Handlers sem acesso direto à persistência;
- DEF-16: logs sanitizados e correlation ID;
- DEF-18: snapshot materializado de pares;
- DEF-19: semântica, responsabilidade técnica, mobile e acessibilidade.

---

## 2. Fases concluídas

### Fase 1 — Regulatory Engine

**Estado:** formalmente concluída, sem reabertura identificada nesta rodada.

Inclui parser regulatório, FII/FIAGRO/FI-Infra, normalização, reconciliação, QA, versionamento, publicação protegida, backup, rollback e auditoria.

### Fase 2 — Core Intelligence & Product Foundation

**Estado:** formalmente concluída quanto à entrega histórica; componentes transversais afetados pelos defeitos foram endurecidos no branch corretivo.

Inclui `RegulatoryDataService`, repositórios, cache, Score, Health, Validation, Admin, Timeline, relatórios, AI Insights, monitor, catálogo, carteira e jobs.

### Fase 3 — Risk Lab

**Estado da fase completa:** formalmente concluída.

- 3.0–3.4: evidências históricas preservadas.
- 3.5: dataset congelado e backtest metodológico preservados.
- 3.6: ruleset `0.2.0` e calibração preservados.
- 3.7: integração read-only, geração Premium real, snapshot de pares e auditoria persistida aprovados no smoke OIDC do release `0e029f…`.

A evidência `docs/production-evidence/risk-lab/phase-3-final-closure.json` continua íntegra como registro histórico do release `a3b4f2c…`; a aprovação corretiva posterior está nos runs `30236078462` e `30236078473`, no artifact `8641670026` e na evidência persistida de hash `8a970905…`.

---

## 3. Sprint atual

**Nome:** SEO-S1 — fundação técnica e páginas prioritárias.

### Encerramento corretivo comprovado

1. PRs corretivas mescladas sem bypass;
2. instalação limpa, audit, secret scan, lint e typecheck aprovados;
3. testes completos, Firestore Emulator e cobertura crítica aprovados;
4. build, smoke HTTP e E2E desktop/mobile aprovados;
5. SHA de produção identificado;
6. smoke Premium OIDC aprovado;
7. audit receipt persistido e relido;
8. Handoff reconciliado.

### Critério de encerramento

COR-CLOSE está concluída. SEO-S1 só termina com baseline, indexação técnica, validação do host canônico e evidências de produção próprias.

---

## 4. Ordem oficial das próximas sprints

1. **SEO-S1 — baseline e indexação técnica completa**, preservando as correções de canonical/sitemap.
2. **Fase 4.1 — Radar/Acompanhar fundo fora da carteira.**
3. **Fase 4.2 — inteligência documental e “o que mudou”.**
4. **Fase 4.3 — carteira histórica verdadeira, retorno total e atribuição.**
5. **Fase 4.4 — screener, comparador e filtros salvos.**
6. **Fase 4.5 — fair value e sustentabilidade de dividendos por categoria.**

Cobrança, WhatsApp, Telegram e recomendações individualizadas não antecipam nem substituem os gates corretivos.

---

## 5. Escopo e critérios de aceite de cada sprint

### R0 — Contenção de segurança e integridade

Escopo: bloquear mutação anônima, ignorar privilégio do cliente, corrigir validação financeira e remover dependências vulneráveis/legadas.

Aceite: zero vulnerabilidade crítica/alta de produção; mutação anônima 401/403; plano/e-mail no servidor; nenhum dado inválido publicado como válido.

### R1 — Dados e fórmulas canônicas

Escopo: contrato de qualidade, CNPJ, escala, unidades, datas, freshness, DY, P/VP, ágio/desconto e cache.

Aceite: 100% de linhas dos módulos financeiros críticos; branches acima de 90%; regressões BODB11, RJDA11, TGAR11, VGIA11, MXRF11 e dados ausentes.

### R2 — Qualidade e segurança operacional

Escopo: ESLint, CI integral, Firestore Rules, Emulator, contratos HTTP, detecção de segredos, build e E2E.

Aceite: instalação limpa Node 22; audit, lint, typecheck, suíte, Emulator, cobertura, build, smoke HTTP e E2E verdes, sem skip crítico.

### R3 — Evidência e produção Premium

Escopo: contrato do endpoint Risk Lab, snapshot Premium, audit receipt, OIDC, smoke real e evidência imutável vinculada ao SHA.

Aceite: geração Premium autenticada, plano no servidor, `premium-read` relido, read-only comprovado, sem notificação/mutação e SHA igual ao Vercel.

### R4 — Generalização Risk Lab

Escopo: política por categoria, estado explícito sem calibração, FNET automático, idempotência, quarentena e ausência de aprovação técnica manual.

Aceite: nenhum hardcode por ticker no runtime; casos de papel, desenvolvimento, tijolo, FIAGRO, FI-Infra, FoF e híbrido classificados ou recusados explicitamente; alerta apenas em categoria homologada.

### R5 — Consolidação técnica

Escopo: handlers finos, limites de camada, ciclo de dependências, SafeLogger, snapshot de pares, canonical, sitemap, `h1`, headers, teclado/mobile/axe.

Aceite: nenhum `route.ts` importa Firestore; nenhum ciclo interno; repository sem UI; custo Premium constante; um `h1`; carteira `noindex`; headers globais.

### COR-CLOSE

Escopo: publicar e reauditar as Sprints R0–R5.

Aceite: PR sem thread bloqueadora, checks verdes, deployment do SHA, smoke OIDC verde, endpoints coerentes e Handoff atualizado com IDs reais.

### SEO-S1

Escopo: host canônico, Search Console, sitemap de fundos ativos, robots, metadados, dados estruturados e baseline.

Aceite: nenhuma rota privada indexada; canonical por rota; métricas registradas; erros de cobertura tratados.

### Fase 4.1 — Radar

Escopo: acompanhar fundo fora da carteira, timeline, relatório pré-compra e mudança material.

Aceite: Grátis acompanha até 1 fundo; Premium até 10; limite e plano no servidor; ausência de mudança não notifica; deduplicação e opt-out.

---

## 6. Regras arquiteturais obrigatórias

1. Fluxo: Route Handler → autenticação/schema HTTP → controller/application service → engine/`RegulatoryDataService` → repository → Firestore/provedor.
2. Route Handler não importa `firebaseAdmin`, `adminDb` nem chama `.collection()`.
3. Componente React não contém regra financeira nem depende de server/repository.
4. Repository não importa React, componente, `NextResponse` ou regra de apresentação.
5. Não há dependência circular.
6. Normalização, unidade, data-base e proveniência ficam na camada regulatória.
7. Ausência permanece `null`/estado explícito; zero válido é preservado.
8. Falha externa é explícita; fallback não pode simular dado atual.
9. Admin humano usa sessão Firebase HttpOnly/SameSite; cron usa Bearer; workflow usa OIDC.
10. OIDC verifica issuer, audience, repositório, workflow, branch e SHA publicado.
11. Risk Lab é read-only no Premium e não produz efeitos externos.
12. Correção estrutural substitui exceção por ticker.
13. Logs passam por sanitização, não contêm e-mail, OTP, token, cookie ou segredo e carregam correlation ID.
14. Snapshot materializado tem schema, hash, freshness e limite de tamanho; vencido falha fechado.
15. CI é gate de merge/deploy, não fila, cron de aplicação ou mecanismo de polling.

---

## 7. Arquivos, branches, commits e PRs existentes

### Referências de estado

- Repositório: `IsraelJr/dados-fii`.
- `main` auditado antes das correções: `607dafefefaba5c88f986236eb365440c6fb8c94`.
- Release histórico da Fase 3: `a3b4f2c010fba3e62e52ed50b8fcacf2706474d2`.
- Branch corretiva: `agent/corrective-sprints-r0-r5`.
- Commit local consolidado das Sprints R0–R5: `d07e65b`.
- Commit remoto equivalente, com a mesma árvore Git: `434eda8ebffe603bbc6e0a63a5c95beb4e72441e`.
- Follow-up remoto de Login e acessibilidade: `fd0e0280ec4d8f4550be6227b98fd7854d218f23`.
- Follow-up de precisão do E2E: `0447ee33072712462704c315df4c087c918f85b3`.
- Commit corretivo de contraste aprovado no CI: `c6af2a045da64c99b777f18ce4ea2536216d4dc9`.
- PR corretiva mesclada: [#141 — fix: executar Sprints Corretivas R0–R5](https://github.com/IsraelJr/dados-fii/pull/141); merge `f29a0287d52e2245a66184efd099192d27548c0d`.
- PR de automação pós-deploy mesclada: [#142 — fix: automatizar smoke Premium pós-deploy](https://github.com/IsraelJr/dados-fii/pull/142); merge `a19e8b9ed077a2459d8356e6e6b2a5464cd523d4`.
- PR de correção OIDC mesclada: [#143 — fix: preservar OIDC no smoke Premium](https://github.com/IsraelJr/dados-fii/pull/143); merge `0e029f78560d11d12720c447f2f9058c482e4277`.
- CI inicial: Portfolio Notifications run `30233676618` aprovado; Risk Lab run `30233676617` aprovado; Phase 2 Closure run `30233676643` reprovado exclusivamente no E2E.
- CI aprovado no código final: Portfolio Notifications run `30234489574`; Risk Lab run `30234489557`; Phase 2 Closure run `30234489569`.
- CI da automação pós-deploy: Phase 2 Closure run `30235627100` aprovado.
- CI da correção OIDC: Phase 2 Closure run `30235898675` aprovado.
- Gate read-only em produção: run `30236078462` aprovado.
- Smoke Premium real em produção: run `30236078473`, artifact `8641670026`, audit event `pKWEwtSiIbdatbauietl`, evidência `8a9709056d046a8f2f73d4e20e7cdcb77c861706b592c24a6333fdf566ee983b`.

### Arquivos corretivos centrais

- `firestore.rules`, `firestore.indexes.json`, `firebase.json`;
- `eslint.config.mjs`, `playwright.config.ts`;
- `.github/workflows/phase-2-closure.yml`;
- `.github/workflows/production-premium-smoke.yml`;
- `src/lib/regulatory/RegulatoryValidator.ts`;
- `src/lib/fiiDerivedData.ts`;
- `src/lib/security/InternalRequestAuth.ts`;
- `src/lib/security/GithubActionsOidc.ts`;
- `src/lib/observability/SafeLogger.ts`;
- `src/lib/risk-lab/PublicRiskLabEvidenceContract.ts`;
- `src/lib/risk-lab/RiskLabCategoryPolicy.ts`;
- `src/lib/reports/PremiumPeerSnapshot.ts`;
- `src/app/api/internal/production-premium-smoke/route.ts`;
- `scripts/run-http-smoke.mjs`;
- `scripts/scan-secrets.mjs`;
- `tests/corrective-*.test.ts`, `tests/corrective-*.test.mjs`;
- `tests/firestore-rules.test.ts`;
- `tests/e2e/critical-journeys.spec.ts`.

### Arquivos removidos

- `monitor.js`: script legado com contrato inseguro;
- `src/app/_document.tsx`: convenção inválida para App Router;
- `DADOS_FII_HANDOFF_SPRINT_3_5_CONTINUACAO.md`: fonte canônica duplicada.

---

## 8. Funcionalidades concluídas, parciais e pendentes

### Concluídas historicamente

- consulta e catálogo de FII/FIAGRO/FI-Infra;
- carteira atual e snapshots;
- relatórios Free, AI Insights e Premium base;
- dados regulatórios, score, health, validation, timeline e observabilidade;
- Risk Lab 3.0–3.6 metodológico;
- integração Premium read-only implementada.

### Concluídas e comprovadas em produção

- contrato financeiro e qualidade fail-closed;
- autorização de alertas, dividendos, Admin, cron e OIDC;
- regras Firestore deny-all para cliente;
- evidência pública Risk Lab com status HTTP correto;
- smoke Premium real com recibo e releitura;
- snapshot de pares;
- FNET automático e política por categoria;
- SafeLogger/correlation ID;
- CI completo, HTTP smoke e E2E;
- canonical, sitemap, headers, um `h1` e responsabilidade técnica.

### Parciais

- Risk Lab: apenas domínios com evidência suficiente podem alertar; demais retornam `insufficient_data`.
- SEO-S1: correções essenciais estão em produção, mas faltam baseline e validação de indexação.
- observabilidade: estrutura sanitizada existe; métricas externas/alertas operacionais dependem do ambiente.

### Pendentes de produto

- Radar/Acompanhar fundo fora da carteira para decidir comprar ou não;
- carteira histórica verdadeira e atribuição de retorno;
- inteligência documental oficial e resumo “o que mudou”;
- screener, comparador, filtros salvos e ranking explicável;
- fair value e sustentabilidade de dividendos por categoria;
- calendário anúncio → data-com → pagamento com posição histórica;
- benchmark/retorno total e simuladores.

Esses itens trazem ganhos competitivos, mas não substituem segurança, integridade de dados nem prova de produção.

---

## 9. Decisões de segurança

- `FIREBASE_SERVICE_ACCOUNT_KEY`, `CRON_SECRET`, `RESEND_API_KEY` e `OPENAI_API_KEY` são secretos e server-only.
- Variável `NEXT_PUBLIC_*` nunca concede plano, admin ou privilégio.
- Plano comercial vem do perfil persistido no servidor.
- Admin é allowlist server-side + e-mail verificado + cookie de sessão HttpOnly/Secure/SameSite.
- Cron aceita somente `Authorization: Bearer <CRON_SECRET>`.
- Workflows operacionais usam OIDC efêmero quando precisam chamar produção.
- Segredo em URL, query, body ou header legado não autentica.
- Firestore cliente é deny-all; acesso ocorre pelo backend autorizado.
- Mutações possuem limite, idempotência, transação/lock e auditoria conforme o domínio.
- OTP nunca é logado; ausência do provedor de e-mail falha fechado.
- Logs são sanitizados e IDs sensíveis são pseudonimizados.
- CSP, HSTS, frame denial, nosniff, referrer, permissions e COOP são globais.
- Evidência publicada não contém credencial, token, e-mail ou payload de usuário real.
- Produção nunca é usada para teste destrutivo.

---

## 10. Variáveis de ambiente

### Públicas e não autorizativas

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_ADSENSE_CLIENT`, `NEXT_PUBLIC_ADSENSE_SLOT`, `NEXT_PUBLIC_ADS_OPEN`
- `NEXT_PUBLIC_BASIC_SALARY`, `NEXT_PUBLIC_DEFAULT_ALERT_VALUE`

### Secretas/server-only

- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `CRON_SECRET`
- `ADMIN_EMAILS`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `BRAPI_TOKEN`
- `BRAPI_API_TOKEN` (alias legado controlado)
- `GOOGLE_SHEETS_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_KEY`
- `SHEET_ID`, `FEEDBACK_SHEET_ID`, `FEEDBACK_SHEET_NAME`
- `WALLET_EMAIL_FROM`
- `MONITOR_ALERT_EMAILS`, `MONITOR_EMAIL_FROM`
- `PREMIUM_PREVIEW_EMAILS`

### Configuração operacional

- `OPENAI_MODEL`
- `OPENAI_INSIGHTS_MODEL`, `OPENAI_RISK_REPORT_MODEL`, `OPENAI_SEARCH_MODEL`
- `OPENAI_TIMEOUT_MS`
- `OPENAI_INSIGHTS_MAX_OUTPUT_TOKENS`
- `OPENAI_PREMIUM_MAX_OUTPUT_TOKENS`
- `OPENAI_RISK_REPORT_MAX_OUTPUT_TOKENS`
- `OPENAI_PROMPT_ABOUT_FII`
- `AI_INSIGHTS_CACHE_MAX_ENTRIES`, `AI_INSIGHTS_CACHE_TTL_MS`
- `AI_INSIGHTS_RATE_MAX_REQUESTS`, `AI_INSIGHTS_RATE_WINDOW_MS`
- `REGULATORY_CACHE_MAX_ENTRIES`, `REGULATORY_CACHE_TTL_MS`, `REGULATORY_MARKET_CACHE_TTL_MS`
- `MONITOR_ALERT_COOLDOWN_MS`
- `PORTFOLIO_NOTIFICATION_USER_LIMIT`
- `ENABLE_RISK_LAB_AUTOMATIC_DISCOVERY`
- `ENABLE_RISK_LAB_FNET_IMPORT`
- `ENABLE_RISK_LAB_STRESS_RUN`
- `ENABLE_RISK_LAB_PREMIUM_READONLY`
- `ENABLE_SYSTEM_VALIDATION`, `ENABLE_HEALTH_MONITOR`
- `ENABLE_AI_INSIGHTS`, `ENABLE_REPORT_PREMIUM`
- `ENABLE_AUTOMATIC_MONITOR`, `ENABLE_SCORE_ENGINE`, `ENABLE_RISK_LAB_ADMIN`
- `SITE_URL`, `VERCEL_URL`, `VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_PROJECT_PRODUCTION_URL`, `NODE_ENV`, `CI`

Valores nunca são registrados no Handoff, log ou evidência.

---

## 11. Testes obrigatórios

### Gate de PR

1. `npm ci`
2. `npm run audit:production`
3. `npm run security:secrets`
4. `npm run lint`
5. `npm run typecheck`
6. `npm run test:workflow-governance`
7. `npm run test:handoff`
8. `npm run test:all`
9. `npm run test:rules`
10. `npm run test:coverage:critical`
11. `npm run test:mutation`
12. `npm run build`
13. `npm run test:http`
14. `npm run test:e2e`

### Última evidência local reproduzível — 27/07/2026

- instalação limpa do lockfile: aprovada;
- audit de produção: zero vulnerabilidades;
- secret scan: aprovado em 577 arquivos versionados;
- lint e TypeScript: aprovados, sem warning ou erro;
- suíte completa: 529 aprovados, zero falhos, zero ignorados, zero pendentes;
- Firestore Emulator: regras deny-all aprovadas para usuário anônimo e autenticado;
- cobertura crítica: linhas 100%, branches 93,66%, funções 98,53%;
- mutation sanity: mutação central detectada, restauração byte a byte e reexecução aprovadas;
- build Next.js 16.2.12: aprovado, 38 páginas geradas;
- HTTP real local: 200, 400, 401, 403, 404, 405 e 503 aprovados;
- E2E Chromium inicial no CI: 8 cenários aprovados e 4 combinações projeto/jornada reprovadas; o runner comprovou Login oculto fora de `localhost`, contraste de 2,51:1 nos anos sem dados e duas regiões de gráfico roláveis sem foco.
- Regressão aplicada: Login deixou de depender do hostname; controles sem dados usam contraste AA; regiões roláveis receberam nome, foco por teclado e indicador visual.
- E2E intermediário: locator de alerta passou a ser escopado ao diálogo sem reduzir a asserção semântica; axe revelou e bloqueou contrastes de 2,6:1, 2,93:1 e 3,76:1.
- E2E Chromium definitivo no run `30234489569`: 12/12 aprovados em desktop e mobile, incluindo axe sem violação séria/crítica.
- CI pós-merge da automação do smoke: run `30235627100` aprovado.
- CI da correção do host canônico/OIDC: run `30235898675` aprovado.
- Produção `0e029f…`: Vercel, Risk Lab Premium Production Gate `30236078462` e Production Premium Smoke `30236078473` aprovados.
- Smoke Premium: snapshot de 642 fundos, relatório v2.0.0 para TGAR11, impacto da carteira disponível, audit event `pKWEwtSiIbdatbauietl` relido e quatro checks aprovados.

### Regressões obrigatórias

- REG-DEF-01 a REG-DEF-22;
- ticker `ABC`, duplicidade e paginação inválida;
- BODB11/RJDA11 incompletos;
- DY legado divergente e ausência de cotação;
- P/VP, ágio/desconto, escala pt-BR e data impossível;
- anônimo sem mutação e payload malformado sem autenticação;
- plano/e-mail do body ignorados;
- segredo legado rejeitado;
- regras Firestore no Emulator;
- endpoint Risk Lab 404/409/202/422/200;
- Premium 401/403/404/429/erro tratado/sucesso auditado;
- TGAR11, VGIA11, MXRF11, KNCA11, BODB11 e categorias diversas;
- nenhum `route.ts` com Firestore;
- nenhum ciclo;
- SafeLogger sem e-mail, OTP, JWT ou Bearer;
- um `h1`, teclado, desktop/mobile e axe sem violação séria/crítica;
- build sem fallback silencioso de sitemap.
- smoke pós-deploy automático somente no status Vercel `success` do `main`;
- POST OIDC no host canônico `www`, sem redirect de credencial, e artefato vinculado ao release.

### Gate pós-deploy

- SHA Git = SHA Vercel = SHA do token OIDC;
- geração Premium real com conta sintética controlada;
- audit receipt persistido e relido;
- snapshot de pares atual;
- read-only e ausência de efeitos externos;
- evidência de smoke imutável;
- endpoint público coerente com ruleset/release;
- smoke público de UI/APIs, cache e headers.

---

## 12. Pendências e decisões ainda abertas

### Bloqueadoras para concluir as correções

Nenhuma. As PRs foram mescladas sem bypass, o release foi publicado e os gates pós-deploy foram aprovados com evidência reproduzível.

### Decisões de produto abertas

- cobrança recorrente, anual ou compra avulsa;
- PSP, emissão fiscal, cancelamento, reembolso e inadimplência;
- WhatsApp: custo, opt-in, template, frequência e proteção de dados;
- Telegram permanece adiado;
- limites finais de relatórios Premium e IA;
- composição exata de planos além do Radar 1/10;
- quais categorias Risk Lab receberão próxima calibração;
- política jurídica final de alertas e linguagem informativa;
- estratégia de Search Console para o host canônico `www`;
- retenção e exclusão de dados de carteira/alertas.

### Regra de conclusão

As Sprints Corretivas R0–R5 estão formalmente concluídas. Releases futuros continuam obrigados aos mesmos gates automatizados: CI, deployment, smoke OIDC, auditoria persistida e commit statuses. Nenhuma validação manual do usuário substitui essa obrigação.
