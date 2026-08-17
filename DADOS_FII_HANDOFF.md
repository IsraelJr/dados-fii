Este documento substitui todos os planejamentos anteriores quando houver divergência.

# Dados FII — Documento Canônico de Handoff

**Versão:** 10.8.1
**Data:** 17/08/2026
**Repositório:** `IsraelJr/dados-fii`  
**Branch principal:** `main`  
**PR de encerramento da versão anterior:** `#189`
**PR corretiva desta versão:** `#190`
**SHA final da `main` antes da correção documental:** `df1d0bbeea9afc1021a89b950b618f1672a22727`
**CI da `main` final:** `Phase 2 Closure CI` — run `32052213156` — sucesso
**Produção no SHA final:** Vercel deployment `5948464030` — `success`; `Risk Lab Premium Production Gate` — run `32052314513` — sucesso; `Production Premium Smoke` — run `32052314449` — sucesso
**Fase vigente:** `Produto Validável`  
**Sprint funcional atual:** PV-6 — validação de preço e cobrança
**Trilha transversal paralela:** SEO-S1A → SEO-S1B → SEO-S2 → SEO-S3 → SEO-S4

## Decisões vigentes que substituem decisões anteriores

| Decisão vigente | Decisão substituída | Efeito |
|---|---|---|
| PV-1, PV-2A, PV-2B, PV-2C, PV-3, PV-3.5, PV-4 e PV-5 ficam formalmente concluídas após o merge da PR `#189`. | O Handoff v10.8.0 ainda tratava a integração da PR `#189` como etapa futura. | A `main` final da PV-5 é `df1d0bbeea9afc1021a89b950b618f1672a22727`; a sprint funcional atual passa a ser PV-6. |
| PR `#185` concluiu o saneamento do `nanoid` no lockfile e PR `#186` concluiu a dívida de determinismo temporal. | Esses dois bloqueadores precediam a integração segura da PV-4. | Segurança de dependência e relógio determinístico são pré-requisitos concluídos da PV-4. |
| O hotfix de recuperação da sessão da carteira fica concluído pela PR `#188`, antes da PV-5. | Presença de token no navegador era tratada como sessão válida. | Todo 401 autenticado converge para recuperação central, preservando carteira, snapshots e histórico. |
| A PR `#184` publica a decisão do Copom de agosto de 2026 com fonte oficial permanente e datas editoriais separadas. | A versão anterior usava uma página mutável e confundia data-base, publicação e modificação. | Comunicado, ata, metadata, JSON-LD e sitemap ficam coerentes, sem tratar a continuidade da flexibilização como mudança de direção. |
| A PV-5 fica concluída pela PR `#189`, com Radar separado da carteira e limites server-side de 1 fundo Grátis e 10 Premium. | Acompanhamento de fundo fora da carteira estava somente planejado. | Usuário acompanha fundos sem criar posição; concorrência, downgrade, deduplicação, monitor e rollback são tratados deterministicamente. |
| A produção da `main` final da PV-5 está comprovada no SHA `df1d0bbeea9afc1021a89b950b618f1672a22727`. | O Handoff v10.8.0 mantinha ressalvas de produção ainda não verificada. | O deployment Vercel `5948464030`, o `Risk Lab Premium Production Gate` `32052314513` e o `Production Premium Smoke` `32052314449` concluíram com sucesso no mesmo SHA. |
| A branch `main` exige o check interno `validate`, em modo estrito e também para administradores. | O merge já havia sido possível com CI vermelho. | O gate canônico interno bloqueia integração; status externo de quota Vercel não foi tornado obrigatório. |
| O hub `/mercado` e sete páginas segmentadas são a superfície editorial oficial desta fase. | SEO editorial ainda não possuía rotas próprias. | Mercado de FIIs, FIAGRO, logística, shoppings, escritórios, recebíveis e renda urbana têm conteúdo específico, data-base e fontes. |
| Página editorial desconhecida ou sem qualidade mínima não é publicada nem indexada. | Uma rota dinâmica poderia gerar conteúdo raso por fallback. | O registro editorial é allowlistado e slug desconhecido retorna 404 real. |
| Telemetria editorial é anônima, mínima e retida por 90 dias. | Eventos editoriais poderiam reutilizar identidade ou dados financeiros. | Nenhum evento contém e-mail, `ownerId`, carteira, posição, ticker, dividendo, patrimônio, token ou cookie. |
| SEO volta a ser requisito contínuo e paralelo, na sequência SEO-S1A → SEO-S1B → SEO-S2 → SEO-S3 → SEO-S4. | A conclusão da PV-3.5 podia ser interpretada como encerramento de todo o SEO. | A PV-3.5 entregou uma parte relevante da trilha, mas Search Console, baseline, páginas prioritárias, diferenciação e autoridade continuam com estado próprio. |
| Toda funcionalidade nova com expressão pública útil avalia SEO na própria sprint. | SEO poderia se acumular para uma sprint funcional exclusiva posterior. | Metadata, canonical, indexabilidade, SSR, schema, links internos, intenção de busca, CTA e medição são avaliados junto da funcionalidade aplicável; não existe sprint exclusiva de SEO. |
| PV-2D — Painel Executivo/score explicável volta ao roadmap como pendência de reconciliação funcional. | PV-2D desapareceu do roadmap sem decisão explícita de conclusão ou cancelamento. | Primeiro se audita quanto já existe; somente depois se decide o delta e seu encaixe, sem implementar nada nesta correção documental. |
| PV-9 volta a ser separada em PV-9A e PV-9B, e PV-10 volta ao roadmap futuro. | O Handoff v10.8.0 reuniu comparador e fair value em uma única PV-9 e omitiu a análise técnica secundária. | Screener/comparador/filtros salvos ficam separados de fair value/sustentabilidade por categoria; análise técnica permanece futura, secundária e isolada do score fundamental. |
| Google AdSense continua congelado. | SEO poderia ser confundido com antecipação de anúncios. | O objetivo é tráfego qualificado e utilidade; publicidade não integra esta entrega. |
| PV-6 pode avançar qualitativamente com baixo tráfego, mas sua leitura quantitativa depende de amostra externa mínima. | Baixa aquisição poderia ser interpretada como rejeição representativa de conversão ou preço. | Entrevistas, proposta de valor e testes qualitativos avançam; conversão e disposição a pagar só sustentam decisão quantitativa quando o denominador externo for suficiente e explícito. |
| PV-7 permanece condicionada à evidência comercial produzida pela PV-6. | Checkout poderia ser antecipado sem validação suficiente. | Interesse, beta e uso continuam separados de pagamento e entitlement comercial; ausência de amostra não autoriza cobrança. |
| O Handoff v10.8.1 é a única fonte canônica ativa. | Handoff v10.8.0 e anteriores. | Este documento prevalece em caso de divergência. |

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
- PR `#188` conclui o hotfix de recuperação da sessão da carteira sobre a main da PV-4.
- O SHA funcional `6f926decaafc77e8bac85ab352b242feeb5af1d8` passou instalação congelada, governança, Handoff, auditoria, secret scan, lint, TypeScript, 868 testes, Firestore Rules/Emulator, cobertura crítica, mutation, build, smoke HTTP e 50 E2E desktop/mobile com acessibilidade no run `32044107480`.
- A causa raiz do hotfix era considerar a presença local do token como prova de sessão válida. A política central agora remove somente a credencial rejeitada, interrompe consumidores autenticados e oferece novo código sem apagar e-mail, carteira, snapshots ou histórico manual.
- Troca de sessão entre abas só libera consumidores depois da validação server-side, evitando uso antecipado do token e requisições duplicadas.
- PR `#184` consolidou o comunicado da 280ª reunião do Copom e a ata de 11/08/2026 em fontes permanentes do Banco Central, mantendo Selic de 14,00% a.a. e corte de 0,25 p.p. como fatos oficiais; foi integrada no merge `81ba4811b82c6ffc2955595b6570b9353d85626a`.
- O SHA funcional `095907087087abd4f8f46dad8e30c0f319792773` passou instalação congelada, governança, Handoff, auditoria, secret scan, lint, TypeScript, suíte completa, Firestore Rules/Emulator, cobertura crítica, mutation, build, smoke HTTP e 52 E2E desktop/mobile com acessibilidade no run `32046295007`.
- Página, metadata, JSON-LD e sitemap usam separadamente data-base `2026-08-05`, `datePublished` `2026-08-05` e `dateModified` `2026-08-17`; os testes editoriais analisam o conteúdo final transformado.
- PR `#189` conclui a PV-5 em uma branch limpa sobre a main consolidada, sem misturar sessão, cobrança ou checkout.
- O SHA funcional `f4e604d596bb70a1f20db67bf9fc72ae20ef2647` passou instalação congelada, governança, Handoff, auditoria, secret scan, lint, TypeScript, 904 testes descobertos com 901 aprovados e 3 skips de infraestrutura, Firestore Rules/Emulator, cobertura crítica, mutation, build, smoke HTTP e 58 E2E desktop/mobile com acessibilidade no run `32051239202`.
- A PR `#189` foi mergeada em `main` em 17/08/2026, gerando o SHA final `df1d0bbeea9afc1021a89b950b618f1672a22727`.
- O SHA final `df1d0bbeea9afc1021a89b950b618f1672a22727` passou o `Phase 2 Closure CI` no run `32052213156`.
- A produção foi comprovada no mesmo SHA: o deployment Vercel `5948464030` concluiu em `success`, o `Risk Lab Premium Production Gate` passou no run `32052314513` e o `Production Premium Smoke` passou no run `32052314449`.
- O Radar usa recurso próprio por usuário, transação Firestore, entitlement server-side, limite atômico 1/10, reconciliação com carteira e downgrade sem apagar registros.
- Atualizações usam fingerprint determinístico; replay e cron concorrente não duplicam notificação, e IA não é executada automaticamente.
- A feature flag `ENABLE_FUND_RADAR` é server-only e fail-closed; desligá-la bloqueia APIs, monitor e UI sem apagar acompanhamentos.
- A proteção da `main` exige o check `validate`, com `strict=true` e `enforce_admins=true`; Vercel não integra os checks obrigatórios por ser dependência externa sujeita a quota.
- PR `#170` continua fechada sem merge, substituída pela implementação limpa da PR `#178`.
- PRs `#168`, `#179`, `#1` e `#2` foram fechadas sem merge como legado, substituídas ou obsoletas; nenhum delta funcional necessário permaneceu nelas.
- A PV-4 reconstrói entrada financeira server-side, mantém referência versionada e transacional, trata replay, concorrência e stale write e deixa a IA somente como explicadora opcional.
- A revisão adicional corrigiu a janela histórica para os 120 meses mais recentes, preservou renda conhecida igual a zero, tornou o rollback fail-closed durável durante remount da mesma aba e eliminou atualização redundante de posição idêntica.
- O trabalho funcional atual é a PV-6 — validação de preço e cobrança; PV-7 continua responsável por checkout e entitlement comercial e somente pode começar após evidência comercial suficiente da PV-6.
- A validação qualitativa da PV-6 pode avançar com recrutamento direto e baixo tráfego. Resultados quantitativos de conversão ou preço não são representativos sem amostra externa mínima, denominador explícito e origem de aquisição registrada.
- SEO continua em paralelo à PV-6 e às sprints seguintes; a PV-3.5 não encerrou a trilha orgânica.

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
| PV-3.5 — SEO e Conteúdo de Mercado | Entrega funcional concluída pela PR `#182`; não encerra a trilha SEO contínua |
| PV-4 — relatório incremental | Concluída com o merge da PR `#187` |
| Hotfix — recuperação da sessão da carteira | Concluído pela PR `#188` |
| Atualização editorial — Copom agosto de 2026 | Concluída pela PR `#184` |
| PV-5 — Radar/Acompanhar fundos | Concluída pela PR `#189` |
| Produção da `main` final da PV-5 | Comprovada no SHA `df1d0bbeea9afc1021a89b950b618f1672a22727` |
| PV-6 — validação de preço e cobrança | Sprint funcional atual |
| PV-2D — Painel Executivo/score explicável | Pendente de reconciliação funcional; auditar antes de decidir delta |
| SEO-S1A → SEO-S4 | Trilha transversal contínua e paralela; estados detalhados na seção 3 |
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

