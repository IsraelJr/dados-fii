Este documento substitui todos os planejamentos anteriores quando houver divergência.

# Dados FII — Documento Canônico de Handoff

**Versão:** 6.0.0  
**Data:** 19/07/2026  
**Repositório:** `IsraelJr/dados-fii`  
**Branch principal:** `main`  
**Commit auditado em `main`:** `b42034f19620c93f0af4038a61afc5003b281758`  
**Branch desta atualização:** `agent/canonical-handoff-v6`  
**PR desta atualização:** #43 — `docs: atualiza handoff canônico v6` (draft)

## Como interpretar os status deste documento

- **Implementada:** existe código versionado no Git.
- **Testada em repositório:** existem testes automatizados versionados que cobrem o comportamento.
- **Implantada:** o commit exato possui deployment identificado e saudável.
- **Validada funcionalmente:** houve validação do proprietário ou smoke test documentado.
- **Formalmente concluída:** todas as condições anteriores foram atendidas sobre o universo aplicável, com evidências persistidas no Git e sem depender apenas de fundos sentinela.

Uma validação manual bem-sucedida não equivale, sozinha, à conclusão integral de uma fase.

## Decisões vigentes que substituem decisões anteriores

| Decisão vigente | Decisão substituída | Motivo |
|---|---|---|
| A Fase 2 está implementada e validada funcionalmente, mas seu encerramento formal permanece condicionado à Sprint 2.12. | “Fases 1 e 2 totalmente concluídas em Produção.” | A auditoria versionada de qualidade informa que a carga, o double check e a homologação estratificada em Produção ainda não foram persistidos como evidência. |
| Nenhuma fase será declarada 100% concluída sem código, CI, deployment do commit exato, smoke test, cobertura do universo e evidências no Git. | Conclusão baseada em testes de poucos tickers ou confirmação verbal. | Correções de cálculo, cadastro, IA e relatórios precisam ser generalizadas para todos os fundos aplicáveis. |
| Sprint corrente canônica: **2.12 — Encerramento auditável das Fases 1 e 2**. | Sprint 3.4 como única prioridade imediata. | A integridade da base é pré-requisito para scores, IA, relatórios, Risk Lab e SEO em escala. |
| Fase 3 = **Risk Lab**; Fase 4 = **Radar/Acompanhar fundo fora da carteira**. | Radar como Fase 3. | O Risk Lab já possui implementação substancial e precisa ser homologado antes de alimentar decisões e alertas. |
| Fluxo principal do Risk Lab = **ticker-only**; seleção de documento, fila de IDs e execução manual são ferramentas de diagnóstico. | Fluxos manuais como experiência principal. | O proprietário não deve resolver IDs nem validar documentos técnicos para usar o produto. |
| O Relatório Premium usa cálculo determinístico e dados estruturados antes da IA; a IA explica, compara e contextualiza, mas não inventa nem decide regras. | IA produzindo análise diretamente de dados incompletos ou chamando OpenAI por endpoint. | Evita alucinação, inconsistência e custo repetido. |
| Telegram fica **adiado e fora do roadmap ativo**. WhatsApp permanece decisão aberta. | Telegram como canal obrigatório do monitor. | Decisão mais recente do proprietário: não priorizar Telegram agora. |
| IFIX é sincronizado no primeiro ciclo de janeiro, maio e setembro, com execução manual no Admin. | Sincronização diária da composição do IFIX. | A composição não exige consulta diária; reduz custo sem perder utilidade operacional. |
| Notificação de carteira só nasce quando dividendos pagos/anunciados mudam; sem mudança, exige variação patrimonial absoluta mínima de 3% no Grátis. Usuários pagos poderão parametrizar o limiar. | Notificação diária mesmo sem mudança material. | Reduz ruído e fadiga. |
| E-mails correlatos devem ser consolidados em um digest, com deduplicação e cooldown. | Um e-mail por evento de concentração/resumo. | Evita mensagens contraditórias e múltiplos e-mails no mesmo ciclo. |
| Planos visíveis ao usuário serão `Grátis`, `Premium` e, se aprovado comercialmente, `Super Premium`; `ADMIN` é permissão, não plano. | Exibir `ADMIN` no campo de plano. | Separa autorização administrativa de produto e cobrança. |
| Correções de P/VP, ágio/desconto, liquidez, dividendos anuais e qualidade cadastral devem ser regras globais com regressão, nunca patches por ticker. | Correções pontuais apenas para MXRF11, VGIA11 ou outro fundo observado. | O problema identificado em um fundo pode afetar todo o universo. |
| O texto vigente da leitura rápida é **“Dividendos consolidados pelo histórico mensal da carteira.”** | Texto que limitava explicitamente a meses encerrados. | A PR #39 restaurou a cópia após a PR #32 ter sido revertida pela PR #33. |

---

## 1. Estado atual do projeto

### Resumo executivo

