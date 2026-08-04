Este documento substitui todos os planejamentos anteriores quando houver divergência.

# Dados FII — Documento Canônico de Handoff

**Versão:** 10.5.0  
**Data:** 04/08/2026  
**Repositório:** `IsraelJr/dados-fii`  
**Branch principal:** `main`  
**PR de encerramento desta versão:** `#181`  
**SHA funcional da PV-3 antes da atualização documental:** `2a5ac46d1c7cd248be6c46d53d2bc463690c38cd`  
**Fase vigente:** `Produto Validável`  
**Sprint atual após o merge deste documento:** `PV-3.5 — SEO e Conteúdo de Mercado`

## Decisões vigentes que substituem decisões anteriores

| Decisão vigente | Decisão substituída | Efeito |
|---|---|---|
| PV-1, PV-2A, PV-2B, PV-2C e PV-3 ficam formalmente concluídas com o merge da PR `#181`. | O Handoff v10.4.0 tratava PV-3 como sprint atual. | A descoberta Premium passa a existir com proposta honesta, lista de interesse, beta server-side e telemetria privada. |
| PV-3.5 — SEO e Conteúdo de Mercado é a próxima sprint oficial. | SEO editorial estava adiado sem posição própria na sequência. | A aquisição orgânica começa antes de checkout, para amadurecer indexação e alimentar a validação comercial. |
| A proposta Premium permanece “Em validação”. | Uma tela poderia sugerir produto, preço ou assinatura já disponíveis. | Não existe checkout, preço fictício, cobrança ou liberação automática após pedido de acesso. |
| Interesse e entitlement são conceitos separados. | Pedido de participação poderia ser confundido com acesso Premium. | Somente o servidor concede beta, Premium, Super Premium ou acesso administrativo. |
| O beta é controlado por allowlist server-side e pelo entitlement existente. | Estado do navegador ou variável pública poderia conceder privilégio. | Manipulação do cliente não libera conteúdo protegido. |
| Telemetria comercial usa identidade pseudonimizada e audiência agregável. | Eventos legados podiam persistir `ownerId` bruto. | Eventos registram hash, nome, versão, origem, audiência, correlação e retenção, sem carteira ou identidade bruta. |
| SEO editorial terá páginas próprias de mercado e segmentos. | A infraestrutura técnica de SEO existia sem expansão editorial oficial. | Mercado de FIIs, FIAGRO/agro, galpões/logística, shoppings, escritórios, recebíveis e renda urbana entram no escopo. |
| Google AdSense continua congelado. | Anúncios poderiam ser antecipados junto com o SEO. | A prioridade é conteúdo útil, descoberta do produto e tráfego qualificado, não monetização por anúncios. |
| Cobrança continua adiada até a PV-6. | Checkout poderia ser implementado antes de evidência comercial. | Preço, periodicidade e disposição a pagar serão validados antes da PV-7. |
| O Handoff v10.5.0 é a única fonte canônica ativa. | Handoffs v10.4.0 e anteriores. | Este documento prevalece em caso de divergência. |

## 1. Estado atual do projeto

- Fases 1, 2 e 3 permanecem formalmente concluídas.
- A fase vigente continua sendo **Produto Validável**.
- PV-1 está concluída funcionalmente, com histórico manual de dividendos, persistência, reconciliação e atualização reativa da carteira.
- PR `#166` consolidou gráfico e resumo sobre `consolidatedSnapshots`.
- PR `#167` restaurou o layout original dos seis cards sem reintroduzir fontes paralelas.
- PR `#177` integrou a PV-2A, com métricas, qualidade, sinais e evidências determinísticas.
- PR `#178` integrou a PV-2B, com apresentação acessível dos sinais da carteira.
- PR `#180` encerrou a PV-2C, com explicação opcional por IA, validação de saída e fallback determinístico.
- PR `#181` encerra a PV-3 com proposta “Premium em validação”, lista de interesse, beta controlado no servidor, feature flag de rollback, telemetria pseudonimizada e testes desktop/mobile.
- O SHA funcional `2a5ac46d1c7cd248be6c46d53d2bc463690c38cd` passou os workflows `Phase 2 Closure CI` e `Risk Lab CI`, incluindo governança, Handoff, auditoria, secret scan, lint, TypeScript, 729 testes, Firestore, cobertura crítica, mutation, build, smoke HTTP, Risk Lab e E2E.
- PR `#170` foi fechada sem merge por ter sido substituída pela implementação limpa da PV-2B na PR `#178`.
- PR `#168` permanece bloqueada e não deve ser mergeada enquanto houver risco de reintrodução de segredos ou alterações privilegiadas fora do escopo.
- A próxima entrega funcional é a PV-3.5, voltada à aquisição orgânica e páginas editoriais úteis sobre o mercado de fundos.
- Não há evidência de deploy em produção da PV-3 neste documento; merge e CI não substituem verificação posterior do ambiente produtivo.

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
| PV-2C — explicação por IA | Concluída |
| PV-3 — descoberta Premium/beta | Concluída com o merge da PR `#181` |
| PV-3.5 — SEO e Conteúdo de Mercado | Sprint atual após o merge |
| PV-4 — relatório incremental | Planejada |
| PV-5 — acompanhar fundos | Planejada |
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

