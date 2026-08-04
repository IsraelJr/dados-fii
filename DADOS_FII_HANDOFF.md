Este documento substitui todos os planejamentos anteriores quando houver divergência.

# Dados FII — Documento Canônico de Handoff

**Versão:** 10.6.0  
**Data:** 04/08/2026  
**Repositório:** `IsraelJr/dados-fii`  
**Branch principal:** `main`  
**PR de encerramento desta versão:** `#182`  
**SHA funcional da PV-3.5 antes da atualização documental:** `6a57d3dbcdc58ba0f7a2a19705d461ffe689a294`  
**CI funcional:** `Phase 2 Closure CI` — run `30954725742` — sucesso  
**Fase vigente:** `Produto Validável`  
**Sprint atual após o merge deste documento:** `PV-4 — Relatório incremental: mudanças desde a última análise`

## Decisões vigentes que substituem decisões anteriores

| Decisão vigente | Decisão substituída | Efeito |
|---|---|---|
| PV-1, PV-2A, PV-2B, PV-2C, PV-3 e PV-3.5 ficam formalmente concluídas com o merge da PR `#182`. | O Handoff v10.5.0 tratava PV-3.5 como sprint atual. | O produto passa a ter descoberta Premium validável e aquisição orgânica com conteúdo segmentado. |
| PV-4 é a próxima sprint oficial. | A prioridade funcional anterior era SEO editorial. | O foco passa a ser mostrar somente mudanças materiais desde a última análise da carteira. |
| O hub `/mercado` e sete páginas segmentadas são a superfície editorial oficial desta fase. | SEO editorial ainda não possuía rotas próprias. | Mercado de FIIs, FIAGRO, logística, shoppings, escritórios, recebíveis e renda urbana têm conteúdo específico, data-base e fontes. |
| Página editorial desconhecida ou sem qualidade mínima não é publicada nem indexada. | Uma rota dinâmica poderia gerar conteúdo raso por fallback. | O registro editorial é allowlistado e slug desconhecido retorna 404 real. |
| Telemetria editorial é anônima, mínima e retida por 90 dias. | Eventos editoriais poderiam reutilizar identidade ou dados financeiros. | Nenhum evento contém e-mail, `ownerId`, carteira, posição, ticker, dividendo, patrimônio, token ou cookie. |
| Google AdSense continua congelado. | SEO poderia ser confundido com antecipação de anúncios. | O objetivo é tráfego qualificado e utilidade; publicidade não integra esta entrega. |
| Cobrança continua adiada até a PV-6, e checkout permanece na PV-7. | Monetização poderia ser antecipada sem evidência comercial. | Interesse, beta e uso continuam separados de pagamento e entitlement comercial. |
| O Handoff v10.6.0 é a única fonte canônica ativa. | Handoffs v10.5.0 e anteriores. | Este documento prevalece em caso de divergência. |

## 1. Estado atual do projeto

- Fases 1, 2 e 3 permanecem formalmente concluídas.
- A fase vigente continua sendo **Produto Validável**.
- PV-1 está concluída funcionalmente, com histórico manual de dividendos, persistência, reconciliação e atualização reativa da carteira.
- PR `#166` consolidou gráfico e resumo sobre `consolidatedSnapshots`.
- PR `#167` restaurou o layout original dos seis cards sem reintroduzir fontes paralelas.
- PR `#177` integrou a PV-2A, com métricas, qualidade, sinais e evidências determinísticas.
- PR `#178` integrou a PV-2B, com apresentação acessível dos sinais da carteira.
- PR `#180` encerrou a PV-2C, com explicação opcional por IA, validação de saída e fallback determinístico.
- PR `#181` encerrou a PV-3, com proposta “Premium em validação”, lista de interesse, beta server-side e telemetria pseudonimizada.
- PR `#182` encerra a PV-3.5, com hub público, sete cenários segmentados, fontes oficiais, SEO técnico e telemetria editorial privada.
- O SHA funcional `6a57d3dbcdc58ba0f7a2a19705d461ffe689a294` passou governança, Handoff vigente, auditoria, secret scan, lint, TypeScript, suíte completa, Firestore, cobertura crítica, mutation, build, smoke HTTP e E2E desktop/mobile no run `30954725742`.
- PR `#170` continua fechada sem merge, substituída pela implementação limpa da PR `#178`.
- PR `#168` permanece bloqueada e não deve ser mergeada enquanto houver risco de reintrodução de segredos ou alterações privilegiadas fora do escopo.
- A próxima entrega funcional é a PV-4, sem recalcular fatos por IA e sem repetir alertas quando nada mudou.
- Não há evidência de deploy em produção da PV-3.5 neste documento; merge e CI não substituem verificação posterior do ambiente produtivo.