- A fundação regulatória, a camada de serviços, os scores, as APIs administrativas, o Dashboard, a Timeline, os relatórios, a IA, a observabilidade, o monitor e as notificações possuem implementação no repositório.
- O proprietário validou funcionalmente a Fase 2, inclusive correções recentes de P/VP, ágio/desconto, carteira, relatórios e Admin.
- A auditoria global de 16/07/2026 conciliou localmente **511/511** candidatos B3/CVM, encontrou **504/504** ativos com cadastro básico, **491/502** com indicadores essenciais aplicáveis, zero CNPJ duplicado e 11 lacunas externas conhecidas.
- O próprio documento `docs/data-quality-hardening.md` registra que a **carga e a auditoria pós-carga em Produção estão pendentes**. Portanto, a Fase 2 não recebe selo de encerramento formal nesta versão.
- `main` está em `b42034f`, merge da PR #42. O status Vercel desse commit está `success`; não houve workflow GitHub Actions no commit documental e não foi localizado smoke autenticado persistido para o commit exato.
- O Risk Lab está implementado em código até a PR #41, mas continua isolado do Premium e das notificações. A coorte externa permanece bloqueada por teste até verificação em fonte primária.
- O Plano SEO de 90 dias foi incorporado como quatro sprints paralelas. Publicação em massa fica proibida enquanto qualidade e proveniência não estiverem homologadas.

### Auditoria de conclusão

| Área | Código | Testes no Git | Deployment identificado | Evidência operacional suficiente | Status canônico |
|---|---:|---:|---:|---:|---|
| Fase 1 — Engine regulatória | Sim | Sim | Sim, historicamente | Parcial para o commit atual | Implementação concluída; encerramento revalidado na 2.12 |
| Fase 2 — Serviços e inteligência | Sim | Sim | Sim (`b42034f`, Vercel verde) | Não para universo + double check + amostra estratificada | Implementada e validada funcionalmente; conclusão formal pendente |
| Fase 3 — Risk Lab | Sim, até 3.3 | Sim | Deployment geral verde | Smoke autenticado e coorte ausentes | Em andamento |
| SEO 90 dias | Plano pronto | Não se aplica ao plano | Não iniciado como trilha auditada | Search Console/KPIs não registrados | Pendente |

### Pendências de dados já conhecidas

- Abertura PF/PJ não publicada nas fontes estruturadas usadas: `BFCC11`, `BRHT11`, `BTML11`, `FINF11`, `IDUA11`, `MTOF11`, `PBLV11`, `REME11`, `RRES11` e `SPAF11`.
- `RJDA11`: também sem cotas emitidas, patrimônio líquido e total de cotistas nos layouts usados.
- Divergências históricas de ISIN em revisão: `KISU11`, `SPTW11` e `TRXF11`.
- Inativação prevista e ainda dependente de aplicação/evidência: `HGPO11`.
- Lacuna externa deve ser `null`, com fonte, data e aviso; nunca zero ou informação inventada.

---

## 2. Fases concluídas e situação de certificação

### Fase 1 — Regulatory Engine

**Escopo de engenharia concluído:** parser CVM v2, suporte FII/FIAGRO, reconciliação, QA, staging/produção, aprovação humana, backup imutável, hash, publicação protegida, rollback e CI.

**Evidências existentes:** código e testes versionados; homologações históricas em `TGAR11`, `VGIA11`, `MXRF11` e `KNCA11`; trilhas de backup/publicação/rollback.

**Status rigoroso:** concluída quanto à implementação. O selo de “100% concluída no estado atual de Produção” será renovado na Sprint 2.12 com smoke do commit exato, auditoria do universo e evidências gravadas no Git.

### Fase 2 — Core Intelligence & Product Foundation

**Escopo implementado:** RegulatoryDataService, Repository, Normalizer, Validator, Cache e Types; ScoreEngine; Health; Validation e histórico; Dashboard Admin; Timeline; Relatório Gratuito; AI Insights; Relatório Premium; observabilidade; monitor; catálogo e qualidade; notificações e jobs.

**Status rigoroso:** implementação concluída e validação funcional declarada pelo proprietário. **Encerramento formal pendente**, pois a carga oficial do catálogo, o double check pós-carga, a homologação estratificada e o relatório de evidências de Produção ainda não estão versionados.

### Fase 3 — Risk Lab

**Em andamento.** As Sprints 3.0 a 3.3 possuem código e testes. A Sprint 3.4 precisa executar o smoke autenticado; a 3.5 está bloqueada até verificação primária da coorte.

---

## 3. Sprint atual

### Sprint 2.12 — Encerramento auditável das Fases 1 e 2

**Objetivo:** converter “implementado e validado em casos observados” em “formalmente concluído sobre o universo aplicável”.

**Trabalho obrigatório:**

1. identificar o commit de release e o deployment de Produção;
2. executar a prévia do catálogo global no Admin;
3. aplicar a atualização somente com 511/511 conciliados, 100% básico e zero duplicidade;
4. persistir backups, versões, hashes e diretório materializado;
5. executar e persistir o double check pós-carga;
6. reconciliar ativos, inativos, sucessores e fundos em revisão com evidência oficial;
7. homologar Fase 1 e Fase 2 numa amostra estratificada de FII, FIAGRO e FI-Infra, incluindo fundos completos, incompletos e excepcionais;
8. testar cálculos globais de P/VP, ágio/desconto, liquidez, yield, dividendos mensais/anuais e patrimônio de carteira;
9. testar Relatório Gratuito, Premium, AI Insights, Admin, Health, Validation, monitor e notificações;
10. salvar `commit`, URL, horário, comandos, resultados, amostra, exceções e capturas sanitizadas em `docs/production-evidence/` no Git.

