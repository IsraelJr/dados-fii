Este documento substitui todos os planejamentos anteriores quando houver divergência.

# Dados FII — Documento Canônico de Handoff

**Versão:** 6.14.0  
**Data:** 26/07/2026  
**Repositório:** `IsraelJr/dados-fii`  
**Branch principal:** `main`  
**Base funcional auditada:** `a3b4f2c010fba3e62e52ed50b8fcacf2706474d2`  
**Estado da Fase 3:** formalmente concluída  
**Próxima unidade de trabalho:** 4.1 — Radar Core: acompanhar fundo fora da carteira  
**Trilha paralela autorizada:** SEO-S1, sem alterar a ordem funcional  
**Política documental:** existe somente um Handoff canônico versionado no repositório: `DADOS_FII_HANDOFF.md`.

## Como interpretar os status

- **Planejada:** decisão registrada, sem implementação iniciada.
- **Em implementação:** existe branch, issue ou PR ativa, mas os critérios ainda não foram atingidos.
- **Implementada:** existe código ou evidência versionada.
- **Testada:** existem testes automatizados no mesmo SHA.
- **Implantada:** o commit exato possui deployment aplicável identificado e saudável.
- **Formalmente concluída:** código, testes, cobertura, segurança, evidência, merge, auditoria pós-merge, produção e atualização deste Handoff foram comprovados.
- **Inconclusiva:** a evidência não permite afirmar sucesso nem falha sem inventar informação.

Uma validação pontual, confirmação verbal, workflow verde isolado ou teste em poucos tickers não conclui uma fase.

## Decisões vigentes que substituem decisões anteriores

| Decisão vigente | Decisão substituída | Estado | Evidência ou motivo |
|---|---|---|---|
| Este Handoff v6.14.0 é a única referência canônica quando houver divergência. | Handoffs paralelos, cópias antigas e versões anteriores. | Vigente | Evita decisões concorrentes. |
| Fases 1, 2 e 3 estão formalmente concluídas. | Fase 3 bloqueada por deployment ou ativação. | Concluída | Produção e gate automatizado aprovados no SHA `a3b4f2c010fba3e62e52ed50b8fcacf2706474d2`. |
| A Sprint 3.7 está implantada e ativa em produção somente em modo read-only. | Integração apenas em Preview ou flag desligada no ambiente. | Concluída | `Vercel=success` e `Risk Lab Premium Production Gate=success`. |
| O código continua fail-closed com padrão `false`; o deployment habilita explicitamente a leitura Premium. | Flag implicitamente ativa em qualquer ambiente. | Vigente | Rollout reversível e testado. |
| Notificações e efeitos externos do Risk Lab continuam proibidos. | Ativação automática de alertas junto com o Premium. | Vigente | Invariantes verificadas em código, CI e produção. |
| MCCI11 permanece `inconclusive_unscored`. | Classificar MCCI11 por semelhança ou preencher lacuna. | Vigente | Não há evidência suficiente para pontuação honesta. |
| Correções de parser, cálculo e normalização são gerais e testadas. | Patch especial por ticker. | Obrigatória | O problema deve ser resolvido para todo o universo aplicável. |
| A próxima entrega funcional é 4.1 Radar Core; SEO-S1 pode avançar em paralelo. | SEO como bloqueador obrigatório antes do Radar. | Vigente | Prioriza valor de produto sem abandonar a trilha orgânica. |
| Radar usa ciclos de 30 dias: Grátis 1 ticker distinto; Premium até 10; remover não devolve limite. | Limite simples de itens simultâneos no navegador. | Planejada para 4.1 | Entitlement precisa ser persistente e validado no servidor. |
| “Salvar para depois” não consome Radar; “Adicionar ao Radar Inteligente” consome limite, gera relatório e inicia acompanhamento. | Um único comando para favoritos e acompanhamento. | Planejada para 4.1 | Separa intenção leve de benefício Premium. |
| Alertas do Radar pertencem à 4.2, não à 4.1. | Criar watchlist e alertas no mesmo primeiro corte. | Vigente | Reduz risco, custo e ruído no MVP. |
| Mês corrente nunca entra como mês fechado em consolidações históricas. | Mês aberto tratado como fechado. | Decidida; PR #65 pendente | Evita divergência entre navegador, snapshot e histórico. |
| Alertas exigem mudança material; baixa urgência pode virar digest. | Alertas diários repetidos sem alteração. | Parcial | Reduz falso alerta e fadiga. |
| Se rendimentos pagos ou anunciados não mudaram, patrimônio precisa variar pelo menos 3% para notificar; o limite é configurável para planos não grátis. | Notificação diária por simples reprocessamento. | Decidida | Valor padrão: 3%. |
| IFIX segue janeiro, maio e setembro, com execução manual no Admin. | Sincronização diária. | Parcial | Menor custo sem perda funcional. |
| Telegram permanece adiado; WhatsApp continua decisão aberta. | Multicanal imediato. | Vigente | Depende de custo, opt-in, templates e limites. |

