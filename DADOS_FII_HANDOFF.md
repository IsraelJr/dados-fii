Este documento substitui todos os planejamentos anteriores quando houver divergência.

# Dados FII — Documento Canônico de Handoff

**Versão:** 10.4.0  
**Data:** 04/08/2026  
**Repositório:** `IsraelJr/dados-fii`  
**Branch principal:** `main`  
**PR de encerramento desta versão:** `#180`  
**SHA funcional da PV-2C antes da atualização documental:** `a072ebe330fa309955aba731562ed74c15de743e`  
**Fase vigente:** `Produto Validável`  
**Sprint atual após o merge deste documento:** `PV-3 — Descoberta Premium, beta controlado e telemetria de interesse`

## Decisões vigentes que substituem decisões anteriores

| Decisão vigente | Decisão substituída | Efeito |
|---|---|---|
| PV-1, PV-2A, PV-2B e PV-2C estão concluídas quando a PR `#180` for mergeada. | O Handoff v10.3.0 tratava PV-2A como próxima entrega. | A Inteligência da Carteira passa a ter núcleo determinístico, apresentação e explicação opcional por IA. |
| PV-3 é a próxima sprint oficial. | A continuidade ainda estava centrada na implementação do núcleo da carteira. | O foco passa a ser validar interesse real no Premium antes de cobrança. |
| A IA explica sinais já prontos e nunca recalcula métricas. | IA poderia ser confundida com fonte de cálculo ou decisão. | Números, severidade, confiança, títulos e evidências continuam sob domínio determinístico. |
| A explicação por IA ocorre apenas após ação explícita do usuário. | Geração automática poderia criar custo silencioso. | Não existe chamada ao provedor ao abrir a carteira ou recalcular os sinais. |
| Falha, resposta inválida, número novo ou recomendação gerada pela IA ativa fallback determinístico. | Erro do provedor poderia interromper a experiência ou vazar conteúdo inadequado. | A interface continua útil e fail-closed. |
| A infraestrutura técnica de SEO já integrada não antecipa expansão editorial. | SEO estava totalmente congelado até PV-3. | Canonicalização, `noindex`, 404 real, manifesto e sitemap podem existir; liberação editorial continua condicionada a evidência. |
| Google AdSense continua congelado. | AdSense era tratado como prioridade de monetização. | Nenhuma entrega funcional depende de anúncios. |
| Cobrança continua adiada até validação comercial. | Checkout poderia ser antecipado. | Premium deve provar valor e demanda antes de recorrência, Pix ou cartão. |
| O Handoff v10.4.0 é a única fonte canônica ativa. | Handoffs v10.3.0 e anteriores. | Este documento prevalece em caso de divergência. |

## 1. Estado atual do projeto

- Fases 1, 2 e 3 permanecem formalmente concluídas.
- A fase vigente continua sendo **Produto Validável**.
- PV-1 está concluída funcionalmente, com histórico manual de dividendos, persistência, reconciliação e atualização reativa da carteira.
- PR `#166` consolidou gráfico e resumo sobre `consolidatedSnapshots`.
- PR `#167` restaurou o layout original dos seis cards sem reintroduzir fontes paralelas.
- PR `#177` integrou a PV-2A, com métricas, qualidade, sinais e evidências determinísticas.
- PR `#178` integrou a PV-2B, com o painel “O que merece atenção na sua carteira”, estados de carregamento, vazio, dados parciais e expansão acessível.
- PR `#180` encerra a PV-2C, adicionando explicação opcional dos sinais, cache, rate limit, teto de tokens, validação de saída e fallback determinístico.
- O SHA funcional `a072ebe330fa309955aba731562ed74c15de743e` passou governança, Handoff, auditoria, secret scan, lint, TypeScript, suíte completa, Firestore, cobertura crítica, mutation, build, smoke HTTP e E2E desktop/mobile.
- PR `#170` foi fechada sem merge por ter sido substituída pela implementação limpa da PV-2B na PR `#178`.
- PR `#168` permanece bloqueada e não deve ser mergeada enquanto houver risco de reintrodução de segredos ou alterações privilegiadas fora do escopo.
- A próxima entrega funcional é a validação de descoberta Premium e beta controlado, sem checkout falso.