**Estado:** concluída pela PR `#180`.

A explicação por IA ocorre apenas após ação explícita do usuário. Inclui payload sanitizado, prompt versionado, fingerprint, cache, deduplicação concorrente, rate limit, teto de tokens, validação contra números novos e recomendações, confiança herdada do domínio e fallback determinístico.

### PV-3 — Descoberta Premium, beta controlado e telemetria de interesse

**Estado:** concluída com o merge da PR `#181`.

Inclui:

- proposta “Premium em validação” integrada à jornada da carteira;
- benefícios concretos sem simular preço, compra ou assinatura;
- pedido de participação que não concede acesso automaticamente;
- allowlist server-side por UID ou e-mail verificado;
- integração do beta ao mesmo entitlement usado pelos recursos Premium;
- lista de interesse separada da telemetria;
- eventos com audiência `external`, `beta`, `premium` ou `owner`;
- identidade de telemetria em SHA-256, sem `ownerId` bruto;
- retenção declarada de 90 dias;
- rollback pela flag `ENABLE_PREMIUM_DISCOVERY`;
- testes de domínio, arquitetura, privacidade e E2E.

## 3. Sprint atual

### PV-3.5 — SEO e Conteúdo de Mercado

**Objetivo:** construir aquisição orgânica sustentável com conteúdo útil, confiável e conectado às jornadas de consulta, carteira e Premium, sem criar páginas rasas ou publicar cenários sem data e fonte.

### Escopo

- criar um hub público sobre o mercado de fundos imobiliários;
- criar páginas editoriais próprias para:
  - mercado de FIIs;
  - FIAGRO e cenário do agronegócio;
  - galpões e logística;
  - shoppings;
  - escritórios e lajes corporativas;
  - fundos de recebíveis/papel;
  - renda urbana e segmentos complementares com dados suficientes;
- explicar como juros, inflação, crédito, atividade econômica e ciclos setoriais afetam cada categoria;
- separar conteúdo estrutural duradouro de atualizações conjunturais datadas;
- informar data-base, fontes, limitações e critérios de atualização;
- conectar cada página aos fundos e relatórios relacionados, sem recomendação de compra;
- implementar metadados, canonical, `Article`, `BreadcrumbList`, sitemap e links internos coerentes;
- manter `noindex` ou não publicar quando a página não atingir qualidade mínima;
- medir entrada orgânica e continuidade para consulta, carteira, relatório e descoberta Premium sem valores financeiros ou identidade bruta;
- preparar monitoramento por Google Search Console sem expor credenciais;
- manter AdSense fora do escopo.

### Critérios de aceite

- hub e páginas prioritárias possuem conteúdo original, útil e específico para cada segmento;
- nenhuma página usa texto genérico intercambiável entre agro, logística, shoppings, escritórios e recebíveis;
- cenários conjunturais exibem data-base e fontes verificáveis;
- conteúdo não inventa indicadores, fatos, dividendos, aquisições ou projeções;
- página com dados insuficientes falha fechado, não é indexada ou não é publicada;
- arquitetura evita conteúdo duplicado e canibalização entre rotas;
- metadados, canonical, sitemap, dados estruturados e breadcrumbs são testados;
- links internos conduzem a páginas de fundos, carteira e recursos do produto de forma contextual;
- desktop e mobile passam acessibilidade e E2E;
- performance e renderização server-side não degradam as jornadas existentes;
- telemetria editorial respeita a mesma política de privacidade da PV-3;
- todos os gates da CI ficam verdes no mesmo SHA;
- publicação e produção somente são consideradas concluídas com evidência separada do ambiente produtivo.

## 4. Ordem oficial das próximas sprints