### Matriz atual

| Área | Estado |
|---|---|
| Regulatory Engine | Concluído |
| Core Intelligence & Product Foundation | Concluído |
| Risk Lab read-only | Concluído |
| Histórico manual do ano corrente | Concluído |
| Sincronização gráfico/cards | Concluída |
| PV-2A — núcleo determinístico | Concluída |
| PV-2B — apresentação dos sinais | Concluída |
| PV-2C — explicação por IA | Concluída |
| PV-3 — descoberta Premium/beta | Concluída |
| PV-3.5 — SEO e Conteúdo de Mercado | Concluída com o merge da PR `#182` |
| PV-4 — relatório incremental | Sprint atual após o merge |
| PV-5 — acompanhar fundos | Planejada |
| Checkout/cobrança | Não iniciado |
| AdSense | Congelado |

## 2. Fases concluídas

### Fase 1 — Regulatory Engine

**Estado:** concluída. Inclui parser regulatório, normalização, reconciliação, QA, publicação, rollback, auditoria e suporte FII/FIAGRO.

### Fase 2 — Core Intelligence & Product Foundation

**Estado:** concluída quanto à fundação. Inclui `RegulatoryDataService`, repositórios, cache, score, Health, Validation, Admin, relatórios, AI Insights, monitor, catálogo, carteira e jobs.

### Fase 3 — Risk Lab

**Estado:** concluída. Inclui dataset, backtest, ruleset `0.2.0`, Premium read-only, bloqueio de efeitos externos, smoke OIDC e auditoria persistida.

### PV-1 — Jornada principal da carteira e histórico manual

**Estado:** concluída. Inclui cadastro manual de dividendos de meses encerrados, inclusão, sobrescrita, exclusão, persistência, reconciliação, atualização imediata de gráficos e cards e testes desktop/mobile.

### PV-2A — Inteligência da Carteira: núcleo determinístico

**Estado:** concluída pela PR `#177`. Inclui contrato versionado, métricas, qualidade dos dados, sinais estruturados, evidências e tratamento separado de ausência, zero e entrada inválida.

### PV-2B — Apresentação dos sinais

**Estado:** concluída pela PR `#178`. Inclui painel integrado, linguagem simples, sinais prioritários, expansão acessível e estados explícitos.

### PV-2C — IA explicativa sobre sinais prontos

**Estado:** concluída pela PR `#180`. A explicação por IA ocorre apenas após ação explícita do usuário. A IA nunca é fonte de verdade para cálculo financeiro. Resposta incompatível, com número novo ou recomendação falha fechado e usa fallback determinístico.

### PV-3 — Descoberta Premium, beta controlado e telemetria de interesse

**Estado:** concluída pela PR `#181`. Inclui proposta honesta, lista de interesse, allowlist server-side, feature flag e telemetria pseudonimizada. Solicitar beta não concede entitlement.

### PV-3.5 — SEO e Conteúdo de Mercado

**Estado:** concluída com o merge da PR `#182`.

Inclui:

- hub público sobre o mercado de fundos imobiliários em `/mercado`;
- páginas específicas para mercado de FIIs, FIAGRO/agro, galpões/logística, shoppings, escritórios/lajes, recebíveis/papel e renda urbana;
- registro editorial tipado e allowlistado;
- data-base, política de revisão, fontes oficiais e limitações em cada página;
- indicadores macro/setoriais tratados como contexto, nunca como recomendação;
- canonical, Open Graph, `Article`, `CollectionPage`, `ItemList` e `BreadcrumbList`;
- sitemap com somente páginas registradas como indexáveis;
- 404 real para slug desconhecido;
- navegação pública com acesso ao hub;
- telemetria editorial sem identidade ou valores financeiros, com retenção de 90 dias;
- testes de conteúdo, arquitetura, privacidade, sitemap, acessibilidade e E2E desktop/mobile.