### Matriz atual

| Área | Estado |
|---|---|
| Regulatory Engine | Concluído |
| Core Intelligence & Product Foundation | Concluído |
| Risk Lab read-only | Concluído |
| Histórico manual do ano corrente | Concluído |
| Sincronização gráfico/cards | Concluída |
| Persistência local + servidor | Concluída |
| PV-2A — núcleo determinístico | Concluída |
| PV-2B — apresentação dos sinais | Concluída |
| PV-2C — explicação por IA | Concluída com o merge da PR `#180` |
| PV-3 — descoberta Premium/beta | Sprint atual após o merge |
| Checkout/cobrança | Não iniciado |
| AdSense | Congelado |

## 2. Fases concluídas

### Fase 1 — Regulatory Engine

**Estado:** concluída.

Parser regulatório, normalização, reconciliação, QA, publicação, rollback, auditoria e suporte FII/FIAGRO.

### Fase 2 — Core Intelligence & Product Foundation

**Estado:** concluída quanto à fundação.

Inclui `RegulatoryDataService`, repositórios, cache, score, Health, Validation, Admin, relatórios, AI Insights, monitor, catálogo, carteira e jobs.

### Fase 3 — Risk Lab

**Estado:** concluída.

Inclui dataset, backtest, ruleset `0.2.0`, Premium read-only, bloqueio de efeitos externos, smoke OIDC e auditoria persistida.

### PV-1 — Jornada principal da carteira e histórico manual

**Estado:** concluída.

Inclui cadastro manual de dividendos de meses encerrados, inclusão, sobrescrita, exclusão, persistência, reconciliação, atualização imediata de gráficos e cards, navegação/reload e testes desktop/mobile.

### PV-2A — Inteligência da Carteira: núcleo determinístico

**Estado:** concluída pela PR `#177`.

Inclui contrato versionado, métricas de renda, concentração, participação na renda, meses atípicos, qualidade dos dados, sinais estruturados, evidências e tratamento separado de ausência, zero e entrada inválida.

### PV-2B — Apresentação dos sinais

**Estado:** concluída pela PR `#178`.

Inclui painel integrado à carteira, linguagem simples, três sinais prioritários, expansão dos demais, evidências visíveis, estados explícitos e acessibilidade desktop/mobile.

### PV-2C — IA explicativa sobre sinais prontos

**Estado:** concluída com o merge da PR `#180`.

Inclui geração sob demanda, payload sanitizado, prompt versionado, fingerprint, cache, deduplicação concorrente, rate limit, teto de tokens, validação contra números novos e recomendações, confiança herdada do domínio e fallback determinístico.

## 3. Sprint atual

### PV-3 — Descoberta Premium, beta controlado e telemetria de interesse

**Objetivo:** descobrir se usuários externos percebem valor suficiente nas funcionalidades Premium antes de implementar cobrança.

### Escopo

- tornar a proposta Premium clara na jornada real, sem bloquear recursos gratuitos existentes;
- apresentar benefícios concretos, como explicação dos sinais, relatório Premium, Risk Lab e futuras funções de acompanhamento;
- criar lista de interesse ou solicitação de acesso beta;
- controlar o beta por allowlist e entitlement server-side;
- registrar eventos de descoberta, intenção e uso sem valores financeiros ou identidade bruta;
- distinguir proprietário, usuário beta e usuário comum sem exceção por e-mail no cliente;
- medir conversão da descoberta para pedido de acesso e uso recorrente;
- não criar checkout, preço fictício, promessa de WhatsApp/Telegram ou paywall irreversível nesta sprint.

### Critérios de aceite

- proposta Premium visível e compreensível em desktop e mobile;
- nenhuma tela simula compra ou assinatura inexistente;
- beta controlado exclusivamente pelo servidor;
- telemetria não contém posições, dividendos, patrimônio, e-mail, token, cookie ou `ownerId` bruto;
- eventos possuem nome, versão, origem, correlação e política de retenção;
- usuário não autorizado não recebe conteúdo Premium por manipulação do cliente;
- testes automatizados cobrem descoberta, pedido de acesso, allowlist, falha fechada e privacidade;
- todos os gates da CI ficam verdes no mesmo SHA;
- validação comercial depende de usuários externos, não apenas do proprietário do projeto.