**Critério de aceite:** todos os dez itens concluídos, testes verdes, nenhuma correção limitada a ticker e nenhuma lacuna apresentada como fato. Enquanto isso, o status permanece “implementada, com encerramento formal pendente”.

---

## 4. Ordem oficial das próximas sprints

### Trilha principal de produto

1. **Sprint 2.12 — Encerramento auditável das Fases 1 e 2.**
2. **Sprint 3.4 — Risk Lab em Produção e smoke ponta a ponta.**
3. **Sprint 3.5 — Coorte externa e backtest sem informação futura.**
4. **Sprint 3.6 — Métricas, calibração e gate formal.**
5. **Sprint 3.7 — Risk Lab read-only no Relatório Premium e Prompt Premium v3.**
6. **Sprint 3.8 — Impacto na carteira e alertas opt-in.**
7. **Sprint 4.1 — Radar: acompanhar fundo fora da carteira.**
8. **Sprint 4.2 — Radar: eventos, tese e relatório pré-compra.**
9. **Sprint 4.3 — Planos, preferências, canais e monetização.**
10. **Sprint 5.1 — Carteira histórica verdadeira e ledger de eventos.**
11. **Sprint 5.2 — Motor de risco, exposição e atribuição acionável.**
12. **Sprint 5.3 — Inteligência sobre comunicados oficiais.**
13. **Sprint 5.4 — Screener quantitativo, pares e fair value por tipo de FII.**
14. **Sprint 5.5 — Benchmark, retorno total, calendário, centro fiscal e simuladores.**

### Trilha SEO de 90 dias, em paralelo e sem furar gates de dados

1. **Sprint SEO 1 — Dias 1–15: fundação técnica e indexação.**
2. **Sprint SEO 2 — Dias 16–45: vinte páginas prioritárias de fundos.**
3. **Sprint SEO 3 — Dias 46–70: long tails, comparações e páginas diferenciadas.**
4. **Sprint SEO 4 — Dias 71–90: autoridade, estudos originais e melhoria contínua.**

Incidentes de segurança, integridade de dados e regressões de Produção sempre interrompem a ordem normal.

---

## 5. Escopo e critérios de aceite de cada sprint

### Sprint 2.12 — Encerramento auditável

**Escopo:** carga controlada, double check, reconciliação de ciclo de vida, homologação estratificada e dossiê de Produção.

**Aceite:** 100% B3/CVM conciliado; 100% cadastro básico dos ativos; zero CNPJ duplicado; exceções externas documentadas; smoke do commit exato; comandos obrigatórios verdes; evidência no Git.

### Sprint 3.4 — Risk Lab em Produção

**Escopo:** homologar o fluxo `ticker → identidade/CNPJ → fontes oficiais → validação → série mensal → detector → triagem de crédito → validated/inconclusive/blocked`.

**Aceite:** deployment `Ready`; flags explicitamente conferidas; Admin autenticado e ticker-only; casos `HCTR11`, `MCCI11`, `RBRY11`, ticker inválido, insuficiência e ambiguidade; persistência/auditoria conferidas; zero efeito no Premium e nas notificações; smoke salvo no Git.

### Sprint 3.5 — Coorte externa

**Escopo:** verificar em fonte primária e executar, sem alterar o ruleset `v0.1.0`, `DEVA11`, `VSLH11`, `KNCR11`, `KNSC11`, `MCCI11` e `RBRY11`.

**Aceite:** `knownAt`, URL, trecho, página, hash e versão por observação; nenhum look-ahead; métricas de primeiro amarelo/laranja/vermelho, antecedência, falso positivo, falso negativo, inconclusão e cobertura; controles saudáveis sem vermelho injustificado. O teste atual mantém `executionAllowed=false` até a verificação primária.

### Sprint 3.6 — Métricas, calibração e gate

**Escopo:** avaliar desempenho e decidir aprovar, reprovar ou criar ruleset novo.

**Aceite:** zero vermelho falso positivo nos controles; nenhuma conclusão final sustentada só por fonte secundária; ambiguidades resultam em inconclusivo; qualquer alteração cria versão/hash novos e repete a coorte integral; decisão formal versionada.

### Sprint 3.7 — Premium read-only e Prompt Premium v3

**Escopo:** integrar resultados aprovados do Risk Lab como evidência explicável; refinar o prompt com metodologia própria para FIIs, impacto na carteira e linguagem leiga.

**Aceite:** feature flag e rollback; fontes e datas; separação entre fato, cálculo, estimativa e inferência; falha isolada; ausência de recomendação automática; nenhum jargão sem explicação; relatório parcial quando a confiança for insuficiente; testes por tipo de fundo e perfil de carteira.

### Sprint 3.8 — Impacto e alertas opt-in

**Escopo:** converter risco do fundo em impacto estimado sobre patrimônio e renda da carteira; oferecer painel antes de canais interruptivos.

**Aceite:** consentimento, relevância por posição, deduplicação, cooldown, digest, histórico e cancelamento; nenhuma notificação por simples ausência de dado; nenhum alerta público sem gate aprovado; testes de ruído e reversão.

### Sprint 4.1 — Radar/Acompanhar fundo

**Escopo:** permitir acompanhar fundos que não fazem parte da carteira para decidir se vale comprar.