---

## 1. Estado atual do projeto

### Resumo executivo

- Fase 1 — Regulatory Engine: formalmente concluída.
- Fase 2 — Core Intelligence & Product Foundation: formalmente concluída.
- Fase 3 — Risk Lab: formalmente concluída.
- Risk Lab 3.0–3.4 e reorganização 3.5-R estão concluídos.
- Fases 3.5-A/DEVA11, 3.5-B1/VSLH11, 3.5-B2/KNCR11, 3.5-B3/KNSC11, 3.5-B4/MCCI11, 3.5-B5/RBRY11 e 3.5-C/dataset e backtest estão formalmente concluídas.
- O backtest da 3.5-C consolidou 318 observações: 3 verdadeiros positivos, 1 verdadeiro negativo, 1 falso positivo, 0 falsos negativos e 1 inconclusivo.
- Cobertura da 3.5-C: 83,33%; lead time médio: 220,52 dias.
- A Sprint 3.6 homologou o ruleset `0.2.0` com 100% de acurácia nos cinco casos verificáveis, zero falso positivo e zero falso negativo.
- MCCI11 permanece `inconclusive_unscored`, fora da otimização e das métricas pontuadas.
- A Sprint 3.7 integrou o registro `premium-readonly-v1`, Prompt Premium `premium-fund-analysis-v3` e Modo Gestor `premium-manager-mode-v3`.
- A configuração de produção habilita `ENABLE_RISK_LAB_PREMIUM_READONLY=true`; o código mantém fallback padrão `false`.
- O SHA `a3b4f2c010fba3e62e52ed50b8fcacf2706474d2` recebeu `Vercel=success` e `Risk Lab Premium Production Gate=success`.
- O workflow de produção confirmou o mesmo SHA implantado, modo read-only, ruleset `0.2.0`, registro `premium-readonly-v1`, notificações bloqueadas e efeitos externos bloqueados.
- A evidência final está em `docs/production-evidence/risk-lab/phase-3-production-closure.json`.
- Nenhuma validação manual do usuário é necessária para encerrar a Fase 3.

### Auditoria do estado

| Área | Código/evidência | Testes | Produção | Status |
|---|---:|---:|---:|---|
| Fase 1 — Regulatory Engine | Sim | Sim | Sim | **Formalmente concluída** |
| Fase 2 — Core Intelligence | Sim | Sim | Sim | **Formalmente concluída** |
| Risk Lab 3.0–3.4 | Sim | Sim | Sim | **Formalmente concluído** |
| Sprint 3.5 — coorte e backtest | Sim | Sim | Sem efeito externo | **Formalmente concluída** |
| Sprint 3.6 — calibração | Sim | Sim | Sem efeito externo | **Formalmente concluída** |
| Sprint 3.7 — integração Premium read-only | Sim | Sim | Gate pós-deploy aprovado | **Formalmente concluída** |
| Fase 3 completa | Sim | Sim | SHA e invariantes validados | **Formalmente concluída** |
| Regra de meses encerrados | PR #65 | Requer revalidação | Não integrada | **Em implementação** |
| SEO-S1 | Plano | n/a | Não iniciado | **Trilha paralela planejada** |
| Radar/Acompanhar fundo | Especificação | Não | Não | **Próxima unidade funcional** |

### Pendências de dados conhecidas

- Lacuna externa permanece `null`, acompanhada de fonte, data e aviso; nunca vira zero inventado.
- Dados PF/PJ não publicados continuam sinalizados como indisponíveis.
- “Maior cotista PJ” é opcional e nunca deve ser inventado.
- Divergências históricas de ISIN permanecem sob revisão nos casos documentados.
- Ativos inativados, incorporados ou com troca de ticker preservam histórico, identidade e evidência oficial.
- Dados novos devem usar fontes oficiais, sem redundância desnecessária e com normalização auditável.

---

## 2. Fases concluídas

### Fase 1 — Regulatory Engine