1. **PV-3.5 — SEO e Conteúdo de Mercado.**
2. **PV-4 — Relatório incremental: mudanças desde a última análise.**
3. **PV-5 — Radar/Acompanhar fundo fora da carteira: 1 grátis e 10 Premium.**
4. **PV-6 — Validação de preço e cobrança.**
5. **PV-7 — Checkout, recorrência, cancelamento e entitlement comercial.**
6. **PV-8 — Carteira histórica avançada, retorno total e atribuição.**
7. **PV-9 — Screener, comparador, filtros salvos e fair value por categoria.**

AdSense, WhatsApp, Telegram e grandes mudanças visuais continuam adiados. SEO editorial agora possui sprint própria e não deve ser confundido com publicação automática irrestrita.

## 5. Escopo e critérios de aceite de cada sprint

### PV-3.5

Aceite conforme a seção 3, com conteúdo segmentado, data-base, fontes, SEO técnico, links internos, privacidade, acessibilidade e nenhuma página rasa indexada.

### PV-4 — Relatório incremental

- comparar a análise atual com a última análise persistida;
- destacar somente mudanças materiais;
- separar mudança de dado, mudança de regra e mudança de qualidade;
- não repetir alertas sem alteração;
- manter evidência e proveniência;
- não usar IA para decidir se uma mudança financeira ocorreu.

### PV-5 — Acompanhar fundo fora da carteira

- permitir acompanhar fundo sem transformá-lo em posição da carteira;
- limite inicial: 1 fundo no plano grátis e até 10 no Premium;
- notícias, fatos relevantes, dividendos e sinais devem ser deduplicados;
- usuário deve conseguir iniciar e encerrar o acompanhamento;
- alertas não podem ser interpretados como recomendação de compra;
- relatório de acompanhamento deve explicar segmento, fatores de risco, renda, eventos e qualidade dos dados.

### PV-6 — Validação de preço e cobrança

- testar proposta de preço, periodicidade e disposição a pagar;
- comparar recorrência, créditos e pagamento avulso;
- definir evidência mínima com usuários externos;
- registrar a decisão comercial antes de implementar cobrança;
- não criar checkout nesta sprint.

### PV-7 — Checkout e assinaturas

- implementar checkout somente após decisão comercial registrada;
- incluir recorrência, cancelamento, reembolso e comunicação transparente;
- processar webhooks de forma autenticada e idempotente;
- entitlement permanece server-side;
- nenhuma variável pública concede plano;
- falha de cobrança não pode apagar histórico ou carteira.

### PV-8 — Histórico avançado, retorno e atribuição

- retorno total, dividendos, valorização, aportes e atribuição separados;
- competência, caixa e custo médio com regras versionadas;
- reconciliação e migração sem perda de histórico;
- comparações deixam explícitos período, benchmark e cobertura.

### PV-9 — Screener e comparador

- screener, comparador e filtros salvos;
- fair value por categoria, nunca uma fórmula única para todos os segmentos;
- dados insuficientes devem permanecer explícitos;
- ranking não pode esconder qualidade, liquidez ou limitações da fonte.

Cada sprint exige escopo fechado, testes automatizados, Preview, produção e evidência antes de ser marcada como concluída.

## 6. Regras arquiteturais obrigatórias

1. Route Handler → autenticação/schema → controller/application service → domínio → repository → Firestore/provedor.
2. Nenhum `route.ts` importa Firestore diretamente.
3. Componente React não contém regra financeira, entitlement ou persistência de domínio.
4. Métricas e sinais da carteira ficam em módulos puros, testáveis e independentes de UI.
5. IA nunca é fonte de verdade para cálculo financeiro.
6. A camada de IA recebe somente sinais e evidências sanitizados; não recebe a carteira bruta por conveniência.
7. Título, severidade, confiança, código e evidência de um sinal não podem ser substituídos pela IA.
8. Saída de IA incompatível, com número novo ou recomendação falha fechado e usa fallback determinístico.
9. Gráfico e cards que representam o mesmo conceito usam a mesma série consolidada.
10. Ausência não vira zero; `NaN`, infinito, data futura e valor inválido falham fechado.
11. Competência usa `YYYY-MM`.
12. Snapshot automático não é editável como manual.
13. Proveniência, data-base e timestamps são obrigatórios.
14. Logs e telemetria não contêm valores financeiros, posições, e-mail, token ou cookie.
15. Eventos de produto usam identidade pseudonimizada e não persistem `ownerId` bruto.
16. Plano, admin, identidade, allowlist e entitlement vêm do servidor.
17. Interesse comercial não equivale a entitlement.
18. Risk Lab permanece read-only no Premium.
19. Conteúdo editorial conjuntural exige data-base, fonte e limitação explícitas.
20. Página sem qualidade mínima não é indexada ou publicada.
21. Correções são gerais, sem hardcode por ticker, e-mail ou usuário.
22. CI é gate de merge e deploy.
23. Nenhuma transformação de código-fonte em `predev`, `prebuild` ou `buildCommand` é aceita como correção funcional.
24. Nenhuma validação manual substitui esses gates.