**Aceite:** limite aplicado no servidor de **1 fundo ativo no Grátis** e **10 no Premium**, até nova decisão; autenticação; idempotência; fontes oficiais; adicionar/remover; histórico; nenhum acesso direto da API ao Firestore; custo medido; sem duplicar fundo já coberto pela carteira.

### Sprint 4.2 — Eventos e tese pré-compra

**Escopo:** dividendos anunciados, fatos relevantes, relatórios gerenciais, assembleias, emissões, mudança de gestão, tese, riscos, catalisadores e alteração material desde a última leitura.

**Aceite:** timeline deduplicada; fonte/data; “o que mudou”, “por que importa” e “impacto provável”; estado `inconclusive` quando faltarem dados; relatório pré-compra reaproveitando AI Insights e Risk Lab, sem chamadas de IA isoladas por endpoint.

### Sprint 4.3 — Planos e monetização

**Escopo:** entitlements para Grátis/Premium/Super Premium, cobrança, trials, preferências de alerta e canais.

**Aceite:** autorização no servidor; `ADMIN` nunca exibido como plano; tabela de limites versionada; downgrade seguro; cobrança, cancelamento e estorno definidos; consentimento por canal; custos unitários medidos; LGPD e termos revisados.

### Sprint 5.1 — Carteira histórica verdadeira

**Escopo:** ledger imutável de transações, lotes, dividendos, subscrições, amortizações, desdobramentos, incorporações e snapshots.

**Aceite:** reprocessamento determinístico; correções por evento, não por sobrescrita; patrimônio e renda históricos reproduzíveis; custo de aquisição e retorno total; conciliação com posições; exportação e trilha de auditoria.

### Sprint 5.2 — Risco, exposição e atribuição

**Escopo:** concentração por fundo, gestor, segmento, indexador, devedor, inquilino, geografia e tipo de receita; correlação, liquidez, sensibilidade a juros, stress e atribuição de retorno/renda.

**Aceite:** contribuição de cada posição para risco e resultado; impacto na carteira; metodologia pública; cenários explicados; testes com carteiras sintéticas; sem falsa precisão.

### Sprint 5.3 — Inteligência sobre comunicados oficiais

**Escopo:** detectar mudanças materiais entre competências e documentos oficiais, com fatos, números, riscos, oportunidades e perguntas à gestão.

**Aceite:** diff verificável; citação de fonte; nenhuma afirmação não sustentada; relevância para fundo e carteira; cache/reuso de insight; custo e taxa de inconclusão monitorados.

### Sprint 5.4 — Screener, pares e fair value

**Escopo:** filtros salvos, scores/fatores, comparação com pares do mesmo mandato, qualidade da renda, desconto ajustado ao risco e valuation específico por tipo de FII.

**Aceite:** universo e critérios reproduzíveis; pares explicáveis; exportação; backtest sem look-ahead; FII de tijolo, papel, FoF, desenvolvimento, FIAGRO e FI-Infra com metodologias próprias; nenhuma aplicação genérica de DCF de ações.

### Sprint 5.5 — Ferramentas complementares

**Escopo:** IFIX e outros benchmarks, decomposição preço+renda, calendário anúncio/data-com/pagamento, centro fiscal/documental, projeção de renda, aportes e reinvestimento.

**Aceite:** dados e datas reconciliados; retorno total correto; documentos auditáveis; simulações com premissas editáveis; linguagem educativa; exportação e limites fiscais explícitos.

### Sprint SEO 1 — Fundação técnica

**Escopo:** Search Console, sitemap, robots, canonical, redirects, SSR/conteúdo rastreável, links internos, `noindex` para Admin/privado, dados estruturados e Core Web Vitals.

**Aceite:** propriedade verificada; sitemap aceito; ausência de páginas administrativas no índice; páginas públicas renderizadas sem depender de interação; baseline de indexação, CWV e erros salvo no Git.

### Sprint SEO 2 — Vinte páginas prioritárias

**Escopo:** melhorar páginas de fundos de maior demanda com identidade, indicadores confiáveis, histórico, eventos, metodologia, fontes, atualização e glossário contextual.

**Aceite:** vinte URLs únicas, úteis e indexáveis; sem conteúdo fino/duplicado; schema válido; links internos; métricas de impressão, posição, CTR e cobertura acompanhadas.

### Sprint SEO 3 — Long tails e diferenciação

**Escopo:** comparações por pares, páginas de eventos, dividendos, mudanças, risco e perguntas long tail baseadas em dados próprios.

**Aceite:** intenção de busca explícita; evidência e data; canonical correto; páginas programáticas somente quando possuírem informação material exclusiva; revisão de qualidade antes da publicação.

### Sprint SEO 4 — Autoridade

**Escopo:** estudos originais, cases, metodologia, outreach e backlinks legítimos.

**Aceite:** estudos reproduzíveis; fontes primárias; divulgação sem compra de links; dashboard de autoridade e conversão; revisão dos primeiros 90 dias e backlog do próximo ciclo.

---

## 6. Regras arquiteturais obrigatórias