Concluída: parser CVM v2, suporte FII/FIAGRO, reconciliação, QA, staging/produção, backup, hash, publicação protegida e rollback.

### Fase 2 — Core Intelligence & Product Foundation

Concluída: `RegulatoryDataService`, repositório, normalização, validação, cache, tipos, `ScoreEngine`, Health, Validation, Admin, Timeline, relatórios, AI Insights, observabilidade, monitor, catálogo, notificações e jobs.

A conclusão não se baseia apenas em TGAR11, VGIA11, MXRF11, KNCA11 ou BODB11; exige regressões globais e cobertura do universo aplicável.

### Fase 3 — Risk Lab

#### Evidência canônica 3.5-A — DEVA11

- PR #105; merge `498654f03ce66bd54598d5a4677c18bbe5bbdc86`;
- documentos classificados: 85/85;
- observações brutas: 67; competências: 65;
- lacuna explícita: `2024-07`;
- pendências e conflitos: zero;
- índice: `62a19d9b20b57b49489d7ab51ed85d72505625ca68f47762a5045fc3c650993b`.

#### Evidência canônica 3.5-B1 — VSLH11

- issue #111; PR #112; merge `1c4c96e571b7daa80a56d9a5be35e2af050e6469`;
- documentos classificados: 79/79;
- observações brutas: 66; competências: 64;
- lacuna explícita: `2023-12`;
- pendências e conflitos: zero;
- índice: `952c88ec36f930ce83d153bedb07344226cf8d9029d14ada1576514214269092`.

#### Evidência canônica 3.5-B2 — KNCR11

- issue #114; PR #115; merge `52c02e41a64a09eaa6d6649c30cd6ddb8f9fb693`;
- documentos classificados: 52/52;
- observações e competências selecionadas: 48/48;
- período contínuo: `2022-01` a `2025-12`;
- pendências e conflitos: zero;
- índice: `c11de46d43de21e98a3eb6986a8fb5c0692465672c412b3329f20d86a9bfd1bb`.

#### Evidência canônica 3.5-B3 — KNSC11

- issue #117; PR #118; merge `1925b53a268f90b4c2f9a2733c4ac8df645a14ec`;
- documentos classificados: 52/52;
- observações brutas: 49; competências selecionadas: 48;
- período contínuo: `2022-01` a `2025-12`;
- pendências, conflitos e lacunas: zero;
- reapresentação `2022-01`: `261675` v2 substitui `261396` v1;
- índice: `149ababbbd26ac4cf21b5462022e0c921cff3ff10a1797f0d4047fda2d3bdb65`.

#### Evidência canônica 3.5-B4 — MCCI11

- issue #121; PR #122; merge `d2000807cc51f66288491ccf715f7ed84ab63fb2`;
- documentos classificados: 48/48;
- observações brutas: 47; competências selecionadas: 46;
- período observado: `2022-01` a `2025-11`;
- lacuna explícita: `2025-02`;
- deriva temporal `255155` corrigida para `2021-12`, fora da coorte;
- índice: `14c6ad2e55053d020688c0c99252e35a45c91a748cd946fd403b9acd0d99a817`.

#### Evidência canônica 3.5-B5 — RBRY11

- issue #124; PR #125; merge `c616437a0a44c1543015a709911c67f70f390b7d`;
- documentos classificados: 54/54;
- observações brutas após sanitização: 49; competências selecionadas: 47;
- período contínuo: `2022-01` a `2025-11`;
- pendências, conflitos e lacunas: zero;
- recuperação oficial: documento `987180`, competência `2025-08`, R$ 1,25 por cota;
- reapresentações e classes secundárias resolvidas por regras gerais;
- índice: `938b856f5a74edcd404b494f68a33654c1f68b4ae01a392de56e6cbc5c741ed1`.

#### Evidência canônica 3.5-C — dataset e backtest sem look-ahead