**Estado funcional:** concluída com o merge da PR `#182`. Esta conclusão registra a entrega do hub e dos cenários editoriais, não o encerramento da trilha SEO contínua.

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

A PV-3.5 absorveu parte relevante de SEO-S1B e SEO-S2. Ela não comprova, por si só, Search Console operacional com baseline, seleção e cobertura editorial dos aproximadamente 20 fundos prioritários, histórico público sanitizado por fundo, comparações públicas, autoridade ou distribuição.

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

### Hotfix — recuperação da sessão da carteira

**Estado:** concluído pela PR `#188`.

Inclui validação explícita no servidor, estado de sessão separado da presença do token, invalidação central de 401 restrita à geração rejeitada, recuperação por novo código, coordenação entre abas e preservação integral da carteira, snapshots e histórico local. Autosave, autoload, relatório de risco e análise incremental param de usar a credencial rejeitada e retomam somente após uma nova sessão válida.

### PV-5 — Radar/Acompanhar fundo fora da carteira

**Estado:** concluída pela PR `#189`.

Inclui recurso próprio separado da posição de carteira, limites server-side de 1 fundo no Grátis e 10 no Premium, criação idempotente, concorrência atômica, isolamento, remoção, notificações opcionais, downgrade sem exclusão, reconciliação determinística quando o fundo entra na carteira, dados canônicos, ausência diferente de zero, atualizações materialmente novas com fingerprint e monitor reaproveitado sem custo automático de IA. A UI cobre desktop/mobile e expõe qualidade, data-base, dividendos, eventos, riscos e dados insuficientes sem recomendação de compra ou venda.