## 7. Arquivos, branches, commits e PRs existentes

### Referências atuais

- Repositório: `IsraelJr/dados-fii`.
- Branch principal: `main`.
- Commit de merge da PV-2C na `main`: `68e35df5a211c1baf380cf939466656ff1f110c8`.
- Branch da PV-3: `agent/pv-3-premium-discovery`.
- SHA funcional da PV-3 antes da atualização documental: `2a5ac46d1c7cd248be6c46d53d2bc463690c38cd`.
- PR `#177`: PV-2A, mergeada.
- PR `#178`: PV-2B, mergeada.
- PR `#180`: PV-2C, mergeada por squash.
- PR `#181`: PV-3 e atualização deste Handoff; mergear somente após todos os gates verdes no mesmo SHA final.
- PR `#170`: fechada sem merge, substituída pela PR `#178`.
- PR `#168`: bloqueada; não mergear sem remoção comprovada de segredos e escopo privilegiado legado.

### Arquivos centrais da PV-3

- `src/lib/premium-discovery/PremiumDiscovery.ts`;
- `src/lib/premium-discovery/PremiumDiscoveryRepository.ts`;
- `src/lib/premium-discovery/PremiumDiscoveryService.ts`;
- `src/lib/premium-discovery/index.ts`;
- `src/lib/premiumSecurity.ts`;
- `src/lib/featureFlags.ts`;
- `src/server/controllers/PremiumDiscoveryController.ts`;
- `src/server/repositories/FirestorePremiumDiscoveryRepository.ts`;
- `src/server/repositories/FirestoreProductEventRepository.ts`;
- `src/app/api/premium/discovery/route.ts`;
- `src/app/components/PremiumDiscoveryPanel.tsx`;
- `src/app/components/PortfolioIntelligencePanel.tsx`;
- `tests/premium-discovery.test.ts`;
- `tests/premium-discovery-architecture.test.mjs`;
- `tests/e2e/premium-discovery.spec.ts`;
- `.env.example`;
- `docs/operations/runtime-environment-inventory.md`;
- `vercel.json`.

### Evidências da PV-3 antes do Handoff v10.5.0

- `Phase 2 Closure CI`: run `30930438283`, sucesso no SHA `2a5ac46d1c7cd248be6c46d53d2bc463690c38cd`.
- `Risk Lab CI`: run `30930438323`, sucesso no mesmo SHA.
- A atualização documental gera novo SHA e exige nova execução completa antes do merge.

## 8. Funcionalidades concluídas, parciais e pendentes

### Concluídas

- ingestão e normalização regulatória;
- reconciliação, QA, publicação e rollback;
- `RegulatoryDataService` como acesso canônico;
- score, Health, Validation, Admin e observabilidade;
- relatórios gratuito e Premium existentes;
- AI Insights e explicação opcional da carteira;
- Risk Lab Premium read-only;
- carteira, histórico manual e snapshots consolidados;
- sinais determinísticos e evidências da carteira;
- proposta Premium em validação;
- lista de interesse para o beta;
- entitlement beta server-side;
- telemetria pseudonimizada por audiência;
- rollback da descoberta Premium por feature flag.

### Parciais

- validação comercial: infraestrutura concluída, mas depende de tráfego e usuários externos reais;
- SEO técnico: canonicalização, sitemap, manifesto, `noindex` e páginas públicas já possuem base, mas a expansão editorial segmentada pertence à PV-3.5;
- Premium: recursos existem, porém preço, cobrança e checkout ainda não foram decididos;
- alertas: e-mail existe, unificação e política final ainda requerem evolução.

### Pendentes

- hub e páginas editoriais de mercado e segmentos;
- relatório incremental;
- acompanhar fundo fora da carteira, com 1 grátis e 10 Premium;
- validação de preço e forma de cobrança;
- checkout, recorrência e cancelamento;
- histórico avançado e atribuição;
- screener e comparador;
- alertas por WhatsApp ou Telegram;
- AdSense;
- grandes alterações visuais.

## 9. Decisões de segurança