## 3. Sprint atual

### PV-4 — Relatório incremental: mudanças desde a última análise

**Objetivo:** informar o que realmente mudou na carteira desde a análise anterior, reduzindo repetição e destacando somente alterações materiais e rastreáveis.

### Escopo

- persistir uma referência versionada da última análise válida;
- comparar análise atual e anterior por sinais, métricas, qualidade e proveniência;
- separar mudança de dado, mudança de regra, mudança de cobertura e mudança de qualidade;
- classificar alterações como nova, agravada, reduzida, resolvida ou inalterada;
- destacar apenas mudanças materiais conforme política determinística;
- não repetir alertas sem alteração real;
- permitir leitura resumida e expansão das evidências;
- manter a IA apenas como explicadora opcional das mudanças já determinadas;
- registrar versão da política, datas-base e fingerprints das duas análises;
- preservar privacidade e não enviar carteira bruta ao provedor de IA;
- manter rollback e compatibilidade com análises antigas ou ausentes.

### Critérios de aceite

- primeira análise informa honestamente que não existe base anterior;
- comparação usa somente snapshots/análises válidos e pertencentes ao mesmo usuário;
- mudança financeira é decidida por domínio determinístico, nunca por IA;
- alertas inalterados não reaparecem como novidade;
- alterações de regra ou qualidade não são apresentadas como mudança do fundo;
- evidências permitem reproduzir o antes e o depois;
- ausência não vira zero e dados inválidos falham fechado;
- desktop e mobile passam acessibilidade e E2E;
- todos os gates da CI ficam verdes no mesmo SHA;
- produção somente é considerada concluída com evidência separada do ambiente produtivo.

## 4. Ordem oficial das próximas sprints

1. **PV-4 — Relatório incremental: mudanças desde a última análise.**
2. **PV-5 — Radar/Acompanhar fundo fora da carteira: 1 grátis e 10 Premium.**
3. **PV-6 — Validação de preço e cobrança.**
4. **PV-7 — Checkout, recorrência, cancelamento e entitlement comercial.**
5. **PV-8 — Carteira histórica avançada, retorno total e atribuição.**
6. **PV-9 — Screener, comparador, filtros salvos e fair value por categoria.**

AdSense, WhatsApp, Telegram e grandes mudanças visuais continuam adiados.

## 5. Escopo e critérios de aceite de cada sprint

### PV-4 — Relatório incremental

Aceite conforme a seção 3. Deve comparar estados versionados, destacar somente mudanças materiais, preservar evidência e não usar IA para decidir se uma mudança financeira ocorreu.

### PV-5 — Acompanhar fundo fora da carteira

- permitir acompanhar fundo sem transformá-lo em posição;
- limite inicial: 1 fundo no Grátis e até 10 no Premium;
- deduplicar notícias, fatos relevantes, dividendos e sinais;
- permitir iniciar e encerrar acompanhamento;
- não apresentar alertas como recomendação de compra;
- explicar segmento, riscos, renda, eventos e qualidade dos dados.

### PV-6 — Validação de preço e cobrança

- testar preço, periodicidade e disposição a pagar;
- comparar recorrência, créditos e pagamento avulso;
- definir evidência mínima com usuários externos;
- registrar decisão comercial antes de qualquer checkout.

### PV-7 — Checkout e assinaturas

- implementar somente após decisão comercial registrada;
- incluir recorrência, cancelamento, reembolso e comunicação transparente;
- webhooks autenticados e idempotentes;
- entitlement exclusivamente server-side;
- falha de cobrança não apaga carteira ou histórico.

### PV-8 — Histórico avançado, retorno e atribuição

- separar retorno total, dividendos, valorização, aportes e atribuição;
- versionar competência, caixa e custo médio;
- reconciliar e migrar sem perda de histórico;
- explicitar período, benchmark e cobertura.

### PV-9 — Screener e comparador

- screener, comparador e filtros salvos;
- fair value por categoria, nunca fórmula única para todos os segmentos;
- dados insuficientes permanecem explícitos;
- ranking não esconde qualidade, liquidez ou limitações da fonte.

Cada sprint exige escopo fechado, testes automatizados, Preview, produção e evidência antes de ser marcada como concluída.

## 6. Regras arquiteturais obrigatórias