## 4. Ordem oficial das próximas sprints

1. **PV-3 — Descoberta Premium, beta controlado e telemetria de interesse.**
2. **PV-4 — Relatório incremental: mudanças desde a última análise.**
3. **PV-5 — Radar/Acompanhar fundo fora da carteira: 1 grátis e 10 Premium.**
4. **PV-6 — Validação de preço e cobrança.**
5. **PV-7 — Checkout, recorrência, cancelamento e entitlement comercial.**
6. **PV-8 — Carteira histórica avançada, retorno total e atribuição.**
7. **PV-9 — Screener, comparador, filtros salvos e fair value por categoria.**

SEO editorial, AdSense, WhatsApp, Telegram e grandes mudanças visuais não antecipam PV-3.

## 5. Escopo e critérios de aceite de cada sprint

### PV-3

Aceite conforme a seção 3, com descoberta verdadeira, beta server-side, telemetria privada e nenhuma cobrança simulada.

### PV-4

- comparar a análise atual com a última análise persistida;
- destacar somente mudanças materiais;
- separar mudança de dado, mudança de regra e mudança de qualidade;
- não repetir alertas sem alteração;
- manter evidência e proveniência.

### PV-5

- permitir acompanhar fundo fora da carteira;
- limite inicial: 1 fundo no plano grátis e até 10 no Premium;
- notícias, fatos relevantes, dividendos e sinais devem ser deduplicados;
- acompanhamento não transforma o fundo em posição da carteira;
- alertas não podem ser interpretados como recomendação de compra.

### PV-6

- testar proposta de preço, periodicidade e disposição a pagar;
- comparar recorrência, créditos e pagamento avulso;
- não implementar cobrança antes de evidência mínima definida.

### PV-7

- implementar checkout somente após decisão comercial registrada;
- incluir recorrência, cancelamento, reembolso, webhooks idempotentes e entitlement server-side;
- nenhuma variável pública concede plano.

### PV-8

- retorno total, dividendos, valorização, aportes e atribuição separados;
- competência, caixa e custo médio com regras versionadas;
- reconciliação e migração sem perda de histórico.

### PV-9

- screener, comparador e filtros salvos;
- fair value por categoria, nunca uma fórmula única para todos os segmentos;
- dados insuficientes devem permanecer explícitos.

Cada sprint exige escopo fechado, testes automatizados, Preview, produção e evidência antes de ser marcada como concluída.

## 6. Regras arquiteturais obrigatórias

1. Route Handler → autenticação/schema → controller/application service → domínio → repository → Firestore/provedor.
2. Nenhum `route.ts` importa Firestore diretamente.
3. Componente React não contém regra financeira, conflito ou persistência de domínio.
4. Métricas e sinais da carteira ficam em módulos puros, testáveis e independentes de UI.
5. IA nunca é fonte de verdade para cálculo financeiro.
6. A camada de IA recebe somente sinais e evidências sanitizados; não recebe a carteira bruta por conveniência.
7. Título, severidade, confiança, código e evidência de um sinal não podem ser substituídos pela IA.
8. Saída de IA incompatível, com número novo ou recomendação falha fechado e usa fallback determinístico.
9. Gráfico e cards que representam o mesmo conceito usam a mesma série consolidada.
10. Ausência não vira zero; `NaN`, infinito, data futura e valor inválido falham fechado.
11. Competência usa `YYYY-MM`.
12. Snapshot automático não é editável como manual.
13. Proveniência e timestamps são obrigatórios.
14. Logs e telemetria não contêm valores financeiros, posições, e-mail, token ou cookie.
15. Plano, admin, identidade e entitlement vêm do servidor.
16. Risk Lab permanece read-only no Premium.
17. Correções são gerais, sem hardcode por ticker, e-mail ou usuário.
18. CI é gate de merge e deploy.
19. Nenhuma transformação de código-fonte em `predev`, `prebuild` ou `buildCommand` é aceita como correção funcional.
20. Nenhuma validação manual substitui esses gates.