- issue #127; PR #128; merge `ef0c621f2f813009fdb3999b721e4f4a6568c134`;
- dataset `risk-lab-credit-oos-phase-c-v1`, versão `1.0.0`, metodologia `3.5-C.1`, ruleset `0.1.0`;
- observações consolidadas: `318`;
- duas execuções independentes com hashes idênticos;
- hash da identidade da coorte: `97a3fc3bea0adde463ee3a8d06a9e40a6e90dc0f22303bad85e3dd488bfb7726`;
- hash do dataset: `f18f61b7ddb5cc63955fa9791c6e5e3e43552134aaa28a9dd622a96ee587fcae`;
- hash da evidência: `4b0ced4e8ef662a23317e850353209b72804745be3afa7dc128e05356b2e7c6f`;
- índice final: `edb90face1dddff390dcbf260cf60dc0bb3c053f20ea4ea5a17a0788b98c308e`;
- resultados: DEVA11 verdadeiro positivo, VSLH11 verdadeiro positivo, KNCR11 verdadeiro negativo, KNSC11 falso positivo, MCCI11 inconclusivo e RBRY11 verdadeiro positivo;
- cobertura `83,33%`; lead time médio `220,52 dias`;
- falsos negativos: `0`; falso positivo: `1`; inconclusivo: `1`;
- calibração obrigatória: `true`; homologação permitida: `false`;
- Premium integrado: `false`; notificações enviadas: `false`.

#### Evidência canônica 3.6 — calibração e homologação

- issue #130; PR #131; merge `bfdc186057652a535025d19beae061856624d5c1`;
- ruleset de origem `0.1.0`; ruleset homologado `0.2.0`;
- estrutura preservada: 6 meses de baseline, 3 de estresse e 3 de recuperação;
- parâmetros: estresse `80%`, recuperação `89%`, margem mínima `0,5 ponto percentual`;
- cinco folds leave-one-verified-case-out, todos selecionando `89%`;
- métricas: 5/5 casos verificáveis corretos, acurácia `100%`, cobertura `83,33%`, falsos positivos `0`, falsos negativos `0`;
- MCCI11: `inconclusive_unscored`, excluído da otimização e das métricas pontuadas;
- hash da configuração: `91bf016c119ebbc929409c28f08a751ec4bcc6cb4f6f344656cfa7ef6818a4ec`;
- hash do relatório: `22b84180531f3687c9b3ebeb691020e75e6cb608777276061997b734090d701a`;
- hash da evidência: `fd695ecf4cbc759f9953ddcaf15ef14f28ba43a0b3d74098dd5cd1938baa9c81`;
- índice final: `35dd492e433855e50849cba05990bb9c5255be6f209fbcce5d5a9cb832ef0017`;
- homologação permitida: `true`; Premium integrado: `false`; notificações enviadas: `false`.

#### Evidência canônica 3.7 — integração read-only no Premium

- issue #133; PR funcional #134; merge funcional `7391791b09b1615a86e29c2002b74f95f55e833e`;
- registro runtime `premium-readonly-v1`, SHA-256 `982b1c9911610eb58ad6e0af5ea6ed801063c2b9f80783a5ee9c0b45b6de9ac9`;
- manifesto autoconsistente `de2d1abd481e2a66b296dc7eab667277cc8072c807872f9f7b3982da8aa9bbcd`;
- Prompt Premium `premium-fund-analysis-v3`; Modo Gestor `premium-manager-mode-v3`;
- PR #135; merge `4577ace58220e3ca800c3f1a89500ff31b7bfcd2`: estado pós-quota documentado e novo deployment de produção saudável;
- PR #136; merge `3062d8c5b568af90733451d1fe973a99637b1a58`: rollout controlado ativado em configuração versionada;
- PR #137; merge `b19b6dda25142814d4e0e0ac72c65a733f8ab3e0`: health check seguro e gate pós-deploy adicionados;
- PR #138; merge `a3b4f2c010fba3e62e52ed50b8fcacf2706474d2`: resultado do gate publicado como commit status auditável;
- produção: `Vercel=success`;
- double check: `Risk Lab Premium Production Gate=success`;
- workflow run: `30219287742`;
- disposições: DEVA11/VSLH11 `elevated_risk`; KNCR11 `none`; KNSC11/RBRY11 `informational_recovery`; MCCI11 `inconclusive_unscored`;
- fundos fora da coorte recebem indisponibilidade explícita, sem classificação por semelhança;
- notificações: `false`; efeitos externos: `false`;
- conclusão formal: `true`.

---

## 3. Sprint atual

### Encerramento formal da Fase 3

Estado: **formalmente concluída**.

Critérios comprovados:

1. código funcional em `main`;
2. registro e manifesto versionados e verificados por SHA-256;
3. seis casos da coorte preservados sem hardcode de decisão por ticker;
4. ruleset `0.2.0` homologado sem falso positivo ou falso negativo nos cinco casos verificáveis;
5. MCCI11 mantido inconclusivo e fora das métricas;
6. integração Premium executa cálculos determinísticos e Modo Gestor antes da IA;
7. autenticação, autorização, auditoria e fallback validados no servidor;
8. feature flag fail-closed no código e habilitada explicitamente no deployment;
9. notificações e efeitos externos proibidos;
10. Fase 2, política de notificações, Risk Lab, Sprint 3.7, typecheck e build verdes;
11. Preview e produção Vercel saudáveis;
12. health check de produção confirmou o mesmo SHA e as invariantes read-only;
13. resultado do double check publicado no próprio SHA;
14. zero review threads nas PRs finais;
15. evidência final persistida no Git;
16. nenhuma ação manual do usuário necessária.

Não existem bloqueadores técnicos remanescentes para a Fase 3.

---

## 4. Ordem oficial das próximas sprints

1. **4.1 — Radar Core: acompanhar fundo fora da carteira**.
2. **4.2 — Radar Intelligence: mudanças materiais, digest e alertas configuráveis**.
3. **4.3 — Planos, cobrança, entitlements comerciais e canais**.
4. **5.1 — Inteligência documental e “o que mudou”**.
5. **5.2 — Carteira histórica verdadeira**.
6. **5.3 — Screener quantitativo**.
7. **5.4 — Fair value e sustentabilidade da renda**.
8. **5.5–5.6 — escopo avançado a detalhar antes da implementação; nenhuma entrega deve ser inventada sem decisão canônica**.

### Trilha paralela

- **SEO-S1, dias 1–15:** fundação técnica, indexação, metadados, sitemap, canonicals, páginas prioritárias, Search Console e analytics.
- SEO pode avançar em paralelo, mas não altera a prioridade funcional 4.1 → 4.2 → 4.3.

---

## 5. Escopo e critérios de aceite de cada sprint

### 3.5 — coorte, dataset e backtest — concluída

- seis fundos processados com evidência oficial;
- 100% dos documentos descobertos classificados ou explicitamente justificados;
- séries, proveniência, reapresentações e hashes reproduzíveis;
- duas execuções com resultado idêntico quando aplicável;
- nenhum hardcode de regra por ticker;
- 318 observações consolidadas;
- backtest sem look-ahead;
- desempenho histórico preservado sem maquiagem;
- nenhum efeito em Premium ou notificações durante a validação.

### 3.6 — calibração — concluída

- dataset e hashes da 3.5-C preservados;
- espaço de candidatos limitado e versionado antes da seleção;
- nenhuma exceção por ticker;
- leave-one-case-out aprovado;
- zero falsos positivos e zero falsos negativos nos cinco casos verificáveis;
- MCCI11 inconclusivo e fora da otimização;
- ruleset `0.2.0` homologado.

### 3.7 — integração read-only — concluída

- cálculo determinístico antes da IA;
- IA interpreta, não inventa dados nem recalcula score;
- conteúdo informativo, sem recomendação automática de investimento;
- feature flag, autorização, auditoria, fallback e rollback;
- Prompt Premium v3 e Modo Gestor v3;
- produção no mesmo SHA auditado;
- health check sem exposição de dados sensíveis;
- gate pós-deploy reativo, sem polling;
- commit status auditável;
- notificações e efeitos externos bloqueados.

### 4.1 — Radar Core

Escopo mínimo:

- watchlist persistente de fundos fora da carteira;
- ciclo de benefício de 30 dias;
- plano Grátis: 1 ticker distinto por ciclo;
- plano Premium: até 10 tickers distintos por ciclo;
- remover um fundo não devolve o limite consumido no mesmo ciclo;
- `Salvar para depois` não consome limite;
- `Adicionar ao Radar Inteligente` consome limite, gera relatório e inicia acompanhamento;
- entitlements validados no servidor; nunca confiar em `isPremium` do navegador;
- impedir consumo duplicado do mesmo ticker no ciclo;
- conversão segura de fundo acompanhado para fundo da carteira;
- filtrar fundos já existentes na carteira antes de chamadas de IA ou APIs pagas;
- trilha de auditoria e testes de concorrência;
- sem alertas automáticos nesta Sprint.

Critérios de aceite:

- regras de plano e ciclo cobertas por testes unitários, integração e E2E;
- idempotência e concorrência comprovadas;
- nenhum usuário acessa limite de outro plano por manipulação do cliente;
- nenhuma chamada desnecessária de IA para fundo já existente na carteira;
- produção e rollback validados.

### 4.2 — Radar Intelligence