1. Route Handler → autenticação/schema → controller/application service → domínio → repository → Firestore/provedor.
2. Nenhum `route.ts` importa Firestore diretamente.
3. Componente React não contém regra financeira, entitlement ou persistência de domínio.
4. Métricas, sinais e diferenças da carteira ficam em módulos puros e testáveis.
5. IA nunca é fonte de verdade para cálculo financeiro.
6. A camada de IA recebe somente sinais, diferenças e evidências sanitizados.
7. Título, severidade, confiança, código e evidência não podem ser substituídos pela IA.
8. Saída incompatível, com número novo ou recomendação falha fechado e usa fallback determinístico.
9. Gráfico e cards equivalentes usam a mesma série consolidada.
10. Ausência não vira zero; `NaN`, infinito, data futura e valor inválido falham fechado.
11. Competência usa `YYYY-MM`.
12. Snapshot automático não é editável como manual.
13. Proveniência, data-base, versão e timestamps são obrigatórios.
14. Logs e telemetria não contêm valores financeiros, posições, e-mail, token ou cookie.
15. Eventos de produto usam identidade pseudonimizada e não persistem `ownerId` bruto.
16. Eventos editoriais são anônimos, allowlistados e não recebem parâmetros livres.
17. Plano, admin, identidade, allowlist e entitlement vêm do servidor.
18. Interesse comercial não equivale a entitlement.
19. Risk Lab permanece read-only no Premium.
20. Conteúdo editorial conjuntural exige data-base, fonte e limitação explícitas.
21. Página sem qualidade mínima não é indexada ou publicada.
22. Slug editorial desconhecido retorna 404; não existe conteúdo genérico por fallback.
23. Correções são gerais, sem hardcode por ticker, e-mail ou usuário.
24. CI é gate de merge e deploy.
25. Nenhuma transformação de código-fonte em `predev`, `prebuild` ou `buildCommand` é aceita como correção funcional.
26. Nenhuma validação manual substitui esses gates.

## 7. Arquivos, branches, commits e PRs existentes

### Referências atuais

- Repositório: `IsraelJr/dados-fii`.
- Branch principal: `main`.
- Branch da PV-3.5: `agent/pv-3-5-seo-market-content`.
- PR `#177`: PV-2A, mergeada.
- PR `#178`: PV-2B, mergeada.
- PR `#180`: PV-2C, mergeada.
- PR `#181`: PV-3, mergeada no commit `38e1aa803d62f88c249ca29ff6d919efd8125ad4`.
- PR `#182`: PV-3.5 e Handoff v10.6.0; merge somente após CI final verde no mesmo SHA.
- PR `#170`: fechada sem merge.
- PR `#168`: bloqueada; não mergear sem auditoria específica de segredos e sessão.

### Arquivos centrais da PV-3.5

- `src/lib/editorial/marketContent.ts`;
- `src/lib/editorial/EditorialEvent.ts`;
- `src/app/mercado/page.tsx`;
- `src/app/mercado/[slug]/page.tsx`;
- `src/app/components/MarketArticlePage.tsx`;
- `src/app/components/EditorialTelemetry.tsx`;
- `src/app/api/editorial/events/route.ts`;
- `src/server/controllers/EditorialEventController.ts`;
- `src/server/repositories/FirestoreEditorialEventRepository.ts`;
- `src/app/sitemap.ts`;
- `src/app/components/SiteNav.tsx`;
- `tests/market-content.test.ts`;
- `tests/market-content-architecture.test.mjs`;
- `tests/e2e/market-content.spec.ts`.

## 8. Funcionalidades concluídas, parciais e pendentes

### Concluídas

- ingestão e reconciliação regulatória;
- catálogo, score, Health, Validation e Admin;
- carteira, histórico manual, snapshots e gráficos;
- relatório Premium automático e Risk Lab read-only;
- Inteligência da Carteira determinística, apresentação e explicação opcional por IA;
- descoberta Premium, lista de interesse e beta controlado;
- infraestrutura SEO de fundos com gate, manifesto e sitemap fail-closed;
- hub e cenários editoriais por segmento.

### Parciais

- Premium possui recursos e beta, mas preço e cobrança ainda não foram validados;
- páginas de fundos continuam dependentes do gate editorial individual;
- Google Search Console precisa de acompanhamento operacional após publicação;
- produção da PV-3.5 ainda exige verificação separada pós-merge.