## 3. Sprint atual

### PV-6 — Validação de preço e cobrança

**Estado:** sprint funcional atual, sem checkout.

**Objetivo:** testar proposta de valor, embalagem, preço, periodicidade e disposição a pagar antes de implementar cobrança.

A validação qualitativa pode avançar mesmo com baixo tráfego, por entrevistas, recrutamento direto e testes de proposta. A validação quantitativa de conversão ou preço não deve ser tratada como representativa sem amostra externa mínima, denominador explícito e origem de aquisição registrada. Baixa aquisição não equivale a rejeição de preço.

PV-7 permanece bloqueada até que a PV-6 registre evidência comercial suficiente e uma decisão explícita. PV-6 não cria checkout, cobrança, recorrência ou entitlement comercial.

### Trilha SEO contínua e paralela

**Sequência vigente:** SEO-S1A → SEO-S1B → SEO-S2 → SEO-S3 → SEO-S4.

Esta trilha acompanha o desenvolvimento funcional e não forma uma sprint exclusiva. Toda nova funcionalidade que possua expressão pública útil deve avaliar, dentro da própria sprint, metadata, canonical, indexabilidade, renderização server-side, schema quando aplicável, links internos, intenção de busca, CTA e medição de conversão.

| Etapa | Estado reconciliado | Próxima obrigação |
|---|---|---|
| SEO-S1A — inventário e baseline operacional | Parcial; requer reconciliação operacional | Confirmar Search Console, indexação, baseline de impressões, cliques, CTR e posição, calendário/intenção de busca e priorização dos aproximadamente 20 fundos. |
| SEO-S1B — fundação técnica e templates | Parcialmente absorvida pela PV-3.5 | Auditar cobertura real de canonical, sitemap, robots, schemas, SSR, links internos, Core Web Vitals e indexabilidade nas páginas individuais de fundos. |
| SEO-S2 — páginas prioritárias | Parcial | O hub e sete páginas segmentadas existem; selecionar os aproximadamente 20 fundos e comprovar conteúdo individual substancial, único, rastreável e útil. PV-2D permanece uma dependência a reconciliar para o painel executivo/score explicável. |
| SEO-S3 — diferenciação | Parcialmente habilitada | PV-4 e PV-5 criaram capacidades privadas, mas não comprovam histórico público sanitizado por fundo, comparações, buscas de alta intenção ou automação editorial revisada. Incorporar o componente público às sprints funcionais correspondentes, incluindo PV-9A. |
| SEO-S4 — autoridade e distribuição | Futura | Estudos originais, distribuição legítima, referências externas e revisão de 90 dias; nenhuma compra de links. |