1. **Nenhuma API nova acessa Firestore diretamente.** Fluxo regulatório: `API → RegulatoryDataService → RegulatoryRepository → Firestore`.
2. Toda leitura regulatória passa pelo Repository; exceção existente exige justificativa, teste, auditoria e plano de migração.
3. Identidade, snapshots, eventos, fatores e ledger do usuário são domínios separados; campos derivados não são gravados manualmente.
4. O documento canônico por fundo deve atender a consulta principal em uma leitura; diretórios materializados e cache evitam fan-out e reduzem custo.
5. Não duplicar CNPJ, nome legal, prestadores ou classificações em coleções concorrentes. Snapshot preserva competência e proveniência.
6. Toda publicação sensível exige fonte, data, hash, identidade, idempotência, aprovação, backup, versão, auditoria e rollback.
7. Campos legados protegidos nunca são sobrescritos automaticamente.
8. Todo score passa pelo `ScoreEngine`; toda IA textual passa pelo `AIInsightsEngine`; nenhuma API chama OpenAI diretamente.
9. IA recebe dados estruturados e cálculos prontos; não inventa valores, não transforma ausência em fraqueza/força e não confunde identificação de gestor com qualidade de governança.
10. Relatórios separam fato, cálculo, estimativa, inferência e indisponibilidade; sempre informam fonte, data de referência, confiança e impacto para a carteira.
11. P/VP = preço por cota ÷ valor patrimonial por cota. Ágio/desconto = `(P/VP − 1) × 100`; verde representa desconto e vermelho representa ágio. Exibir duas casas decimais em todo o produto.
12. Liquidez precisa ter unidade e período explícitos; valores implausíveis bloqueiam a conclusão e entram no reprocessamento, nunca são explicados pela IA como fato.
13. Correção observada num fundo deve gerar auditoria global, teste de regressão e amostra estratificada antes de ser considerada resolvida.
14. Risk Lab usa `knownAt`; look-ahead é proibido. Fonte oficial prevalece; fonte secundária só localiza ou contextualiza.
15. Falta, conflito ou ambiguidade produzem `inconclusive`/`blocked`; “nenhum evento encontrado” não certifica segurança.
16. Ruleset congelado exige versão e hash; ferramentas manuais do Risk Lab são diagnóstico, não experiência principal.
17. Risk Lab não alimenta Premium antes do gate 3.6 nem dispara alertas antes da 3.8.
18. Planos e limites são resolvidos no servidor; cliente não concede Premium nem Admin.
19. Notificações são orientadas a mudança material, deduplicadas e consolidadas; sem mudança de dividendos, o Grátis exige variação patrimonial absoluta de pelo menos 3%.
20. SEO nunca autoriza conteúdo raso, páginas duplicadas ou dados não homologados. Páginas públicas devem expor método, data e limitações.

---

## 7. Arquivos, branches, commits e PRs existentes

### Repositório e deployment

- Repositório privado: `IsraelJr/dados-fii`.
- Branch canônica: `main`.
- Commit auditado: `b42034f19620c93f0af4038a61afc5003b281758`, merge da PR #42.
- Status do commit: Vercel `success`.
- GitHub Actions no commit #42: nenhuma execução localizada, coerente com alteração documental.
- Limitação da evidência: deployment verde não substitui smoke autenticado nem auditoria de dados.

### Arquivos canônicos e evidências centrais

| Arquivo | Função |
|---|---|
| `DADOS_FII_HANDOFF.md` | Estado e roadmap canônicos. |
| `docs/data-quality-hardening.md` | Contrato do catálogo, auditoria global e gate permanente de conclusão. |
| `docs/risk-lab/README.md` | Princípios, escopo e isolamento do Risk Lab. |
| `src/lib/featureFlags.ts` | Flags centrais das Fases 2/3. |
| `vercel.json` | Jobs agendados e cadência operacional. |
| `package.json` | Comandos de validação `typecheck`, `test:sprint2`, `test:risk-lab` e `build`. |
| `tests/phase-2-completion.test.ts` | Regressões de relatório, cálculos, observabilidade e monitor. |
| `tests/risk-lab-production.test.ts` | Gates de dataset e execução administrativa. |
| `tests/risk-lab-ruleset-freeze.test.mjs` | Congelamento e hash das regras. |
| `tests/risk-lab-cohort-registry.test.ts` | Bloqueio da coorte até fonte primária. |
| `.github/workflows/risk-lab.yml` | CI específico do Risk Lab. |
| `.github/workflows/portfolio-notifications-ci.yml` | CI das notificações. |

### Commits e PRs-chave já mesclados

- PR #6: base da Fase 2.
- PRs #7–#21: histórico, Admin, validação, carteira, ágio/desconto, qualidade e catálogo.
- PRs #22–#23: piloto e freeze do Risk Lab.
- PRs #24–#29: coorte, eventos, motor e cobertura.
- PR #30: política de notificações orientada a eventos.
- PR #33: rollback da PR #32.
- PR #39: restauração do texto vigente da leitura rápida.
- PRs #38, #40 e #41: fluxo ticker-only, série mensal/detector e eventos automáticos de crédito; substituem os fluxos manuais como principal.
- PR #42: handoff v5; seu conteúdo é substituído integralmente por esta versão.

### PRs abertas na data da auditoria