## 7. Arquivos, branches, commits e PRs existentes

### Referências atuais

- Repositório: `IsraelJr/dados-fii`.
- Branch principal: `main`.
- Branch da PV-2C: `agent/pv-2c-ai-explanations`.
- PR `#177`: PV-2A, mergeada.
- PR `#178`: PV-2B, mergeada por squash no commit `3d604e276ac1ef57a003443d21167319f4b5dca0`.
- PR `#180`: PV-2C e atualização deste Handoff; deve ser mergeada apenas com todos os gates verdes no mesmo SHA final.
- PR `#170`: fechada sem merge, substituída pela PR `#178`.
- PR `#168`: bloqueada; não mergear sem remoção comprovada de segredos e escopo privilegiado legado.

### Arquivos centrais da Inteligência da Carteira

- `src/lib/portfolio-intelligence/PortfolioIntelligence.ts`;
- `src/lib/portfolio-intelligence/PortfolioIntelligencePolicy.ts`;
- `src/lib/portfolio-intelligence/PortfolioIntelligenceMetrics.ts`;
- `src/lib/portfolio-intelligence/PortfolioIntelligenceDataQuality.ts`;
- `src/lib/portfolio-intelligence/PortfolioIntelligenceSignals.ts`;
- `src/lib/portfolio-intelligence/PortfolioIntelligenceService.ts`;
- `src/lib/portfolio-intelligence/PortfolioIntelligencePresentation.ts`;
- `src/lib/portfolio-intelligence/PortfolioIntelligenceExplanation.ts`;
- `src/lib/portfolio-intelligence/PortfolioIntelligenceExplanationService.ts`;
- `src/app/components/PortfolioIntelligencePanel.tsx`;
- `src/app/components/PortfolioIntelligenceExplanationPanel.tsx`;
- `src/app/api/portfolio/intelligence/explanation/route.ts`;
- `tests/portfolio-intelligence*.test.*`;
- `tests/e2e/portfolio-intelligence-experience.spec.ts`.

### Documentos canônicos

- `DADOS_FII_HANDOFF.md`;
- `docs/product/product-validation-phase-1.md`;
- `docs/operations/runtime-environment-inventory.md`;
- `tests/canonical-handoff.test.mjs`.

## 8. Funcionalidades concluídas, parciais e pendentes

### Concluídas

- motor regulatório, catálogo, reconciliação e Admin;
- carteira básica, snapshots e histórico manual;
- persistência local e server-side;
- atualização imediata de gráfico e cards;
- maior mês, menor mês, total e média sobre a mesma fonte;
- núcleo determinístico da Inteligência da Carteira;
- painel de sinais e evidências;
- explicação por IA sob demanda com fallback determinístico;
- relatórios Free, AI Insights e Premium controlado;
- Risk Lab read-only;
- canonicalização, `noindex`, 404 real e infraestrutura técnica de manifesto/sitemap;
- segurança, CI e gates de produção.

### Parciais

- Premium: recursos existem, mas descoberta, beta externo, preço e cobrança não estão finalizados;
- notificações: infraestrutura existe, mas mudança material, resumo unificado e deduplicação ainda exigem evolução;
- SEO: infraestrutura técnica existe, mas a liberação editorial de páginas de fundos permanece bloqueada até aprovação por evidência;
- acompanhar fundo fora da carteira: conceito definido, implementação pendente para PV-5.

### Pendentes

- descoberta Premium e beta externo;
- relatório incremental;
- acompanhar fundo fora da carteira;
- validação de preço;
- cobrança, cancelamento e entitlement comercial;
- alertas por WhatsApp ou Telegram;
- retorno total, atribuição, screener e comparador;
- páginas editoriais de FIIs aprovadas individualmente;
- forma final de cobrança dos planos Grátis, Premium e Super Premium.

## 9. Decisões de segurança