Search Console deve ter acompanhamento operacional recorrente de indexação, impressões, cliques, CTR, posição, consultas, páginas de entrada e conversão para cadastro, Radar e carteira. Baseline e mudanças de período precisam registrar data e denominador; credenciais permanecem fora do repositório e do cliente.

## 4. Ordem oficial das próximas sprints

1. **PV-6 — Validação de preço e cobrança.**
2. **PV-2D — Painel Executivo/score explicável: reconciliação funcional antes de decidir o delta e seu encaixe.**
3. **PV-7 — Checkout, recorrência, cancelamento e entitlement comercial, somente após evidência comercial suficiente da PV-6.**
4. **PV-8 — Carteira histórica avançada, retorno total e atribuição.**
5. **PV-9A — Screener, comparador de pares e filtros salvos.**
6. **PV-9B — Fair value e sustentabilidade por categoria.**
7. **PV-10 — Análise técnica secundária, futura e isolada do score fundamental.**

PV-2D não está autorizada para implementação nesta correção: primeiro deve ser auditado quanto do painel executivo do fundo já existe, o que foi absorvido por outras entregas e qual delta permanece. Só então seu escopo e posição de implementação podem ser decididos.

A trilha SEO-S1A → SEO-S4 ocorre em paralelo a toda a sequência. Ela não altera a numeração funcional e não cria uma sprint exclusiva de SEO.