- detectar apenas mudança material;
- evento de baixa urgência vira digest;
- usuário controla ativo, categoria, severidade e frequência;
- opt-out imediato;
- nenhuma notificação quando dividendos pagos ou anunciados não mudaram, salvo variação patrimonial igual ou superior ao limite;
- limite patrimonial padrão de 3%, configurável para planos não grátis;
- deduplicação, agrupamento e timezone validados;
- notificações não podem ser habilitadas apenas pelo cliente.

### 4.3 — planos, cobrança e canais

- definir nomes e preços finais;
- entitlements no backend;
- cobrança idempotente e auditável;
- tratamento de upgrade, downgrade, falha e cancelamento;
- WhatsApp somente após decisão de custo, opt-in, templates e limites;
- Telegram continua fora do escopo;
- Super Premium precisa de proposta de valor específica antes de implementação.

### SEO-S1 — trilha paralela

- indexação técnica correta;
- sitemap e canonicals sem páginas privadas ou inadequadas;
- metadados e páginas prioritárias;
- Search Console e analytics;
- nenhuma degradação de segurança, performance ou dados regulatórios.

---

## 6. Regras arquiteturais obrigatórias

1. Nenhuma API nova acessa Firestore diretamente; usa `RegulatoryDataService` ou serviço de domínio equivalente.
2. Correções de parser, normalização e cálculo são globais e testadas no universo aplicável.
3. Ausência de dado não vira zero; permanece `null` com proveniência e aviso.
4. Fontes oficiais têm prioridade; dado derivado guarda fonte, data e regra.
5. Dados não são duplicados sem necessidade de consulta, auditoria ou desempenho comprovado.
6. Ativos inativados ou com troca de ticker preservam histórico e identidade.
7. Artefatos do Risk Lab são imutáveis, versionados e verificáveis por SHA-256.
8. Seleção de reapresentações é determinística e falha fechado em conflito econômico.
9. GitHub Actions valida o SHA; não é fila persistente, banco, cron ou mecanismo de polling.
10. Estado operacional, locks e retomadas pertencem ao backend/Firestore.
11. Nenhuma regra de fundo contém exceção hardcoded por ticker sem regra geral e evidência oficial.
12. Premium consome Risk Lab somente em modo read-only; notificações e efeitos externos permanecem bloqueados até Sprint específica.
13. IA recebe fatos e cálculos determinísticos; não preenche lacunas nem cria evidência.
14. Segurança, autorização e entitlements são verificados no servidor.
15. Interface não é barreira de segurança.
16. Toda fase possui rollback, logs, métricas, evidência e gate automatizado aplicável.
17. Mudança de runtime exige Preview ou deployment real; build isolado não substitui produção.
18. Credenciais sintéticas de CI são descartáveis e nunca representam acesso real ao Firebase.
19. O gate de produção pode publicar somente commit status; não escreve conteúdo, branch ou PR.
20. Toda regressão encontrada vira teste automatizado antes ou junto da correção.

---

## 7. Arquivos, branches, commits e PRs existentes

### PRs e commits canônicos da Fase 3

- PR #105 — DEVA11; merge `498654f03ce66bd54598d5a4677c18bbe5bbdc86`.
- PR #112 — VSLH11; merge `1c4c96e571b7daa80a56d9a5be35e2af050e6469`.
- PR #115 — KNCR11; merge `52c02e41a64a09eaa6d6649c30cd6ddb8f9fb693`.
- PR #118 — KNSC11; merge `1925b53a268f90b4c2f9a2733c4ac8df645a14ec`.
- PR #122 — MCCI11; merge `d2000807cc51f66288491ccf715f7ed84ab63fb2`.
- PR #125 — RBRY11; merge `c616437a0a44c1543015a709911c67f70f390b7d`.
- PR #128 — dataset e backtest; merge `ef0c621f2f813009fdb3999b721e4f4a6568c134`.
- PR #131 — calibração; merge `bfdc186057652a535025d19beae061856624d5c1`.
- PR #134 — integração Premium; merge `7391791b09b1615a86e29c2002b74f95f55e833e`.
- PR #135 — registro pós-quota; merge `4577ace58220e3ca800c3f1a89500ff31b7bfcd2`.
- PR #136 — ativação controlada; merge `3062d8c5b568af90733451d1fe973a99637b1a58`.
- PR #137 — health check e double check de produção; merge `b19b6dda25142814d4e0e0ac72c65a733f8ab3e0`.
- PR #138 — status auditável do gate; merge `a3b4f2c010fba3e62e52ed50b8fcacf2706474d2`.
- Issue #133 — deve ser encerrada após o merge deste Handoff final.
- PR #65 — regra de mês corrente; aberta e precisa de rebase, auditoria e CI antes de merge.