- Segredos são server-only.
- `NEXT_PUBLIC_*` nunca concede plano, admin, ownership ou privilégio.
- Carteira, histórico e explicações são privados e `noindex`.
- Entitlement e identidade são resolvidos no servidor.
- Escritas exigem autenticação, schema e ownership.
- Usuário só acessa e altera seus próprios registros.
- Eventos analíticos não armazenam valores da carteira.
- E-mail ou `ownerId` enviados no body não concedem identidade.
- Não existe exceção por e-mail pessoal.
- IA recebe apenas dados necessários e sanitizados.
- A chamada explicativa usa resposta `private, no-store` e não persiste dados financeiros.
- Textos vindos da entrada são tratados como dados, não como instruções de prompt.
- Rate limit, cache, deduplicação e teto de tokens limitam abuso e custo.
- Sinais determinísticos não podem disparar efeitos externos por conta própria.
- PR com segredo, bypass privilegiado ou alteração fora de escopo permanece bloqueada.

## 10. Variáveis de ambiente

O inventário versionado está em:

`docs/operations/runtime-environment-inventory.md`

Regras:

- valores nunca são registrados no Git, Handoff, logs ou evidências;
- variável nova exige classificação, owner, ambientes, fallback, rollback e teste;
- feature flag temporária exige condição de remoção;
- credenciais OpenAI permanecem server-only;
- a PV-2C reutiliza `OPENAI_INSIGHTS_MODEL`, `OPENAI_MODEL` e `OPENAI_INSIGHTS_MAX_OUTPUT_TOKENS` já governadas;
- a PV-2C não cria variável pública, credencial nova ou configuração fora do inventário;
- flags de Premium e Risk Lab permanecem fail-closed.

## 11. Testes obrigatórios

Gate mínimo e bloqueante:

1. `npm ci`;
2. governança de workflows;
3. validação do Handoff canônico;
4. auditoria de dependências de produção;
5. detecção de segredos;
6. lint;
7. TypeScript;
8. suíte unitária, integração e contratos;
9. regras do Firestore;
10. cobertura financeira crítica;
11. mutation sanity;
12. build de produção;
13. smoke HTTP real;
14. E2E desktop e mobile com acessibilidade.

Testes específicos da PV-2C devem provar:

- nenhuma chamada de IA antes do clique do usuário;
- payload sanitizado sem identidade ou carteira bruta;
- sinal desconhecido ou duplicado rejeitado;
- evidência não finita rejeitada;
- confiança herdada do domínio;
- número novo e recomendação rejeitados;
- cache e deduplicação concorrente;
- falha do provedor transformada em fallback determinístico;
- cliente sem import server-only;
- rota sem Firestore ou OpenAI direto;
- nenhuma regressão na carteira existente.

Uma sprint não é concluída por descrição, screenshot ou aprovação manual. A conclusão exige evidência automatizada no mesmo SHA mergeado.

## 12. Pendências e decisões ainda abertas

- definir métricas mínimas de sucesso da PV-3: visualização da proposta, pedido de beta, ativação e retorno;
- definir tamanho e duração do beta controlado;
- definir quais benefícios Premium serão exibidos primeiro na descoberta;
- decidir entre assinatura recorrente, créditos, pagamento avulso ou combinação;
- definir preços dos planos Grátis, Premium e Super Premium somente após evidência externa;
- decidir canal futuro de alertas: e-mail, WhatsApp ou Telegram;
- definir política final de resumo unificado e frequência de notificações;
- definir critérios editoriais para liberar cada FII ao sitemap público;
- definir política de retenção e anonimização da telemetria da PV-3;
- decidir quando iniciar PV-4 sem antecipar cobrança;
- revisar a PR `#168` apenas como histórico técnico, sem reaproveitar segredos ou bypass privilegiado;
- manter AdSense congelado até decisão explícita posterior.

## Encerramento operacional

Após o merge da PR `#180`:

- PV-2A, PV-2B e PV-2C ficam formalmente concluídas;
- `main` passa a ser a única base para novas branches;
- a próxima branch deve conter somente PV-3;
- nenhum trabalho de checkout, WhatsApp, Telegram, AdSense ou expansão editorial deve entrar por conveniência;
- qualquer divergência entre este documento e planejamentos anteriores é resolvida em favor deste Handoff v10.4.0.