AdSense, WhatsApp, Telegram e grandes mudanças visuais continuam adiados.

## 5. Escopo e critérios de aceite de cada sprint

### PV-4 — Relatório incremental

**Concluída pela PR `#187`.** Compara estados versionados, destaca somente mudanças materiais, preserva evidência e não usa IA para decidir se uma mudança financeira ocorreu.

### PV-5 — Acompanhar fundo fora da carteira

**Concluída pela PR `#189`.** Permite acompanhar fundo sem transformá-lo em posição, aplica limite server-side de 1 fundo no Grátis e 10 no Premium, deduplica atualizações e preserva explicitamente qualidade, fonte, data-base e dados insuficientes sem recomendação de compra.

### PV-2D — Painel Executivo/score explicável

**Estado:** pendente de reconciliação funcional, sem implementação autorizada por este Handoff corretivo.

- auditar quanto já existe em páginas de fundos, score, confiança, idade e qualidade dos dados, decomposição, risco, sustentabilidade da renda, faixa de valor quando justificável e fatos que mudariam a tese;
- distinguir o painel público de um fundo da inteligência privada da carteira entregue em PV-2B;
- mapear dependências e cobertura de dados, incluindo a relação com SEO-S2;
- decidir somente após a auditoria se existe delta, qual é seu escopo e onde entra no roadmap;
- não reconstruir nem declarar concluído o que já existir de forma comprovada.

### PV-6 — Validação de preço e cobrança

- testar preço, periodicidade e disposição a pagar;
- comparar recorrência, créditos e pagamento avulso;
- avançar em entrevistas, proposta de valor, embalagem e testes qualitativos mesmo com baixo tráfego;
- definir amostra externa mínima, denominador, origem de aquisição e critério de representatividade antes de interpretar conversão ou preço quantitativamente;
- não tratar ausência de tráfego como rejeição comercial;
- registrar decisão comercial antes de qualquer checkout.

### PV-7 — Checkout e assinaturas

- implementar somente após a PV-6 produzir evidência comercial suficiente e decisão registrada;
- incluir recorrência, cancelamento, reembolso e comunicação transparente;
- webhooks autenticados e idempotentes;
- entitlement exclusivamente server-side;
- falha de cobrança não apaga carteira ou histórico.

### PV-8 — Histórico avançado, retorno e atribuição

- separar retorno total, dividendos, valorização, aportes e atribuição;
- versionar competência, caixa e custo médio;
- reconciliar e migrar sem perda de histórico;
- explicitar período, benchmark e cobertura.

### PV-9A — Screener, comparador de pares e filtros salvos

- screener, comparador e filtros salvos;
- dados insuficientes permanecem explícitos;
- ranking não esconde qualidade, liquidez ou limitações da fonte.

### PV-9B — Fair value e sustentabilidade por categoria

- usar modelos e premissas específicos por categoria, nunca fórmula única para todos os segmentos;
- apresentar faixa, confiança, cobertura, fontes e fatores que invalidam o modelo;
- separar fato, cálculo, estimativa e inferência;
- não avançar quando a cobertura mínima de dados não estiver comprovada.