- **#5 — “Adicionar ingestão operacional controlada de FIIs e presentes VIP”**: draft antigo; TGAR11 aprovado, VGIA11 pendente segundo o próprio texto. Deve ser reconciliado com o que já entrou em `main` e então fechado ou atualizado.
- **#1 e #2 — correções automáticas de CVE em React Server Components**: antigas e potencialmente superadas pela versão atual `Next 16.2.9`/`React 19.1.0`; exigem revisão de segurança antes de fechar, nunca merge automático sem comparar dependências.
- **#43 — atualização canônica v6:** draft aberta nesta auditoria; substitui o conteúdo da PR #42 após revisão e merge.

### Branches remotas

Foram localizadas 44 branches. Além de `main`, permanecem branches históricas `agent/*`, `feat/*`, `feature/*`, `fix/*`, `docs/*` e duas `vercel/*`. As principais famílias são:

- Fase 2 e correções: `agent/sprint-2-1-2-2-regulatory-admin`, `agent/data-quality-hardening`, `agent/fix-*`, `feature/portfolio-notifications`, `feature/free-friday-observability`;
- Risk Lab: `feat/risk-lab-*`, `fix/risk-lab-*`;
- documentação/rollback: `docs/canonical-handoff-v5`, `agent/rollback-pr-32`, `agent/rollback-quick-numbers`;
- segurança automática: `vercel/react-server-components-cve-*`;
- atualização atual: `agent/canonical-handoff-v6`.

Não apagar branches em lote sem reconciliar PR, merge e necessidade de recuperação. Criar uma tarefa de higienização após a Sprint 2.12.

---

## 8. Funcionalidades concluídas, parciais e pendentes

### Implementadas e com testes no repositório

- Engine regulatória, parser v2, FII/FIAGRO, reconciliação, QA, staging, publicação protegida, aprovação, backup, hash e rollback.
- RegulatoryDataService, Repository, Normalizer, Validator, Cache e Types.
- ScoreEngine e subscores de risco, dividendos, governança, crescimento, liquidez, qualidade e Premium.
- Health, Validation, histórico, parser health, Dashboard Admin e rate limiting.
- Timeline regulatória, Relatório Gratuito, AI Insights, Relatório Premium, observabilidade e monitor.
- Carteira, snapshots, histórico, sincronização e notificações orientadas a eventos.
- Cálculo global de P/VP e ágio/desconto, padronização visual e glossário.
- Job IFIX na primeira semana de janeiro/maio/setembro e acionamento manual no Admin.
- Catálogo normalizado, ciclo de vida, proveniência, materialização e double check em código.
- Risk Lab até descoberta por ticker, série mensal automática, detector, triagem de crédito, regras congeladas, autenticação e isolamento.

### Parciais ou pendentes de evidência operacional

- Encerramento formal das Fases 1 e 2: falta Sprint 2.12.
- Carga do catálogo e auditoria pós-carga em Produção.
- Cobertura essencial: 11 lacunas externas conhecidas.
- Validação de inativação/sucessão em Produção, inclusive `HGPO11`.
- AI Insights e Premium: funcionais, mas o Prompt Premium v3 e a homologação estratificada ainda são necessários.
- Política antirruído das notificações: implementada; eficácia deve ser observada e documentada em Produção.
- Risk Lab: código avançado, mas sem smoke autenticado e sem gate externo.
- Coorte: pré-registrada, com execução explicitamente bloqueada.
- Persistência/auditoria do fluxo automático: precisa de smoke e dossiê.
- SEO: plano pronto, execução não auditada.

### Pendentes — prioridade de valor competitivo

| Ordem | Funcionalidade | Valor estratégico | Sprint |
|---:|---|---:|---|
| 1 | Motor de risco, exposição e atribuição acionável | 10,0 | 5.2 |
| 2 | Inteligência sobre comunicados oficiais | 9,5 | 5.3 |
| 3 | Carteira histórica verdadeira com lotes, dividendos e snapshots | 9,2 | 5.1 |
| 4 | Alertas multigatilho e digests relevantes | 8,9 | 3.8/4.2 |
| 5 | Screener quantitativo, filtros salvos e scores | 8,5 | 5.4 |
| 6 | Fair value e sustentabilidade de dividendos | 8,2 | 5.4 |
| 7 | Benchmark e decomposição do retorno total versus renda | 7,8 | 5.5 |
| 8 | Calendário anúncio → data-com → pagamento | 7,2 | 5.5 |
| 9 | Comparação de pares e exportação | 6,9 | 5.4 |
| 10 | Centro fiscal e documental | 6,5 | 5.5 |
| 11 | Gráficos avançados de preço, volume e indicadores | 6,2 | backlog posterior à 5.5 |
| 12 | Simuladores de renda, aporte e reinvestimento | 5,8 | 5.5 |

### Funcionalidade explícita de Radar

“Acompanhar um fundo” significa seguir um FII/FIAGRO/FI-Infra que **não está na carteira**, receber mudanças materiais e construir uma tese antes da compra. Limite vigente para planejamento: **1 no Grátis e 10 no Premium**, aplicados no servidor. Alertas não podem se limitar a preço; devem considerar rendimentos, documentos, eventos, risco, tese e relevância.

---

## 9. Decisões de segurança