- Firebase ID token é verificado e revogado no servidor para rotas Premium.
- Origem da requisição é validada antes de operações protegidas.
- `PREMIUM_BETA_UIDS` e `PREMIUM_BETA_EMAILS` são server-only.
- Nenhuma variável `NEXT_PUBLIC_*` concede plano, admin, beta, ownership ou allowlist.
- Solicitar beta não concede entitlement.
- O mesmo resolvedor server-side protege relatórios e recursos Premium.
- A flag `ENABLE_PREMIUM_DISCOVERY` falha fechado por padrão.
- Desligar a descoberta não remove entitlement Premium já existente.
- Lista de interesse e telemetria são coleções separadas.
- Telemetria não contém carteira, posições, cotas, patrimônio, dividendos, e-mail, token, cookie ou `ownerId` bruto.
- Eventos usam `subjectHash`, audiência, correlação e retenção declarada.
- Segredos não são versionados nem registrados em logs.
- PR `#168` continua bloqueada.
- Conteúdo editorial não pode transformar inferência em fato ou omitir data-base de cenário.

## 10. Variáveis de ambiente

### Descoberta Premium

- `ENABLE_PREMIUM_DISCOVERY`: habilita a proposta e a lista de interesse; padrão no código é `false`; rollback define `false`.
- `PREMIUM_BETA_UIDS`: UIDs Firebase autorizados manualmente no beta; server-only; vazio não libera ninguém por UID.
- `PREMIUM_BETA_EMAILS`: e-mails verificados autorizados manualmente no beta; server-only; vazio não libera ninguém por e-mail.
- `PREMIUM_PREVIEW_EMAILS`: exceção server-only preexistente para preview controlado.

### Segurança e infraestrutura

- `FIREBASE_SERVICE_ACCOUNT_KEY`;
- `ADMIN_EMAILS`;
- `CRON_SECRET`;
- `OPENAI_API_KEY` e modelos/tetos associados;
- `RESEND_API_KEY` e remetentes;
- tokens e chaves de mercado/planilhas;
- flags do Risk Lab e relatório automático.

O inventário completo, sem valores, permanece em `docs/operations/runtime-environment-inventory.md`. Toda variável nova exige classificação, fallback, rollback e teste. Nenhuma credencial da Search Console deve ser pública ou inserida no conteúdo editorial.

## 11. Testes obrigatórios

Cada PR funcional deve executar, no mesmo SHA:

1. instalação congelada de dependências;
2. governança do GitHub Actions;
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
14. E2E desktop/mobile;
15. Risk Lab completo quando o workflow for acionado.

Testes específicos da PV-3 devem provar:

- payload aceita somente origem e motivação allowlisted;
- campos extras do cliente são ignorados;
- pedido não libera acesso automaticamente;
- interesse permanece pendente até entitlement server-side;
- beta, Premium e proprietário são distinguidos no servidor;
- eventos não transportam dados financeiros ou identidade bruta;
- eventos possuem versão, audiência, correlação e retenção;
- rotas permanecem finas e sem Firestore direto;
- interface comunica “Em validação”, ausência de cobrança e ausência de garantia automática;
- nenhum request autenticado é disparado para usuário deslogado;
- desktop e mobile passam acessibilidade crítica.

Testes da PV-3.5 deverão incluir metadados, canonical, sitemap, dados estruturados, conteúdo específico por segmento, data-base, fontes, `noindex` de páginas insuficientes, links internos, acessibilidade, renderização e regressão das jornadas atuais.

Nenhuma validação manual substitui esses gates.

## 12. Pendências e decisões ainda abertas

- preço de cada plano;
- periodicidade mensal, anual, créditos ou pagamento avulso;
- provedor de cobrança;
- critérios quantitativos mínimos para avançar da validação à cobrança;
- tamanho e processo operacional da coorte beta;
- rotina de limpeza física dos eventos após a retenção declarada;
- painel administrativo da lista de interesse e métricas agregadas;
- estrutura final das URLs editoriais da PV-3.5;
- calendário editorial e frequência de atualização de cenários;
- fontes oficiais obrigatórias por categoria de conteúdo;
- uso futuro de WhatsApp ou Telegram;
- unificação final dos e-mails;
- ativação futura do AdSense;
- política de reembolso e inadimplência;
- implementação final do relatório incremental;
- regras detalhadas do acompanhamento de fundos fora da carteira;
- verificação separada de Preview e produção após cada merge.

A próxima execução oficial deve começar pela **PV-3.5 — SEO e Conteúdo de Mercado**, sem antecipar checkout, cobrança, WhatsApp, Telegram ou AdSense.
