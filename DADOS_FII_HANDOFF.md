Este documento substitui todos os planejamentos anteriores quando houver divergência.

# Dados FII — Documento Canônico de Handoff

**Versão:** 10.7.0
**Data:** 17/08/2026
**Repositório:** `IsraelJr/dados-fii`  
**Branch principal:** `main`  
**PR de encerramento desta versão:** `#187`
**SHA funcional da PV-4 antes da atualização documental:** `4203e3b0c5bc586ee32643bc47976545b91731c9`
**CI funcional:** `Phase 2 Closure CI` — run `32038322839` — sucesso
**Fase vigente:** `Produto Validável`  
**Próximo item urgente após o merge deste documento:** `Hotfix — recuperação da sessão da carteira`, antes da PV-5

## Decisões vigentes que substituem decisões anteriores

| Decisão vigente | Decisão substituída | Efeito |
|---|---|---|
| PV-1, PV-2A, PV-2B, PV-2C, PV-3, PV-3.5 e PV-4 ficam formalmente concluídas com o merge da PR `#187`. | O Handoff v10.6.0 tratava PV-4 como sprint atual. | O produto passa a comparar referências server-owned e mostrar somente mudanças materiais rastreáveis. |
| PR `#185` concluiu o saneamento do `nanoid` no lockfile e PR `#186` concluiu a dívida de determinismo temporal. | Esses dois bloqueadores precediam a integração segura da PV-4. | Segurança de dependência e relógio determinístico são pré-requisitos concluídos da PV-4. |
| O hotfix de recuperação da sessão da carteira é o próximo item urgente antes da PV-5. | PV-5 poderia começar imediatamente após a PV-4. | O roadmap funcional não muda; a correção de sessão recebe prioridade operacional própria. |
| O hub `/mercado` e sete páginas segmentadas são a superfície editorial oficial desta fase. | SEO editorial ainda não possuía rotas próprias. | Mercado de FIIs, FIAGRO, logística, shoppings, escritórios, recebíveis e renda urbana têm conteúdo específico, data-base e fontes. |
| Página editorial desconhecida ou sem qualidade mínima não é publicada nem indexada. | Uma rota dinâmica poderia gerar conteúdo raso por fallback. | O registro editorial é allowlistado e slug desconhecido retorna 404 real. |
| Telemetria editorial é anônima, mínima e retida por 90 dias. | Eventos editoriais poderiam reutilizar identidade ou dados financeiros. | Nenhum evento contém e-mail, `ownerId`, carteira, posição, ticker, dividendo, patrimônio, token ou cookie. |
| Google AdSense continua congelado. | SEO poderia ser confundido com antecipação de anúncios. | O objetivo é tráfego qualificado e utilidade; publicidade não integra esta entrega. |
| Cobrança continua adiada até a PV-6, e checkout permanece na PV-7. | Monetização poderia ser antecipada sem evidência comercial. | Interesse, beta e uso continuam separados de pagamento e entitlement comercial. |
| O Handoff v10.7.0 é a única fonte canônica ativa. | Handoffs v10.6.0 e anteriores. | Este documento prevalece em caso de divergência. |

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
- PR `#182` encerrou a PV-3.5, com hub público, sete cenários segmentados, fontes oficiais, SEO técnico e telemetria editorial privada.
- PR `#185` atualizou o `nanoid` vulnerável no lockfile e foi integrada pelo merge commit `025ced8f8fb42c204f380e96827c2f073bd8d115`.
- PR `#186` tornou derivados financeiros temporalmente determinísticos e foi integrada pelo merge commit `f8101234359fa27c41e263e9dfa67bafd4c4572c`.
- PR `#187` encerra a PV-4 sobre a base `f810123`, substituindo a implementação histórica da PR `#183`, fechada sem merge.
- O SHA funcional `4203e3b0c5bc586ee32643bc47976545b91731c9` passou governança, Handoff vigente, auditoria, secret scan, lint, TypeScript, 859 testes, Firestore Rules/Emulator, cobertura crítica, mutation, build, smoke HTTP e 42 E2E desktop/mobile com acessibilidade no run `32038322839`.
- PR `#170` continua fechada sem merge, substituída pela implementação limpa da PR `#178`.
- PR `#168` permanece bloqueada e não deve ser mergeada enquanto houver risco de reintrodução de segredos ou alterações privilegiadas fora do escopo.
- A PV-4 reconstrói entrada financeira server-side, mantém referência versionada e transacional, trata replay, concorrência e stale write e deixa a IA somente como explicadora opcional.
- A revisão adicional corrigiu a janela histórica para os 120 meses mais recentes, preservou renda conhecida igual a zero, tornou o rollback fail-closed durável durante remount da mesma aba e eliminou atualização redundante de posição idêntica.
- O próximo item urgente é o hotfix de recuperação da sessão da carteira, em escopo próprio e antes da PV-5.
- Não há evidência de deploy em produção da PV-4 neste documento; merge e CI não substituem verificação posterior do ambiente produtivo.

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
| PV-3.5 — SEO e Conteúdo de Mercado | Concluída pela PR `#182` |
| PV-4 — relatório incremental | Concluída com o merge da PR `#187` |
| Hotfix — recuperação da sessão da carteira | Próximo item urgente antes da PV-5 |
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

### PV-4 — Relatório incremental: mudanças desde a última análise

**Estado:** concluída com o merge da PR `#187`.

Inclui:

- entrada financeira reconstruída no servidor a partir da carteira, snapshots e histórico canônicos;
- navegador enviando somente a intenção allowlistada `{ portfolioId: "default" }`;
- referência mínima versionada, server-owned, isolada por usuário e persistida transacionalmente;
- idempotência para mesmo `asOf` e mesmo fingerprint, avanço monotônico, rejeição de stale write, replay, conflito e concorrência;
- fingerprint alinhado à entrada normalizada do domínio, sem incluir competência ainda aberta;
- comparação determinística de dados, regra, cobertura e qualidade, sem IA decidir mudança financeira;
- explicação opcional sanitizada, acionada pelo usuário e baseada somente no par persistido;
- reconciliação remota antes de atualizar a experiência após POST, PATCH ou DELETE do histórico;
- preflight server-only, autenticação, same-origin, rate limit e feature flag server-side;
- rollback fail-closed durável na mesma aba, inclusive após remount, sem reenviar dados financeiros para descobrir a flag;
- leitura dos 120 meses mais recentes em ordem canônica e distinção explícita entre renda conhecida `0` e ausência `null`;
- E2E desktop/mobile, múltiplas abas, estados autenticado e sem sessão e acessibilidade sem violações sérias ou críticas.

## 3. Sprint atual

### Hotfix urgente — recuperação da sessão da carteira

**Prioridade:** executar em PR própria antes de iniciar a PV-5.

Este registro não autoriza implementação dentro da PV-4. O hotfix deve tratar somente a recuperação da sessão inválida da carteira, preservar autenticação e isolamento existentes e passar os mesmos gates canônicos antes de qualquer merge. O roadmap funcional PV-5 a PV-9 permanece inalterado.

## 4. Ordem oficial das próximas sprints

1. **PV-5 — Radar/Acompanhar fundo fora da carteira: 1 grátis e 10 Premium.**
2. **PV-6 — Validação de preço e cobrança.**
3. **PV-7 — Checkout, recorrência, cancelamento e entitlement comercial.**
4. **PV-8 — Carteira histórica avançada, retorno total e atribuição.**
5. **PV-9 — Screener, comparador, filtros salvos e fair value por categoria.**

O hotfix de recuperação da sessão tem prioridade operacional antes desta sequência e não altera o roadmap funcional.

AdSense, WhatsApp, Telegram e grandes mudanças visuais continuam adiados.

## 5. Escopo e critérios de aceite de cada sprint

### PV-4 — Relatório incremental

**Concluída pela PR `#187`.** Compara estados versionados, destaca somente mudanças materiais, preserva evidência e não usa IA para decidir se uma mudança financeira ocorreu.

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
- Branch da PV-4: `agent/pv4-reconciliation`.
- PR `#177`: PV-2A, mergeada.
- PR `#178`: PV-2B, mergeada.
- PR `#180`: PV-2C, mergeada.
- PR `#181`: PV-3, mergeada no commit `38e1aa803d62f88c249ca29ff6d919efd8125ad4`.
- PR `#182`: PV-3.5 e Handoff v10.6.0, mergeada.
- PR `#185`: saneamento do `nanoid`, mergeada em `025ced8f8fb42c204f380e96827c2f073bd8d115`.
- PR `#186`: determinismo temporal, mergeada em `f8101234359fa27c41e263e9dfa67bafd4c4572c`.
- PR `#187`: PV-4 e Handoff v10.7.0; merge somente após CI final verde no mesmo SHA documental.
- PR `#183`: fechada sem merge e substituída pela PR limpa `#187`.
- PR `#170`: fechada sem merge.
- PR `#168`: bloqueada; não mergear sem auditoria específica de segredos e sessão.

### Arquivos centrais da PV-4

- `src/lib/portfolio-intelligence/PortfolioIncrementalIntelligence.ts`;
- `src/server/services/PortfolioIntelligenceReferenceFactory.ts`;
- `src/server/services/PortfolioIncrementalAnalysisService.ts`;
- `src/server/repositories/FirestorePortfolioIntelligenceSourceRepositoryCore.ts`;
- `src/server/repositories/FirestorePortfolioIntelligenceReferenceRepositoryCore.ts`;
- `src/server/controllers/PortfolioIncrementalControllerCore.ts`;
- `src/app/api/portfolio/incremental-analysis/route.ts`;
- `src/app/api/portfolio/incremental-analysis/availability/route.ts`;
- `src/app/components/PortfolioIncrementalReportPanel.tsx`;
- `tests/portfolio-intelligence-incremental.test.ts`;
- `tests/firestore-portfolio-intelligence-reference-repository.test.ts`;
- `tests/e2e/portfolio-intelligence-experience.spec.ts`.

## 8. Funcionalidades concluídas, parciais e pendentes

### Concluídas

- ingestão e reconciliação regulatória;
- catálogo, score, Health, Validation e Admin;
- carteira, histórico manual, snapshots e gráficos;
- relatório Premium automático e Risk Lab read-only;
- Inteligência da Carteira determinística, apresentação e explicação opcional por IA;
- descoberta Premium, lista de interesse e beta controlado;
- infraestrutura SEO de fundos com gate, manifesto e sitemap fail-closed;
- hub e cenários editoriais por segmento;
- relatório incremental PV-4 server-owned, determinístico, versionado, transacional e fail-closed.

### Parciais

- Premium possui recursos e beta, mas preço e cobrança ainda não foram validados;
- páginas de fundos continuam dependentes do gate editorial individual;
- Google Search Console precisa de acompanhamento operacional após publicação;
- produção da PV-4 ainda exige verificação separada pós-merge.

### Pendentes

- hotfix de recuperação da sessão da carteira, antes da PV-5;
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
- `ENABLE_INCREMENTAL_PORTFOLIO_REPORT`;
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
- hotfix de recuperação da sessão da carteira, em PR própria antes da PV-5;
- verificação pós-merge e pós-deploy da PV-4 em produção.

Nenhuma dessas decisões abertas autoriza checkout, anúncio, mensagem externa ou mudança de entitlement sem sprint própria, testes e registro canônico.