### Arquivos e evidências principais

- `docs/production-evidence/risk-lab/deva11-phase-a/`
- `docs/production-evidence/risk-lab/vslh11-phase-b1/`
- `docs/production-evidence/risk-lab/kncr11-phase-b2/`
- `docs/production-evidence/risk-lab/knsc11-phase-b3/`
- `docs/production-evidence/risk-lab/mcci11-phase-b4/`
- `docs/production-evidence/risk-lab/rbry11-phase-b5/`
- `docs/production-evidence/risk-lab/cohort-phase-c/`
- `docs/production-evidence/risk-lab/calibration-phase-3-6/`
- `docs/production-evidence/risk-lab/premium-readonly-phase-3-7-manifest.json`
- `docs/production-evidence/risk-lab/phase-3-production-closure.json`
- `src/lib/risk-lab/RiskLabPremiumReadModel.ts`
- `src/lib/risk-lab/risk-lab-premium-readonly-v1.json`
- `src/app/api/health/risk-lab-premium/route.ts`
- `.github/workflows/risk-lab-premium-production-gate.yml`
- `tests/risk-lab-premium-readonly.test.ts`
- `tests/risk-lab-premium-integration.test.mjs`
- `tests/risk-lab-premium-rollout-config.test.mjs`
- `tests/canonical-handoff.test.mjs`
- `docs/strategy/PLANO_SEO_90_DIAS_DADOS_FII.md`

### Branches

Branches de fase são temporárias. O estado aceito pertence ao `main`; branch ou PR aberta não equivale a conclusão.

---

## 8. Funcionalidades concluídas, parciais e pendentes

### Concluídas

- Engine regulatória, FII/FIAGRO, reconciliação e rollback.
- `RegulatoryDataService`, scores, Health, Validation e Admin.
- Timeline, relatórios, AI Insights e observabilidade.
- Catálogo básico e validações globais da Fase 2.
- Risk Lab 3.0–3.7 completo.
- Dataset de 318 observações e backtest sem look-ahead.
- Ruleset `0.2.0` homologado.
- Integração Premium read-only e Prompt Premium v3.
- Rollout controlado, health check e double check automatizado de produção.
- Governança de GitHub Actions e teste canônico do Handoff.

### Parciais

- Notificações materiais e digest: política definida; implementação ampla pendente para 4.2.
- IFIX: calendário oficial e card manual parcialmente implantados.
- Regra de meses encerrados: PR #65 ainda não integrada.
- Worker persistente FNET: arquitetura definida; implementação pendente.
- SEO-S1: plano pronto; execução pendente.

### Pendentes

- 4.1 Radar Core.
- 4.2 Radar Intelligence.
- 4.3 planos, cobrança e canais.
- Inteligência documental e “o que mudou”.
- Carteira histórica verdadeira.
- Screener quantitativo.
- Fair value e sustentabilidade da renda.
- Escopo final do Super Premium.

---

## 9. Decisões de segurança

- Admin exige autenticação, e-mail verificado e autorização no servidor.
- `ADMIN` é papel de autorização, não plano comercial.
- Segredos nunca usam prefixo `NEXT_PUBLIC_`.
- Endpoints administrativos são autenticados, auditáveis e protegidos contra abuso.
- Jobs automáticos usam segredo próprio e não confiam em parâmetros do cliente.
- Logs não expõem tokens, cookies, payloads pessoais ou dados sensíveis.
- Relatórios são informativos e não prometem retorno ou recomendação personalizada.
- Dados de carteira permanecem segregados por usuário.
- Entitlements são validados no backend; o navegador não decide plano.
- O Risk Lab está ativo somente em read-only.
- `notificationsAllowed=false` e `externalEffectsAllowed=false` são invariantes de produção.
- O endpoint de health expõe apenas estado operacional, versões e SHA; não expõe hashes internos sensíveis, carteira ou credenciais.
- O gate pós-deploy reage somente ao contexto `Vercel=success` em SHA pertencente a `main`.
- A permissão `statuses: write` serve apenas para publicar o resultado do gate no commit.
- Rollback do rollout ocorre desabilitando a flag ou revertendo a configuração versionada.
- Credenciais temporárias de CI são geradas no runner e destruídas ao final.

---

## 10. Variáveis de ambiente