1. APIs administrativas exigem Firebase Authentication, e-mail verificado, e-mail presente em `ADMIN_EMAILS` e autorização Admin no servidor.
2. Admin não é plano comercial. Sessão administrativa usa cookie assinado `HttpOnly`, `SameSite=Lax`, `Secure` em Produção e prazo limitado.
3. Nenhuma API administrativa é pública; conferir mesma origem, método, autenticação, autorização e rate limit.
4. Segredos só existem no ambiente do servidor; nunca em logs, resposta de API, bundle cliente, prompt ou documento.
5. `NEXT_PUBLIC_*` contém apenas configuração pública do cliente Firebase; credencial de serviço nunca usa prefixo público.
6. Jobs cron exigem `CRON_SECRET` ou mecanismo equivalente da plataforma.
7. Publicação, rollback, validação, aprovação, catálogo, Risk Lab e alterações de plano produzem logs de auditoria.
8. Antes de publicação: backup, hash, aprovação e capacidade de rollback são obrigatórios.
9. Fontes externas usam allowlist; sem URL livre, bypass de captcha ou promoção automática de fonte secundária.
10. PII de carteira, e-mail e preferências não é enviada à IA quando não for necessária; logs devem ser minimizados e sanitizados.
11. Alertas por e-mail/WhatsApp exigem opt-in, cancelamento, deduplicação, cooldown e política de retenção.
12. WhatsApp depende de avaliação de custo, template, consentimento e LGPD. Telegram está adiado.
13. As PRs de segurança #1/#2 devem ser comparadas com dependências atuais e encerradas ou substituídas com justificativa versionada.

---

## 10. Variáveis de ambiente

Nenhum valor secreto deve ser salvo neste documento ou no Git.

### Confirmadas pelo proprietário

- `ADMIN_EMAILS` criada.
- `NEXT_PUBLIC_FIREBASE_API_KEY` existente na Vercel.
- `ENABLE_AUTOMATIC_MONITOR=true` em Preview e Produção.
- Créditos de IA adquiridos; isso não substitui limites de custo e cache.

### Firebase e serviços-base

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_SERVICE_ACCOUNT_KEY
ADMIN_EMAILS
OPENAI_API_KEY
CRON_SECRET
```

`NEXT_PUBLIC_FIREBASE_PROJECT_ID` deve apontar para o mesmo projeto Firebase usado pelo site e pelo backend. Fazer inventário de Preview/Produção antes da Sprint 2.12; não copiar valores de outro projeto apenas porque pertencem a um app iOS.

### Feature flags centrais verificadas no código

```text
ENABLE_SYSTEM_VALIDATION
ENABLE_HEALTH_MONITOR
ENABLE_AI_INSIGHTS
ENABLE_REPORT_PREMIUM
ENABLE_AUTOMATIC_MONITOR
ENABLE_SCORE_ENGINE
ENABLE_RISK_LAB_ADMIN
```

### Flags e configuração operacional documentadas

```text
ENABLE_PORTFOLIO_REGULATORY_INTELLIGENCE
PREMIUM_PREVIEW_EMAILS
MONITOR_ALERT_COOLDOWN_MS
MONITOR_ALERT_EMAILS
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASS
SMTP_FROM
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

Telegram é legado/opcional e fica desativado por decisão atual.

### Risk Lab

```text
ENABLE_RISK_LAB_ADMIN
ENABLE_RISK_LAB_AUTOMATIC_DISCOVERY
ENABLE_RISK_LAB_FNET_IMPORT
ENABLE_RISK_LAB_STRESS_RUN
```

`ENABLE_RISK_LAB_AUTOMATIC_DISCOVERY` controla o fluxo principal. FNET manual e stress run são diagnóstico. Todas as flags de Produção devem ter valor explícito e constar no dossiê sem revelar o valor de segredos.

### WhatsApp

Não criar nem exigir variáveis Twilio/WhatsApp antes da decisão da Sprint 4.3. A presença da dependência `twilio` no `package.json` não significa funcionalidade aprovada.

---

## 11. Testes obrigatórios

### Gate mínimo por release

```bash
npm run typecheck
npm run test:sprint2
npm run test:risk-lab
npm run build
```

O commit `b42034f` possui status Vercel verde, mas não teve workflow de Actions localizado porque a PR #42 foi documental. Isso não deve ser descrito como CI completo do release.

### Cobertura obrigatória da Sprint 2.12

- parser v2 com ao menos um FII e um FIAGRO;
- QA, reconciliação, publicação, backup, aprovação, hash e rollback;
- RegulatoryDataService sem acesso novo direto ao Firestore;
- Health, Validation, histórico, Admin e rate limit;
- P/VP, ágio/desconto, valor patrimonial por cota, liquidez e yield;
- dividendos mês a mês, total anual, maior mês e meses futuros/parciais;
- patrimônio da carteira com cota e quantidade corretas;
- notificação: mudança de rendimento, limiar de 3%, deduplicação e digest;
- Relatório Gratuito, Premium e AI Insights com FII, FIAGRO, FI-Infra, fundo incompleto e exceção;
- catálogo: universo B3/CVM, CNPJ único, ciclo de vida, sucessor, `null` externo e double check;
- jobs cron, IFIX e execução manual no Admin;
- smoke autenticado de Produção no commit exato.

### Cobertura obrigatória do Risk Lab