### PV-10 — Análise técnica secundária

- permanecer futura, opcional e secundária;
- ficar isolada do score fundamental e não alterar regras, sinais ou fatos fundamentais;
- explicitar janela, fonte, limitações e natureza técnica dos indicadores;
- não produzir recomendação automática de compra ou venda.

Cada sprint exige escopo fechado, testes automatizados, Preview, produção e evidência antes de ser marcada como concluída.

Além desses critérios, toda sprint que crie ou amplie superfície pública deve avaliar e entregar o componente SEO aplicável na própria sprint, ou registrar de forma explícita por que ele não se aplica. SEO não deve ser acumulado para uma sprint exclusiva posterior.

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
27. Radar e carteira são recursos separados; fundo comprado deixa de consumir limite do Radar sem apagar histórico.
28. Limite, downgrade, deduplicação e entitlement do Radar são decididos no servidor e persistidos atomicamente.
29. Toda nova funcionalidade pública avalia SEO na própria sprint: metadata, canonical, indexabilidade, SSR, schema quando aplicável, links internos, intenção de busca, CTA e medição.
30. Nenhuma etapa SEO autoriza página rasa, geração em massa sem revisão, credencial pública, recomendação financeira ou relaxamento dos gates de segurança.
31. Análise técnica futura permanece secundária e isolada do score fundamental.

## 7. Arquivos, branches, commits e PRs existentes

### Referências atuais

- Repositório: `IsraelJr/dados-fii`.
- Branch principal: `main`.
- Branch corretiva do Handoff v10.8.1: `agent/handoff-v10-8-1-correction`.
- Branch da PV-4: `agent/pv4-reconciliation`.
- Branch da PV-5: `agent/pv5-fund-radar`.
- PR `#177`: PV-2A, mergeada.
- PR `#178`: PV-2B, mergeada.
- PR `#180`: PV-2C, mergeada.
- PR `#181`: PV-3, mergeada no commit `38e1aa803d62f88c249ca29ff6d919efd8125ad4`.
- PR `#182`: PV-3.5 e Handoff v10.6.0, mergeada.
- PR `#185`: saneamento do `nanoid`, mergeada em `025ced8f8fb42c204f380e96827c2f073bd8d115`.
- PR `#186`: determinismo temporal, mergeada em `f8101234359fa27c41e263e9dfa67bafd4c4572c`.
- PR `#187`: PV-4 e Handoff v10.7.0, mergeada em `e5f21f7b78f80561ad2836b5b9e7a578bcf62317`.
- PR `#188`: hotfix de recuperação da sessão e Handoff v10.7.1, mergeada em `14a81f919928f91ab221a25ab73b1136cbf2b883`.
- PR `#184`: atualização editorial do Copom e Handoff v10.7.2, mergeada em `81ba4811b82c6ffc2955595b6570b9353d85626a`.
- PR `#189`: PV-5 e Handoff v10.8.0, mergeada em `df1d0bbeea9afc1021a89b950b618f1672a22727`.
- PR `#190`: correção exclusivamente documental do Handoff v10.8.1; merge somente após os gates documentais/canônicos verdes no mesmo SHA.
- PR `#183`: fechada sem merge e substituída pela PR limpa `#187`.
- PR `#170`: fechada sem merge.
- PRs `#168`, `#179`, `#1` e `#2`: fechadas sem merge após reconciliação como legado, substituídas ou obsoletas.

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

### Arquivos centrais da PV-5

- `src/lib/fund-radar/FundRadar.ts`;
- `src/lib/fund-radar/FundRadarService.ts`;
- `src/lib/fund-radar/FundRadarObservation.ts`;
- `src/server/repositories/FirestoreFundRadarRepositoryCore.ts`;
- `src/server/controllers/FundRadarControllerCore.ts`;
- `src/app/api/fund-radar/route.ts`;
- `src/app/components/FundRadarPanel.tsx`;
- `src/server/services/FundRadarBatchRuntime.ts`;
- `tests/firestore-fund-radar-repository.test.ts`;
- `tests/e2e/fund-radar.spec.ts`.

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
- recuperação de sessão inválida sem reload obrigatório ou perda de carteira, snapshots e histórico.
- atualização editorial do Copom de agosto de 2026 com fonte oficial permanente, datas SEO coerentes e conteúdo final sem recomendação direta.
- Radar de fundos separado da carteira, com limites server-side 1/10, concorrência atômica, downgrade conservador, deduplicação, monitor e rollback.