### Confirmadas ou usadas

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `ADMIN_EMAILS`
- `ENABLE_AUTOMATIC_MONITOR`
- `ENABLE_RISK_LAB_PREMIUM_READONLY`
- credenciais Firebase Admin no servidor
- chave do provedor de IA no servidor
- segredos de jobs/cron no servidor

### Regras vigentes

- Preview e Produção são validados separadamente quando há código de runtime.
- Não copiar `projectId` do app iOS sem confirmar o projeto web.
- Valores secretos nunca são registrados neste documento.
- Variável ausente produz erro explícito e observável.
- `ENABLE_RISK_LAB_PREMIUM_READONLY` tem padrão `false` no código.
- O deployment atual a habilita explicitamente com valor `true` em configuração versionada.
- Valores sintéticos de build nunca são usados em deployment nem persistidos como segredo.

### Pendentes de decisão

- provedor e variáveis de cobrança;
- WhatsApp e templates;
- worker persistente FNET;
- armazenamento e retenção de artefatos operacionais fora do Git.

---

## 11. Testes obrigatórios

### Gates permanentes

- `npm run test:risk-lab`
- testes determinísticos DEVA11
- testes determinísticos VSLH11
- testes determinísticos KNCR11
- testes determinísticos KNSC11
- testes determinísticos MCCI11
- testes determinísticos RBRY11
- testes do dataset e backtest da Fase 3.5-C
- testes de calibração, leave-one-case-out e homologação da Sprint 3.6
- `npm run test:sprint3.7`
- teste de hash integral do registro e manifesto autoconsistente
- teste da configuração de rollout
- teste do health check seguro
- teste do gate reativo e do commit status auditável
- validação do arquivo `phase-3-production-closure.json`
- `npm run test:workflow-governance`
- `npm run test:handoff`
- `npm run typecheck`
- `npm run test:sprint2`
- `next build` nas PRs de runtime
- Preview Vercel aplicável
- deployment de produção aplicável
- `Risk Lab Premium Production Gate=success` no SHA implantado

### Regra de deployment aplicável

- Preview ou deployment real é obrigatório quando o diff altera código executado pelo produto.
- Build isolado só pode substituir Preview quando o diff não altera runtime e uma indisponibilidade externa está documentada.
- O fallback exige typecheck, build, credenciais descartáveis e ausência comprovada de integração com runtime.
- O gate final da Fase 3 exige resposta de produção com o mesmo SHA, não apenas build verde.

### Regra de conclusão

Uma fase só pode ser marcada como concluída quando:

- código está em `main`;
- CI obrigatória está verde no SHA da PR;
- universo aplicável foi coberto;
- correções são globais e testadas;
- evidência final está no Git;
- deployment aplicável foi identificado e está saudável;
- smoke ou gate de produção comprovou comportamento, quando aplicável;
- não existem review threads pendentes;
- auditoria pós-merge confirmou o conteúdo no `main`;
- issue da fase é encerrada somente após a auditoria da `main` e o Handoff final;
- Handoff canônico foi atualizado e protegido por teste.

Testes manuais podem complementar, mas não substituir gates automatizados.

---

## 12. Pendências e decisões ainda abertas

### Próxima execução funcional

- iniciar 4.1 Radar Core com persistência, ciclos de 30 dias e entitlements no servidor;
- manter 4.1 sem alertas automáticos;
- executar SEO-S1 em paralelo sem atrasar Radar;
- fechar a issue #133 após o merge e auditoria deste Handoff.

### Decisões de produto

- nomes e preços finais dos planos;
- forma de cobrança, upgrade, downgrade e cancelamento;
- WhatsApp: custo, opt-in, templates e limites;
- Telegram continua adiado;
- escopo e proposta de valor do Super Premium;
- política final de retenção de relatórios e dados históricos.

### Dívidas técnicas e operacionais

- rebase e auditoria da PR #65;
- worker persistente para processamento FNET;
- consolidação do digest de alertas;
- completar dados abertos quando novas fontes oficiais existirem;
- revisar IFIX e card manual contra o calendário oficial;
- recalibrar orçamento de GitHub Actions com dados reais de 30 dias.

### Regra de parada

A Fase 3 está formalmente concluída. O Risk Lab read-only, o ruleset `0.2.0`, o Prompt Premium v3 e o Modo Gestor estão implantados e validados em produção. O double check automático confirmou o mesmo SHA, a ativação controlada, o bloqueio de notificações e a ausência de efeitos externos. Nenhuma ação manual do usuário é necessária. A próxima unidade funcional é 4.1 — Radar Core.