- hash/freeze; `knownAt`; bloqueio de look-ahead;
- identidade ticker/CNPJ e fontes permitidas;
- lacuna, duplicidade, reapresentação, conflito e ambiguidade;
- thresholds e unidade; data do anúncio; evento de crédito;
- dataset candidato/gold e aprovação restrita;
- coorte bloqueada até fonte primária;
- autenticação, rate limit, timeout e auditoria;
- isolamento de Premium, IA e notificações.

### Evidência persistida

Cada homologação deve gerar um arquivo em `docs/production-evidence/YYYY-MM-DD-<escopo>.md` contendo:

- commit SHA e branch;
- URL/ID do deployment e horário;
- ambiente e flags não secretas;
- comandos e resultado;
- fundos/amostra e motivo da seleção;
- passos de smoke e resultado esperado/obtido;
- exceções e limitações;
- evidência de generalização;
- decisão aprovar, bloquear ou reabrir.

Sem esse arquivo, o resultado pode ser considerado útil, mas não encerra formalmente uma fase.

### SEO

- sitemap, robots, canonical, redirects e dados estruturados;
- SSR e conteúdo rastreável;
- `noindex` para Admin/privado;
- Lighthouse/Core Web Vitals;
- ausência de páginas finas/duplicadas;
- métricas Search Console registradas antes/depois.

---

## 12. Pendências e decisões ainda abertas

### Bloqueadores imediatos

1. Executar a Sprint 2.12 e salvar o dossiê no Git.
2. Aplicar e auditar o catálogo em Produção; fazer double check.
3. Homologar amostra estratificada e confirmar que as correções são globais.
4. Executar o smoke autenticado do Risk Lab no deployment de `b42034f` ou no commit de release que o substituir.
5. Verificar fontes primárias da coorte e só então remover o bloqueio de execução.

### Produto e monetização

6. Definir preços, periodicidade, trial, cobrança, cancelamento, reembolso e impostos dos planos.
7. Confirmar existência e proposta do `Super Premium`; até lá, apenas Grátis e Premium possuem planejamento concreto.
8. Definir matriz final de entitlements, inclusive Radar, relatórios, limites de IA e personalização do limiar patrimonial.
9. Confirmar se 1/10 significa fundos simultaneamente acompanhados — interpretação vigente — ou limite por período.
10. Definir o modelo final do Premium e o limite entre informação personalizada e recomendação regulada.
11. Definir cache distribuído, quotas de IA, TTL, reuso de insights e orçamento mensal.

### Canais e notificações

12. WhatsApp: decidir se haverá, para quais planos, com qual provedor, custo, opt-in e templates.
13. Telegram: adiado; não implementar agora.
14. Medir em Produção a redução de ruído, taxa de abertura, opt-out, falsos alertas e consolidação de e-mail.

### Dados e fornecedores

15. Resolver ou documentar permanentemente as 11 lacunas externas de indicadores essenciais.
16. Confirmar identidade/ciclo de vida de fundos em revisão e aplicar inativação/sucessão com evidência oficial.
17. Avaliar licenciamento e SLA de cotações, volume e liquidez; nenhuma fonte improvisada entra em Produção sem contrato de dados.
18. Definir extração determinística de PDFs/FNET; documento não legível continua inconclusivo.
19. Definir monitoramento em tempo real apenas quando o valor justificar custo; jobs atuais permanecem periódicos.

### Engenharia e operação

20. Revisar e encerrar/atualizar as PRs abertas #1, #2 e #5.
21. Higienizar branches remotas após reconciliação, preservando recuperação.
22. Padronizar persistência e auditoria dos scans automáticos do Risk Lab.
23. Decidir se regras futuras exigem `v0.2.0`; qualquer mudança repete toda a coorte.
24. Mover ferramentas manuais antigas do Risk Lab para `/debug` ou removê-las após o fluxo automático ser homologado.

### SEO e crescimento

25. Iniciar Sprint SEO 1 após inventário técnico e baseline.
26. Definir os 20 fundos prioritários com base em demanda, qualidade de dados e oportunidade; não apenas popularidade.
27. Medir conversão orgânica para carteira, Radar e Premium, além de posição média.
28. Não comprar backlinks nem gerar páginas programáticas sem informação material própria.

### Prompt Premium v3

29. Implementar o contrato detalhado em `Referencias Relatorio Premium/REFERENCIAS_PROMPT_PREMIUM_FII.md`.
30. Validar por tipo de fundo, qualidade de dados, perfil de usuário e impacto na carteira.
31. Manter análise técnica, stop-loss e sinais `buy/sell` fora do núcleo até existir série confiável, metodologia validada e decisão jurídica/produto.

---

## Critérios para declarar as fases concluídas daqui em diante

Uma fase só pode ser declarada integralmente concluída quando:

1. código estiver integrado à `main`;
2. CI obrigatório estiver verde no commit de release;
3. deployment de Produção do commit exato estiver identificado e saudável;
4. smoke test estiver documentado;
5. cobertura tiver sido avaliada sobre todo o universo aplicável;
6. correções tiverem testes globais e amostra estratificada;
7. dados ausentes, conflitos e exceções estiverem explícitos;
8. double check e auditoria estiverem persistidos;
9. segurança, custo, rollback e observabilidade estiverem validados;
10. a evidência estiver salva no Git.

Até a conclusão da Sprint 2.12, a formulação correta é: **Fase 1 concluída em implementação; Fase 2 implementada e validada funcionalmente; encerramento formal das duas em reauditoria.**