### Parciais

- Premium possui recursos e beta, mas preço e cobrança ainda não foram validados;
- páginas de fundos continuam dependentes do gate editorial individual;
- SEO-S1A requer reconciliação operacional de Search Console, baseline e priorização dos aproximadamente 20 fundos;
- SEO-S1B foi parcialmente absorvida pela PV-3.5, mas a cobertura técnica das páginas individuais de fundos ainda deve ser auditada;
- SEO-S2 possui hub e páginas de segmentos, mas o conjunto de fundos prioritários e seus conteúdos individuais superiores não está comprovado como concluído;
- SEO-S3 foi parcialmente habilitada por PV-4 e PV-5, sem comprovar histórico público sanitizado, comparações e buscas de alta intenção;
- PV-2D aguarda reconciliação funcional antes de qualquer decisão de implementação.

### Pendentes

- validação de preço;
- definição da amostra externa mínima e dos critérios quantitativos da PV-6;
- checkout e assinaturas, condicionados à evidência comercial da PV-6;
- histórico avançado e retorno total;
- screener, comparador de pares e filtros salvos na PV-9A;
- fair value e sustentabilidade por categoria na PV-9B;
- análise técnica secundária na PV-10;
- SEO-S4 — autoridade, distribuição legítima e revisão de 90 dias;
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
- 401 autenticado remove somente a geração rejeitada da sessão da carteira e interrompe consumidores até nova validação;
- acompanhamento de fundo não aparece em logs ou telemetria com UID, e-mail, ticker ou valores financeiros;
- limite e plano do Radar nunca são aceitos do navegador; o servidor resolve entitlement e serializa concorrência;
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
- `ENABLE_FUND_RADAR`;
- `PREMIUM_BETA_UIDS`;
- `PREMIUM_BETA_EMAILS`;
- `PREMIUM_PREVIEW_EMAILS`.

A PV-3.5 não adiciona credencial de Search Console nem variável pública com poder de indexação. O registro editorial versionado decide quais páginas existem; o sitemap só inclui páginas allowlistadas e válidas. A operação de Search Console usa credenciais fora do repositório e não altera entitlement, dados financeiros ou privacidade.

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

Para uma PR exclusivamente documental e canônica, executar no mesmo SHA ao menos o teste canônico do Handoff, a governança de workflows e a verificação de integridade do diff. Os demais gates continuam obrigatórios quando a automação canônica os acionar; nenhuma alteração documental pode enfraquecer os gates das PRs funcionais.

## 12. Pendências e decisões ainda abertas

- preço inicial do Premium e do Super Premium;
- mensalidade, créditos, pagamento avulso ou combinação;
- amostra externa mínima, denominador e critério de representatividade para conversão e preço;
- evidência comercial suficiente da PV-6 para autorizar ou não a PV-7;
- provedor de pagamento e regras de reembolso;
- cadência editorial e responsável por atualização dos cenários;
- configuração/validação operacional do Google Search Console e registro da baseline de indexação, impressões, cliques, CTR e posição;
- acompanhamento recorrente de consultas, páginas de entrada e conversão orgânica para cadastro, Radar e carteira;
- seleção e priorização dos aproximadamente 20 fundos de SEO-S2 por busca, liquidez, usuários e relevância;
- auditoria da cobertura de SEO-S1B nas páginas individuais de fundos;
- reconciliação funcional da PV-2D antes de decidir qualquer delta ou implementação;
- WhatsApp ou Telegram para alertas, mantendo consentimento, custo e privacidade;
- eventual AdSense, ainda congelado;
- implementação futura e isolada de PV-9A, PV-9B e PV-10 conforme seus gates próprios.

Nenhuma dessas decisões abertas autoriza checkout, anúncio, mensagem externa, mudança visual ampla ou mudança de entitlement sem sprint própria, testes e registro canônico. SEO permanece transversal e paralelo ao produto; não deve ser convertido em sprint funcional exclusiva.