### Pendentes

- relatório incremental da PV-4;
- acompanhar fundo fora da carteira, 1 Grátis e 10 Premium;
- validação de preço;
- checkout e assinaturas;
- histórico avançado e retorno total;
- screener, comparador e filtros salvos;
- alertas por WhatsApp ou Telegram, se aprovados posteriormente.

## 9. Decisões de segurança

- autenticação, identidade, plano e entitlement são resolvidos no servidor;
- variáveis `NEXT_PUBLIC_*` nunca concedem privilégio;
- Route Handlers não acessam Firestore diretamente;
- segredos permanecem server-only e passam por secret scan;
- telemetria de produto usa hash e não persiste identidade bruta;
- telemetria editorial não usa identidade, parâmetros financeiros ou texto livre;
- eventos editoriais possuem enumeração, UUID, versão e expiração;
- páginas privadas permanecem `noindex`;
- páginas editoriais desconhecidas retornam 404;
- conteúdo não contém recomendação individual, preço-alvo ou promessa de rentabilidade;
- falhas de fonte, schema, IA ou persistência são sanitizadas e falham fechado;
- nenhuma ação automática de compra, venda ou alteração de carteira é permitida.

## 10. Variáveis de ambiente

### Obrigatórias conforme ambiente

- credenciais Firebase públicas apenas para inicialização do cliente;
- `FIREBASE_SERVICE_ACCOUNT_JSON` server-only;
- `OPENAI_API_KEY` server-only;
- `CRON_SECRET` server-only;
- credenciais de e-mail e integrações operacionais server-only.

### Produto e rollout

- `ENABLE_RISK_LAB_PREMIUM_READONLY`;
- `ENABLE_WALLET_RISK_REPORT_AUTOMATIC`;
- `ENABLE_WALLET_RISK_REPORT_MANUAL_FALLBACK`;
- `ENABLE_PREMIUM_DISCOVERY`;
- `PREMIUM_BETA_UIDS`;
- `PREMIUM_BETA_EMAILS`;
- `PREMIUM_PREVIEW_EMAILS`.

A PV-3.5 não adiciona credencial de Search Console nem variável pública com poder de indexação. O registro editorial versionado decide quais páginas existem; o sitemap só inclui páginas allowlistadas e válidas.

## 11. Testes obrigatórios

Toda PR funcional deve executar, no mesmo SHA:

1. instalação congelada por lockfile;
2. governança de GitHub Actions;
3. teste canônico do Handoff;
4. auditoria de dependências de produção;
5. secret scan;
6. lint;
7. TypeScript;
8. suíte completa unitária, integração e contratos;
9. Firestore Rules no Emulator;
10. cobertura financeira crítica;
11. mutation sanity;
12. build de produção;
13. smoke HTTP real;
14. E2E desktop/mobile;
15. acessibilidade sem violações sérias ou críticas.

Para conteúdo editorial, também são obrigatórios:

- registro com slugs únicos e allowlistados;
- conteúdo específico por segmento;
- data-base e fontes HTTPS verificáveis;
- canonical, sitemap e dados estruturados;
- 404 para slug desconhecido;
- ausência de campos proibidos na telemetria;
- links internos para jornada editorial e carteira;
- teste de que AdSense não foi antecipado.

## 12. Pendências e decisões ainda abertas

- preço inicial do Premium e do Super Premium;
- mensalidade, créditos, pagamento avulso ou combinação;
- evidência mínima de usuários externos para avançar à cobrança;
- provedor de pagamento e regras de reembolso;
- cadência editorial e responsável por atualização dos cenários;
- operação do Google Search Console após publicação;
- quais fundos receberão revisão editorial individual primeiro;
- WhatsApp ou Telegram para alertas, mantendo consentimento, custo e privacidade;
- eventual AdSense, ainda congelado;
- definição detalhada da política de materialidade da PV-4;
- retenção e migração de análises anteriores para comparação incremental;
- verificação pós-merge e pós-deploy da PV-3.5 em produção.

Nenhuma dessas decisões abertas autoriza checkout, anúncio, mensagem externa ou mudança de entitlement sem sprint própria, testes e registro canônico.
