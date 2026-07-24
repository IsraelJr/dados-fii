Este documento substitui todos os planejamentos anteriores quando houver divergência.

# Dados FII — Documento Canônico de Handoff

**Versão:** 6.5.0  
**Data:** 24/07/2026  
**Repositório:** `IsraelJr/dados-fii`  
**Branch principal:** `main`  
**Base auditada antes desta atualização:** `1154adc3789cc99aa99c4926d2e3e8e52c2b1f92`  
**Último merge funcional com deployment saudável documentado:** `498654f03ce66bd54598d5a4677c18bbe5bbdc86`  
**Sprint corrente:** 3.5 — Coorte externa e backtest sem informação futura  
**Próxima unidade de trabalho:** 3.5-B1 — VSLH11  
**Política documental:** existe apenas um Handoff canônico versionado no repositório: `DADOS_FII_HANDOFF.md`.

## Como interpretar os status

- **Planejada:** decisão registrada, sem código iniciado.
- **Em implementação:** existe branch, issue ou PR ativa, mas o aceite não foi atingido.
- **Implementada:** existe código versionado no Git.
- **Testada em repositório:** existem testes automatizados versionados que cobrem o comportamento.
- **Implantada:** o commit exato possui deployment identificado e saudável.
- **Validada funcionalmente:** houve smoke test documentado ou validação operacional reproduzível.
- **Formalmente concluída:** código, CI, deployment aplicável, cobertura do universo da fase, segurança, custo e evidências foram auditados e persistidos no Git.
- **Inconclusiva:** os dados ou as evidências não permitem afirmar sucesso nem falha sem inventar informação.

Uma validação pontual, uma confirmação verbal, um workflow verde ou o teste de poucos tickers não concluem, isoladamente, uma fase.

## Decisões vigentes que substituem decisões anteriores

| Decisão vigente | Decisão anterior substituída | Estado de implementação | Motivo/evidência |
|---|---|---|---|
| Este Handoff v6.5.0 é a única referência canônica quando houver divergência. | Handoffs versionados na Biblioteca, inclusive v6.3.0, e versões anteriores do arquivo raiz. | Documental | Evitar planejamento concorrente e decisões contraditórias. |
| Fases 1 e 2 estão formalmente concluídas em Produção sob evidência schema v2. | “Fase 2 apenas validada funcionalmente” ou conclusão baseada em fundos sentinela. | Concluída | Carga global, double check, checks de domínio e evidências persistidas. |
| Sprint corrente canônica é a 3.5. | Sprint 3.4 como sprint corrente. | Em andamento | Sprint 3.4 foi homologada; a coorte externa permanece incompleta. |
| A Sprint 3.5 é executada em fases independentes, um fundo por PR. | Execução monolítica dos seis fundos e recovery automático por commits. | Parcial | DEVA11 comprovou o modelo; os outros cinco fundos ainda faltam. |
| Fase 3.5-A — DEVA11 está formalmente concluída. | DEVA11 pendente, dependente de workflow temporário ou de aprovação manual. | Concluída | 85/85 documentos, zero pendências, zero conflitos, 65 competências e hashes reproduzíveis. |
| A próxima fase é 3.5-B1 — VSLH11 e não inicia automaticamente. | Retomar todos os fundos em paralelo. | Planejada | Redução de risco e evidência isolada por fundo. |
| GitHub Actions é ferramenta de engenharia ligada a código/SHA, não infraestrutura operacional. | Actions como cron de negócio, fila, polling, storage, retry ou recovery. | Concluída | PR #101 eliminou cascatas e reduziu a projeção mensal de uso. |
| O estado operacional de backtests fica no backend/Firestore; o workflow faz apenas kickoff curto. | Runner aguardando locks, dormindo ou processando longamente. | Parcial | A arquitetura foi definida; a automação final depende das fases 3.5-E/F. |
| A coleta FNET pesada fica manual e limitada até migrar para fila/worker persistente. | Execução pesada automática a cada push. | Parcial | Evita custo e timeout; worker permanece dívida técnica. |
| Toda correção de dados, cálculo ou parser é global e possui regressão; patch por ticker é proibido. | Ajustes especiais para fundos sentinela. | Regra obrigatória | O mesmo defeito pode afetar todo o universo. |
| O Relatório Premium recebe cálculos determinísticos e dados estruturados antes da IA. | IA recalculando pesos, regras, scores ou preenchendo lacunas. | Parcial | Prompt v3 e integração read-only entram na Sprint 3.7. |
| O Prompt Premium v3 usa metodologia própria para FII, FIAGRO e FI-Infra; prompts genéricos de ações e personas de bancos não são o diferencial. | Copiar estruturas de análise de ações ou usar marca/persona como prova de qualidade. | Especificado | Referências visuais foram convertidas em contrato de dados, evidência e testes. |
| Análise técnica fica fora do núcleo do Relatório Premium. | Incluir sinais técnicos, stop, target ou strong buy/sell no relatório principal. | Decisão vigente | Só poderá existir como módulo separado após séries confiáveis, metodologia, backtest e análise jurídica. |
| O Plano SEO de 90 dias é uma trilha oficial paralela e começa pela SEO Foundation. | SEO tratado como tarefa futura sem ordem ou critério de saída. | Planejada | A sequência oficial é indexação → páginas superiores → diferenciação → autoridade. |
| “Acompanhar um fundo” fora da carteira é a Fase 4/Radar; regra-base: 1 fundo no Grátis e 10 no Premium. | Radar como Fase 3 ou limite apenas no cliente. | Planejada | O limite deve ser validado no servidor e o Risk Lab precisa ser homologado antes de alimentar decisões. |
| O mês corrente não participa de maior/menor mês, total, média ou consolidações históricas; snapshots mensais continuam no primeiro dia. | Mês corrente tratado como mês fechado ou alteração do snapshot legado. | Decidida, PR #65 aberta | Evita resultado dependente de dados provisórios do navegador versus Firestore. |
| Ao cadastrar histórico, o usuário informa o mês; o ano só é solicitado/criado quando necessário. | Cadastro obrigatoriamente por mês e ano em todos os casos. | Planejada | Mantém a experiência simples sem perder a competência histórica. |
| Notificações exigem mudança material; alertas correlatos são consolidados em digest. | Notificação diária sem mudança e múltiplos e-mails no mesmo ciclo. | Parcial | Menor ruído e maior confiança. |
| Variação patrimonial padrão para alerta é 3%, configurável para planos elegíveis. | Alertar qualquer oscilação patrimonial ou usar limiar oculto. | Parcial | Regra definida; precisa de auditoria integral do cálculo e do valor-base. |
| IFIX é sincronizado no ciclo oficial de janeiro, maio e setembro, com execução manual no Admin. | Sincronização diária. | Parcial | Menor custo sem perda funcional. |
| `ADMIN` é autorização, não plano comercial. | Mostrar ADMIN como nome do plano. | Decisão vigente | Separa segurança de monetização. |
| Telegram permanece adiado; WhatsApp continua aberto. | Telegram obrigatório ou envio multicanal imediato. | Decisão vigente | Canal só entra com custo, opt-in, templates e métricas definidos. |

---

## 1. Estado atual do projeto

### Resumo executivo

- O Dados FII já possui fundação regulatória, camada de serviços, scores, validação, Dashboard Admin, Timeline Regulatória, relatórios, IA, observabilidade, monitor e notificações.
- Fases 1 e 2 estão formalmente concluídas, conforme evidências já versionadas.
- Catálogo canônico auditado: `504/504` ativos com cadastro básico, `97,81%` de cobertura essencial aplicável e zero CNPJ duplicado no run canônico.
- Risk Lab 3.0–3.4 está concluído; Sprint 3.4 foi homologada com `11/11` checks, `6/6` casos e zero blockers.
- Sprint 3.5 permanece aberta. Somente a reorganização 3.5-R e o caso DEVA11 3.5-A estão concluídos.
- A próxima unidade é 3.5-B1 — VSLH11; não há autorização para iniciar B2–B5 em paralelo.
- O Risk Lab continua isolado do Premium e das notificações até o gate formal da Sprint 3.5 completa.
- A otimização do GitHub Actions foi integrada no merge `d3c98666f083e6fe2a89c5fe3ce78a6c884eb1f9`.
- O `main` auditado antes deste documento estava em `1154adc3789cc99aa99c4926d2e3e8e52c2b1f92`.
- O último merge funcional com deployment saudável documentado é `498654f03ce66bd54598d5a4677c18bbe5bbdc86`.
- O acesso direto ao domínio de Produção não pôde ser reexecutado nesta auditoria por indisponibilidade de resolução DNS nas ferramentas usadas. Portanto, nenhuma fase nova foi promovida por esta revisão; foram mantidos apenas os status sustentados por evidência persistida no Git, CI e registro de deployment.
- O Plano SEO de 90 dias está pronto, mas a baseline de Search Console e indexação ainda não foi registrada.
- O Radar/Acompanhar fundo, Prompt Premium v3, ledger histórico, risco avançado, screener e fair value continuam pendentes ou parciais conforme este documento.

### Auditoria do estado de conclusão

| Área | Código | Testes | Deployment/Produção | Evidência no Git | Status vigente |
|---|---:|---:|---:|---:|---|
| Fase 1 — Regulatory Engine | Sim | Sim | Sim | Schema v2, publicação e rollback | **Concluída** |
| Fase 2 — Core Intelligence | Sim | Sim | Sim | Checks globais e catálogo auditado | **Concluída** |
| Fase 3 — Risk Lab até 3.4 | Sim | Sim | Sim | 11/11 checks e 6/6 casos | **Concluída até 3.4** |
| 3.5-R — reorganização | Sim | Sim | n/a | Plano faseado e recovery removido | **Concluída** |
| 3.5-A — DEVA11 | Sim | Sim | Deployment saudável documentado; sem efeito de produto | 85/85, 65 meses e hashes | **Concluída** |
| Sprint 3.5 completa | Parcial | Parcial | Não aplicável como produto ainda | Cinco fundos, dataset e backtest faltam | **Em andamento** |
| Otimização GitHub Actions | Sim | Sim | Preview/deployment documentados | Política, inventário e teste de governança | **Concluída** |
| Regra de meses encerrados | Código em PR #65 | 89/89 na branch declarada | Não mesclada | PR aberta | **Em implementação** |
| SEO 90 dias | Não | n/a | Não iniciado | Plano e critérios definidos | **Planejada** |
| Prompt Premium v3 | Contrato pronto | Casos definidos | Não implantado | Referências documentadas | **Planejada para 3.7** |
| Radar/Acompanhar fundo | Não | Não | Não | Regras de negócio definidas | **Planejada para 4.x** |

### Estado da automação de engenharia

Estado integrado em `main`:

- 5 workflows ativos;
- nenhum workflow escreve no repositório;
- nenhum workflow pesado dispara por push;
- nenhum `sleep` ou polling operacional;
- timeout comum de até 20 minutos, com uma exceção manual documentada de 30 minutos;
- `npm ci` e cache nos jobs Node;
- diagnóstico de falha com retenção curta;
- projeção documentada de redução de 2.140 para 529 minutos/mês, chegando a aproximadamente 504 após migração da coleta para worker.

### Pendências de dados conhecidas

- PF/PJ não publicado nas fontes estruturadas para `BFCC11`, `BRHT11`, `BTML11`, `FINF11`, `IDUA11`, `MTOF11`, `PBLV11`, `REME11`, `RRES11` e `SPAF11`.
- `RJDA11` também sem cotas emitidas, patrimônio líquido e total de cotistas nos layouts usados.
- Divergências históricas de ISIN em revisão: `KISU11`, `SPTW11` e `TRXF11`.
- `HGPO11` está inativado com evidência oficial e histórico preservado.
- Lacuna externa permanece `null`, acompanhada de fonte, data e aviso; nunca vira zero inventado.

---

## 2. Fases concluídas

### Fase 1 — Regulatory Engine

**Status:** formalmente concluída.

**Escopo concluído:** parser CVM v2; suporte FII/FIAGRO; reconciliação; QA; staging/produção; backup; hash; publicação protegida; rollback; CI e trilha de auditoria.

**Regra de permanência do status:** qualquer regressão de parser, reconciliação, publicação, segurança ou rollback reabre a fase ou gera sprint corretiva antes de novas funcionalidades dependentes.

### Fase 2 — Core Intelligence & Product Foundation

**Status:** formalmente concluída.

**Escopo concluído:** `RegulatoryDataService`, `Repository`, `Normalizer`, `Validator`, cache e tipos; `ScoreEngine`; Health; Validation; Admin; Timeline; relatórios; AI Insights; observabilidade; monitor; catálogo; notificações e jobs.

**Evidência de generalização:** conclusão não se baseia somente em TGAR11, VGIA11, MXRF11, KNCA11 ou BODB11; o status exige checks globais do catálogo e regressão do universo aplicável.

### Fase 3 — Risk Lab

- Sprints 3.0 a 3.4: concluídas.
- Fase 3.5-R: concluída.
- Fase 3.5-A — DEVA11: concluída.
- Sprint 3.5 completa: aberta.
- Integração com Premium/notificações: proibida antes do gate da Sprint 3.5 completa e da Sprint 3.6.

### Evidência canônica da Fase 3.5-A — DEVA11

- PR: `#105`;
- merge: `498654f03ce66bd54598d5a4677c18bbe5bbdc86`;
- documentos descobertos/classificados: `85/85`;
- pendências: `0`;
- conflitos: `0`;
- observações brutas: `67`;
- competências selecionadas: `65`;
- lacuna explícita: `2024-07`;
- classe secundária e documento fora da janela tratados por regras gerais;
- duas execuções independentes com hashes idênticos;
- checkpoint: `6b923ceeff2a0a9ddcd27d72b4d8125d3b2cc6aca6109c57531c3efed36d4a89`;
- caso: `fca3de0e38755c8213d7e37d5112b51733c794dd29a2f2f7cb5be82980313aa2`;
- auditoria: `157e807f7a61c4d9bb34eedc324e761c8a19c25ac93505023606f6ffcd2159af`;
- observações combinadas: `6788292746eeb5321d36cd198c75b5810c3797cead357341cc04df9254fee20c`;
- índice de evidência: `62a19d9b20b57b49489d7ab51ed85d72505625ca68f47762a5045fc3c650993b`.

### O que não está concluído

- Sprint 3.5 completa;
- Risk Lab integrado ao produto;
- Prompt Premium v3;
- alertas de impacto regulatório;
- Radar/Acompanhar fundo;
- SEO Foundation;
- ledger histórico e atribuição completa;
- screener, comparador customizável e fair value por categoria;
- monetização definitiva e canais WhatsApp/Telegram.

---

## 3. Sprint atual

### Sprint 3.5 — Coorte externa e backtest sem informação futura

**Objetivo:** verificar uma coorte pré-registrada com fontes primárias, congelar o dataset e executar backtest sem look-ahead, preservando o ruleset `v0.1.0` até a etapa formal de calibração.

**Coorte:** `DEVA11`, `VSLH11`, `KNCR11`, `KNSC11`, `MCCI11`, `RBRY11`.

**Sequência interna obrigatória:**

1. 3.5-R — reorganização e pausa operacional: concluída;
2. 3.5-A — DEVA11: concluída;
3. 3.5-B1 — VSLH11: próxima, não iniciada;
4. 3.5-B2 — KNCR11: pendente;
5. 3.5-B3 — KNSC11: pendente;
6. 3.5-B4 — MCCI11: pendente;
7. 3.5-B5 — RBRY11: pendente;
8. 3.5-C — dataset congelado da coorte: pendente;
9. 3.5-D — backtest offline: pendente;
10. 3.5-E — automação controlada: pendente;
11. 3.5-F — validação em Produção e decisão de produto: pendente.

**Contrato de cada fundo das fases A/B:**

- branch e PR próprias;
- documentos oficiais classificados;
- zero pendências na janela ou justificativa formal inconclusiva;
- zero conflitos não explicados;
- série mensal legível e auditável;
- fonte, URL, trecho, página quando aplicável, versão e hash;
- decisões de seleção/exclusão explícitas;
- duas execuções com hashes idênticos;
- finalizador e regras reutilizáveis, sem exceção por ticker;
- testes sintéticos de falha fechada;
- teste integral da evidência real;
- CI e deployment do SHA final verdes quando aplicável;
- auditoria pós-merge em `main`.

**Critério de aceite da Sprint 3.5 completa:**

- seis casos completos;
- zero pendências ou conflitos não explicados;
- nenhum controle saudável recebe vermelho injustificado;
- ambiguidades permanecem inconclusivas;
- zero look-ahead;
- dataset congelado, versionado e com hash reproduzível;
- métricas de falso positivo, falso negativo, cobertura, inconclusão e antecedência calculadas;
- automação controlada sem polling/commit/retry artificial;
- auditoria, segurança, custo, rollback e CI aprovados;
- evidência final no Git.

**Proibições:**

- recalibrar o ruleset usando a mesma coorte antes da Sprint 3.6;
- integrar resultados ao Premium ou alertas;
- pedir ao proprietário para classificar documentos ou aprovar conteúdo técnico fundo a fundo;
- concluir a sprint por workflow verde sem evidência de domínio;
- criar regra por ticker para fazer um caso passar.

---

## 4. Ordem oficial das próximas sprints

### Trilha principal de produto e dados

1. **3.5-B1 a 3.5-F — concluir a coorte externa e o backtest.**
2. **3.6 — Métricas, calibração fora da coorte e gate formal de produto.**
3. **3.7 — Risk Lab read-only no Premium + Prompt Premium v3.**
4. **3.8 — Impacto por posição/carteira + alertas opt-in.**
5. **4.1 — Radar: acompanhar fundo fora da carteira.**
6. **4.2 — Radar: eventos, tese e relatório pré-compra.**
7. **4.3 — Planos, preferências, canais e monetização.**
8. **5.1 — Carteira histórica verdadeira e ledger imutável.**
9. **5.2 — Motor de risco, exposição, correlação e atribuição.**
10. **5.3 — Inteligência sobre comunicados oficiais e event store.**
11. **5.4 — Screener quantitativo, filtros salvos, pares e fair value.**
12. **5.5 — Benchmark, decomposição do retorno, calendário avançado, fiscal e simuladores.**

### Trilha SEO paralela

- **SEO-S1 — Dias 1–15:** Foundation/indexação.
- **SEO-S2 — Dias 16–45:** aproximadamente 20 páginas prioritárias.
- **SEO-S3 — Dias 46–70:** long tails, comparações e conteúdo diferenciado.
- **SEO-S4 — Dias 71–90:** autoridade, distribuição e estudos originais.

A trilha SEO ocorre em paralelo e não altera a ordem técnica do Risk Lab. Incidente de segurança, dados ou Produção interrompe a ordem normal.

### Mapeamento das funcionalidades competitivas de maior ganho

| Capacidade de alto valor | Sprint oficial | Dependência mínima |
|---|---|---|
| Inteligência sobre documentos e “o que mudou” | 5.3, com base já existente | Event store, parser, confiança e vínculo com carteira |
| Risco/exposição/atribuição acionável | 5.2 | Ledger, séries confiáveis e campos por categoria |
| Carteira histórica verdadeira | 5.1 | Ledger imutável, eventos corporativos e reconciliação |
| Alertas multigatilho e digest por impacto | 3.8 e 4.2/4.3 | Risk Lab homologado, preferências, deduplicação e opt-in |
| Screener quantitativo com filtros salvos | 5.4 | Factor store, cobertura mínima e ranking reproduzível |
| Fair value e sustentabilidade de dividendos | 3.7 e 5.4 | Modelos por tipo, premissas, faixa e confiança |
| Retorno total versus renda/benchmarks | 5.5 | Ledger, preço ajustado, proventos e benchmarks |
| Calendário anúncio → data-com → pagamento | 4.2 e 5.5 | Event store e fontes oficiais |

---

## 5. Escopo e critérios de aceite de cada sprint

### 3.5 — Coorte externa e backtest

Escopo e aceite definidos na seção 3. Não concluir com fundo faltante, evidência parcial, artefato opaco ou exceção por ticker.

### 3.6 — Métricas, calibração e gate formal

**Escopo:** calcular métricas por papel da coorte, antecedência útil, falsos positivos/negativos, inconclusão, cobertura e estabilidade; calibrar somente com conjunto separado; documentar limites do ruleset.

**Aceite:**

- conjunto de calibração independente da coorte de validação;
- métricas reproduzíveis com intervalo e denominador explícitos;
- nenhuma melhora de métrica por remoção silenciosa de caso;
- thresholds versionados e explicados;
- comparação antes/depois da calibração;
- teste de regressão dos controles saudáveis;
- decisão formal: rejeitar, manter em laboratório ou promover para integração read-only.

### 3.7 — Risk Lab read-only no Premium e Prompt Premium v3

**Escopo:** disponibilizar sinais homologados como dados estruturados de leitura; implantar contrato de entrada, evidência e resposta do Prompt Premium v3; manter cálculo no backend e interpretação na IA.

**Aceite:**

- snapshot de entrada salvo com fontes, competências e timestamps;
- cálculos de peso, metas, concentração, quantidade comprável e saldo executados no servidor;
- fatos, cálculos, estimativas, inferências, indisponíveis e inconclusivos separados;
- metodologia adaptada a tijolo, papel/CRI, desenvolvimento/híbrido, FoF, FIAGRO e FI-Infra;
- nível de confiança e idade dos dados visíveis;
- modo degradado sem valuation inventado;
- comparação apenas entre pares equivalentes;
- mesma entrada produz resultado coerente e auditável;
- nenhuma ordem automática, promessa de retorno ou recomendação definitiva;
- análise técnica fora do prompt principal;
- teste mínimo de um fundo de cada categoria e cenários de dados completos, incompletos, conflitantes e implausíveis;
- consistência entre Relatório, Premium, ScoreEngine e Risk Lab;
- custo/tokens, repetição, jargão e afirmações sem evidência medidos.

### 3.8 — Impacto na carteira e alertas opt-in

**Escopo:** calcular impacto marginal e absoluto do evento/sinal em cada posição e na carteira; alertas por severidade e digest.

**Aceite:**

- opt-in explícito;
- cooldown, deduplicação e idempotência;
- limiares configuráveis conforme entitlement;
- padrão de variação patrimonial de 3% onde aplicável;
- nenhuma notificação sem mudança material;
- e-mails correlatos consolidados em um digest;
- motivo, fonte, competência e impacto em reais/percentuais quando possível;
- métricas de abertura, opt-out, falso alerta, atraso e sessão pós-alerta;
- Risk Lab continua read-only e não executa ordem.

### 4.1 — Radar: acompanhar fundo fora da carteira

**Escopo:** permitir que o usuário marque um fundo que ainda não possui e acompanhe sua evolução para decidir se deseja comprá-lo.

**Regras vigentes:**

- Grátis: até 1 fundo;
- Premium: até 10 fundos;
- Super Premium: entitlement ainda aberto;
- fundo já presente na carteira não consome vaga do Radar;
- limite é validado no servidor, não apenas na interface;
- inclusão/remoção idempotente;
- usuário autenticado e dono do recurso;
- sem acesso direto novo ao Firestore fora do serviço/repositório de domínio;
- histórico preserva quando o fundo entrou/saiu do Radar.

**Aceite:**

- adicionar, listar e remover fundo;
- impedir duplicidade e ultrapassagem de limite;
- estado consistente em múltiplos dispositivos;
- fonte e freshness visíveis;
- custo por usuário/fundo medido;
- nenhum alerta automático sem preferência explícita;
- testes de autorização, concorrência e troca de plano.

### 4.2 — Radar: eventos, tese e relatório pré-compra

**Escopo:** timeline do fundo acompanhado; fatos relevantes, dividendos, emissões, mudanças de risco e relatório “o que preciso saber antes de comprar?”.

**Aceite:**

- evento oficial normalizado e versionado;
- resumo “o que mudou” e “por que importa” sem inventar fato;
- tese, riscos, renda, pares e gatilhos de revisão;
- relatório usa o mesmo contrato do Premium v3 e estado inconclusivo;
- alerta somente por mudança material e preferência do usuário;
- vínculo entre Radar, página pública, documento e eventual entrada na carteira.

### 4.3 — Planos, preferências, canais e monetização

**Escopo:** entitlements, limites, upgrade/downgrade, cobrança, preferências, e-mail e eventual WhatsApp.

**Aceite:**

- matriz Grátis/Premium/Super Premium aprovada;
- preços, periodicidade, trial, cancelamento, reembolso, impostos e inadimplência definidos;
- entitlements testados no backend;
- downgrade não apaga dados sem política explícita;
- WhatsApp somente com provedor, custo, opt-in, templates e opt-out;
- Telegram permanece fora do escopo até nova decisão;
- métricas de conversão, churn, custo de IA e custo por canal.

### 5.1 — Carteira histórica e ledger imutável

**Escopo:** compras, vendas, subscrições, integralizações, custos, proventos, caixa, eventos corporativos, snapshots reproduzíveis e reconciliação.

**Aceite:**

- eventos imutáveis e reprocessamento idempotente;
- preço médio e posição reproduzíveis em qualquer competência;
- distinção entre histórico confirmado, importado e divergente;
- centro de reconciliação;
- mês corrente fora de consolidações históricas fechadas;
- cadastro mensal cria/solicita ano somente quando necessário;
- testes de grupamento, desdobramento, subscrição, venda parcial, custo e retroatividade.

### 5.2 — Risco, exposição e atribuição

**Escopo:** exposição por fundo, segmento, gestor, inquilino/devedor, indexador, garantia e geografia; correlação; liquidez; stress; drawdown; contribuição marginal; atribuição de retorno e renda.

**Aceite:**

- contrato de campos A/B/C por categoria;
- cobertura mínima verificada antes de usar uma dimensão;
- impacto em reais e pontos percentuais quando possível;
- retorno de preço, renda, total e real separados;
- cenário base/positivo/adverso com premissas, sem probabilidades arbitrárias;
- nenhum dado ausente tratado como risco do fundo.

### 5.3 — Inteligência sobre comunicados oficiais

**Escopo:** event store para documentos, fatos relevantes, assembleias, emissões, dividendos e mudanças materiais; resumo acionável e vínculo com carteira/Radar.

**Aceite:**

- fonte oficial prioritária;
- extração híbrida e score de confiança;
- versões/reapresentações reconciliadas;
- “fato da fonte” separado de “declaração da gestão” e “inferência”;
- p95 de atualização definido e medido;
- falha de extração gera inconclusão, nunca alerta categórico;
- link para documento oficial e trilha de correção.

### 5.4 — Screener, pares e fair value

**Escopo:** factor store, filtros salvos, presets de tese, ranking reproduzível, comparação por mandato, exportação e valuation por categoria.

**Aceite:**

- cobertura e universo exibidos;
- filtros comuns: tipo, segmento, P/VP contextualizado, DY, liquidez, score e confiança;
- “melhor” sempre condicionado aos critérios escolhidos;
- pares selecionados por mandato e risco;
- fair value como faixa, com premissas e fatores que quebram o modelo;
- modelos específicos para tijolo, crédito, desenvolvimento, FoF, FIAGRO e FI-Infra;
- teste contra falsa precisão e armadilha de DY/P/VP.

### 5.5 — Benchmark, retorno, calendário, fiscal e simuladores

**Escopo:** IFIX/CDI/IPCA/Selic, retorno total, calendário completo, projeção de renda/reinvestimento, comparações, centro fiscal/documental e simuladores.

**Aceite:**

- benchmark adequado e base temporal comparável;
- anúncio, data-com, pagamento e competência separados;
- projeções com premissas e faixa;
- cálculos reproduzíveis pelo ledger;
- conteúdo fiscal com fonte, competência e aviso jurídico;
- sem simulação impossível de executar com cotas inteiras.

### SEO-S1 — Foundation, dias 1–15

**Escopo:** Search Console, baseline, sitemap, robots, canonical, domínio único, redirects, SSR, rastreabilidade, links internos, noindex de Admin/privado, dados estruturados e Core Web Vitals.

**Aceite:** páginas prioritárias rastreáveis e elegíveis; sitemap processado sem erros relevantes; domínio canônico consistente; métricas iniciais registradas; Admin/carteira privada não indexáveis.

### SEO-S2 — Páginas prioritárias, dias 16–45

**Escopo:** cerca de 20 fundos definidos por busca, liquidez, usuários e relevância; páginas com identidade, fontes, atualização, valuation contextual, dividendos, liquidez, IFIX, mudanças, riscos, pares, timeline, metodologia, FAQ e glossário.

**Aceite:** conteúdo substancial e único; sem páginas rasas/duplicadas; fontes e datas reais; links internos; qualidade editorial e conversão medidas.

### SEO-S3 — Diferenciação, dias 46–70

**Escopo:** long tails de alta intenção, comparações, resumos gerenciais, dividendos/eventos, rankings explicáveis e dúvidas recorrentes.

**Aceite:** cada página possui utilidade própria, evidências e conteúdo material; nenhuma geração em massa sem revisão, diferenciação e valor; canibalização monitorada.

### SEO-S4 — Autoridade, dias 71–90

**Escopo:** estudos de IFIX, cotistas, dividendos, riscos documentais, DY histórico, cobertura regulatória e casos como TGAR11/HCTR11; distribuição legítima.

**Aceite:** referências externas naturais; nenhuma compra de links/rede artificial; revisão de 90 dias com indexação, consultas, CTR, posições, conversão e páginas a consolidar/remover.

---

## 6. Regras arquiteturais obrigatórias

### Dados e domínio

1. APIs novas não acessam Firestore diretamente quando existe serviço/repositório de domínio.
2. `RegulatoryDataService` centraliza cache, regras, métricas e auditoria regulatória.
3. O desenho-alvo mantém cinco primitivas: entity master, ledger imutável, event store, factor store e motor de alertas por impacto.
4. Dado oficial ausente não é inventado nem convertido em zero.
5. Toda correção é generalizada e coberta por regressão no universo aplicável.
6. Campo avançado só fundamenta funcionalidade quando a cobertura mínima é comprovada.
7. Campos são classificados como A — essenciais, B — enriquecedores ou C — opcionais.
8. Abaixo de 70% de cobertura dos campos A, a interface final não deve ser prometida; entre 70% e 85%, somente beta controlado; a partir de 85%, pode avançar com confiança e estado de dado insuficiente.
9. IA não decide regra, score, alerta ou verdade-terreno.
10. Artefato metodológico preserva identidade, janela, fonte, URL, versão, hash, `knownAt` e decisão de seleção/exclusão.
11. Lacuna documental permanece explícita.
12. Reapresentações são reconciliadas por regra geral e versão oficial.

### Relatório Premium e IA

1. Backend calcula pesos, metas, quantidades, saldos, concentrações, variações e validade dos dados.
2. IA interpreta tese, sustentabilidade, riscos, oportunidades, cenários e consequência para a carteira.
3. Toda afirmação relevante recebe rótulo interno: `fact`, `calculation`, `estimate`, `inference`, `unavailable` ou `inconclusive`.
4. Governança forte nunca decorre apenas de gestor/administrador identificados.
5. CNPJ ausente é falha da base, não risco do fundo.
6. Liquidez implausível é bloqueada e reprocessada.
7. Ágio/desconto não equivale a recomendação.
8. Valor justo é faixa com premissas, não número exato.
9. Queda de preço sem mudança de fundamento não altera automaticamente o valor justo.
10. O relatório mostra fonte, competência, timestamp, idade do dado e confiança.
11. A interface não exibe nome interno de prompt/engine; usa “Conteúdo informativo, sem recomendação de investimento.”

### GitHub Actions

1. Usar somente no ciclo de código, status check, schema, build/auditoria ligada a SHA ou kickoff curto.
2. Proibido cron de negócio, fila, polling, sleep, storage operacional e monitor contínuo.
3. Proibido commit, push, PR, merge ou retry artificial dentro de workflow operacional.
4. CI em PR; pós-merge somente validação curta em `main`.
5. Todo workflow possui `concurrency` e `cancel-in-progress: true`.
6. `npm ci`, lockfile e cache são obrigatórios.
7. Timeout comum até 20 minutos; exceção manual documentada até 30 minutos.
8. Artefato operacional com retenção curta; padrão atual de 3 dias e limite de 7.
9. Workflow pesado somente manual e condicional.
10. `tests/github-actions-governance.test.mjs` bloqueia regressões.

### Vercel e operação

- Fluxo: PR → CI rápida → merge → deploy único → validação curta → negócio no backend → evidência final.
- Cron de negócio pertence ao `vercel.json`/backend.
- Nenhum cron agressivo é criado sem confirmar limite/custo do plano.
- A coleta FNET deve migrar para worker/fila persistente antes de automação contínua.
- Preview e Produção são auditados separadamente.
- Deploy de código de laboratório não ativa Premium, alerta nem execução automática.

### Política documental

- `DADOS_FII_HANDOFF.md` é o único Handoff canônico no Git.
- Não criar `DADOS_FII_HANDOFF_vX.Y.Z.md` no repositório.
- Versões antigas ficam no histórico do Git, não como arquivos paralelos.
- Documentos de pesquisa podem existir em `docs/`, mas não substituem o Handoff.
- Cópias antigas presentes na Biblioteca do ChatGPT são consideradas substituídas e devem ser removidas manualmente, pois a integração disponível nesta auditoria é somente leitura.

---

## 7. Arquivos, branches, commits e PRs existentes

### Branch principal e commits canônicos

- `main` antes desta atualização: `1154adc3789cc99aa99c4926d2e3e8e52c2b1f92` — estabilização de metadados do Handoff, PR #107.
- `0f38462340442e39e47074454236498d26131c2c` — conclusão canônica do DEVA11, PR #106.
- `498654f03ce66bd54598d5a4677c18bbe5bbdc86` — implementação funcional da Fase 3.5-A, PR #105.
- `d3c98666f083e6fe2a89c5fe3ce78a6c884eb1f9` — otimização de GitHub Actions, PR #101.
- `fb926f241a57a3d1c0f1a701f82701f302fece1a` — reorganização faseada da Sprint 3.5.

### PRs concluídas relevantes

- **#101:** redefine uso do GitHub Actions e elimina cascatas — mesclada.
- **#105:** conclui fase determinística do DEVA11 — mesclada.
- **#106:** registra a conclusão canônica da fase DEVA11 — mesclada.
- **#107:** estabiliza metadados do Handoff canônico — mesclada.
- **#96:** retomadas em lotes — fechada sem merge.
- **#100:** primeira implementação isolada do DEVA11 — fechada/substituída.
- **#103:** PR empilhada do DEVA11 — fechada/substituída.
- **#104:** tentativa técnica de sincronização — fechada sem merge.

### PRs abertas auditadas em 24/07/2026

| PR | Estado | Leitura canônica | Ação vigente |
|---|---|---|---|
| #5 | Draft antiga, não mergeável | Whitelist TGAR11/VGIA11, workflow durável e outras entregas antigas conflitam com generalização e arquitetura atual | Fechar como superseded, preservando branch/histórico |
| #65 | Draft, mergeável | Implementa decisão vigente de excluir mês corrente dos resumos históricos | Manter aberta para revisão, atualização com `main`, CI e merge separado |
| #77 | Aberta, mergeável | Preserva tentativa antiga reprovada da Sprint 3.5, 0/6 conclusivos | Fechar como superseded pela arquitetura faseada e PR #105 |
| #80 | Aberta, mergeável | Preserva tentativa antiga reprovada da Sprint 3.5, 0/6 conclusivos | Fechar como superseded pela arquitetura faseada e PR #105 |

### Arquivos centrais da otimização

- `.github/workflows/phase-2-closure.yml`
- `.github/workflows/portfolio-notifications-ci.yml`
- `.github/workflows/risk-lab.yml`
- `.github/workflows/risk-lab-cohort-backtest.yml`
- `.github/workflows/risk-lab-frozen-dividend-notices.yml`
- `src/app/api/admin/system/risk-lab/cohort-backtest/route.ts`
- `tests/github-actions-governance.test.mjs`
- `docs/engineering/github-actions-policy.md`
- `docs/engineering/github-actions-inventory.md`
- `docs/engineering/github-actions-audit-2026-07-22.md`

### Arquivos da Fase 3.5-A

- `docs/production-evidence/risk-lab/deva11-phase-a-manifest.json`
- `docs/production-evidence/risk-lab/deva11-phase-a/index.json`
- `docs/production-evidence/risk-lab/deva11-phase-a/observations-2021.json` a `observations-2026.json`
- `docs/risk-lab/sprint-3-5-a-deva11.md`
- `src/lib/risk-lab/SingleFrozenDividendCaseFinalizer.ts`
- `scripts/finalize-frozen-dividend-case.ts`
- `tests/risk-lab-deva11-phase-a.test.ts`
- `tests/risk-lab-deva11-evidence.test.mjs`

### Arquivos estratégicos incorporados por esta atualização

- `docs/strategy/PLANO_SEO_90_DIAS_DADOS_FII.md`
- `docs/sources/premium-prompt/REFERENCIAS_PROMPT_PREMIUM_FII.md`
- `docs/sources/premium-prompt/README.md`

### Arquivos removidos ou proibidos

- `.github/workflows/patch-portfolio-notification-types.yml`
- `.github/workflows/risk-lab-cohort-deploy-recovery.yml`
- `.github/workflows/risk-lab-deva11-phase-a.yml`
- `docs/production-evidence/risk-lab/sprint-3-5-deploy-trigger.json`
- artefato monolítico `observations.json.gz.base64` do DEVA11
- qualquer novo Handoff versionado em paralelo ao arquivo raiz.

---

## 8. Funcionalidades concluídas, parciais e pendentes

### Concluídas

- Fase 1 — Regulatory Engine;
- Fase 2 — Core Intelligence & Product Foundation;
- Risk Lab 3.0–3.4;
- Sprint 3.5-R;
- Sprint 3.5-A — DEVA11;
- infraestrutura de relatórios, IA, observabilidade e monitor;
- política e implementação de redução de GitHub Actions;
- base de alertas, deduplicação, cooldown, histórico e e-mail;
- calendário e benchmarks básicos;
- snapshots mensais existentes, respeitando que isso ainda não equivale a ledger completo.

### Parciais

- **Sprint 3.5:** DEVA11 concluído; demais fundos, dataset, backtest e automação pendentes.
- **Coleta FNET:** coletor, testes e checkpoints existem; worker persistente fora do Actions pendente.
- **Notificações:** mecanismos existem; regra final de materialidade, digest único e auditoria do patrimônio precisam ser fechadas.
- **Relatório Premium:** versão atual existe; Prompt v3, read-only Risk Lab, contratos por categoria, confiança e modo degradado pendentes.
- **Carteira histórica:** snapshots existem; ledger imutável, lotes, preço médio, eventos corporativos e reconciliação pendentes.
- **Valuation e dividendos:** P/VP, stress e scores existem; fair value por categoria e cobertura/caixa avançados pendentes.
- **Scores:** `ScoreEngine` existe; screener público, filtros salvos, presets e ranking reproduzível pendentes.
- **SEO:** plano e critérios prontos; implementação não iniciada.
- **Regra de meses encerrados:** decisão fechada e PR #65 aberta; ainda não está em `main`.

### Pendentes prioritárias

#### Radar — acompanhar fundo fora da carteira

O usuário poderá acompanhar um FII/FIAGRO/FI-Infra que ainda não possui para receber mudanças relevantes e construir uma decisão pré-compra.

- limite-base: 1 no Grátis e 10 no Premium;
- timeline de eventos e dividendos;
- relatório pré-compra;
- tese, riscos, pares, gatilhos e “o que mudou”;
- alertas opt-in por materialidade;
- conversão Radar → carteira preservando histórico;
- não confundir “acompanhar” com recomendação de compra.

#### Funcionalidades dos concorrentes com maior ganho esperado

1. **Inteligência documental acionável:** prioridade máxima; mostrar “o que mudou” e impacto para carteira/Radar.
2. **Motor de risco e atribuição:** exposição por fatores, contribuição marginal, stress e decomposição do retorno.
3. **Ledger histórico verdadeiro:** compras, vendas, eventos, caixa, proventos e reconciliação.
4. **Alertas multigatilho e digests:** preço, rendimento, evento, risco, concentração e impacto, sem ruído.
5. **Screener quantitativo:** filtros salvos, presets, scores, pares e ranking reproduzível.
6. **Fair value e sustentabilidade da renda:** faixa específica por tipo de fundo e premissas explícitas.
7. **Retorno total versus renda e benchmarks:** separar preço, proventos, total e real.
8. **Calendário completo e pipeline de eventos:** anúncio, data-com, pagamento, emissão, assembleia e relatório.
9. **Comparador customizável/exportável:** somente após screener e cobertura suficientes.
10. **Centro fiscal, gráficos avançados e simuladores:** fases posteriores, dependentes do ledger e séries confiáveis.

### Funcionalidades que não devem ser prometidas antes da cobertura mínima

- risco por inquilino/devedor;
- concentração geográfica real;
- exposição por indexador;
- vacância física/financeira;
- WAULT e vencimentos;
- cap rate/NOI;
- duration/spread/LTV/garantias/rating;
- inadimplência e PDD robustos;
- fair value por fluxo de caixa;
- atribuição histórica completa;
- relatórios fiscais historicamente corretos.

---

## 9. Decisões de segurança

- Admin exige sessão protegida, e-mail verificado e autorização; `ADMIN` não é plano comercial.
- Endpoints operacionais exigem mesma origem, rate limit, autenticação/autorização e auditoria.
- Segredos não aparecem em logs, query strings, respostas ou artifacts.
- Risk Lab permanece isolado de Premium/notificações até gate formal.
- Evidência metodológica não usa auto-merge.
- GitHub workflows usam permissões mínimas e sem escrita nesta arquitetura.
- O proprietário não aprova manualmente documento técnico fundo a fundo.
- Evidência insuficiente falha fechada e vira inconclusiva.
- Classe secundária só é excluída por regra geral de identidade/família.
- Competência fora da janela só é excluída após normalização temporal auditável.
- Dados pessoais da carteira são privados; páginas públicas não expõem posições, e-mail ou preferências.
- Radar e alertas são recursos do usuário autenticado; autorização é validada no servidor.
- Entitlements e limites não dependem apenas do cliente.
- Opt-in e opt-out são obrigatórios para canais interruptivos.
- Toda integração externa precisa de avaliação de licenciamento, SLA, custo, privacidade e retenção.
- Relatórios permanecem informativos; não executam ordens nem prometem retorno.
- Conteúdo gerado por IA deve deixar fontes, limitações e distinção entre fato/inferência auditáveis.
- Política de correção deve registrar quando uma recomendação mudou e qual dado provocou a mudança.

---

## 10. Variáveis de ambiente

### Conhecidas/relevantes

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `ADMIN_EMAILS`
- `ENABLE_AUTOMATIC_MONITOR`
- `CRON_SECRET`
- `VERCEL_ENV`
- `VERCEL_GIT_COMMIT_SHA`
- `VERCEL_PROJECT_PRODUCTION_URL`
- variáveis de OpenAI/IA conforme o ambiente

### Variáveis futuras prováveis, ainda não canônicas

Não criar antes da sprint correspondente e de uma decisão explícita:

- provider e credenciais de WhatsApp;
- IDs de produto/preço do provedor de cobrança;
- limites/quotas por plano;
- scheduler/worker da coleta FNET;
- Search Console/analytics quando a integração exigir credencial;
- provedores de cotação, volume, liquidez ou notícias licenciadas.

### Regras

- variável pública somente quando realmente pública;
- segredo nunca versionado;
- Preview e Produção auditados separadamente;
- job não falha por variável alheia ao seu escopo sem diagnóstico explícito;
- evidência congelada offline não depende de credencial de Produção;
- rotação de segredo e rollback devem ser documentados;
- nomes são estáveis e validados na inicialização;
- nenhuma credencial de canal é ativada sem opt-in e política de custo.

---

## 11. Testes obrigatórios

### Gates gerais

- `npm run typecheck`
- `npm run test:sprint2`
- `npm run test:risk-lab`
- `npm run test:workflow-governance`
- build de verificação quando aplicável

### Fases concluídas

Toda mudança que toque Fase 1 ou 2 executa regressão global e comprova que:

- não criou CNPJ duplicado;
- não reduziu cobertura sem alerta;
- não reintroduziu P/VP, VP/cota, liquidez ou casas decimais inválidas;
- não alterou fonte/competência silenciosamente;
- não quebrou publicação, rollback, Health, Validation, Admin ou Timeline;
- aplica-se ao universo, não apenas aos tickers citados no bug.

### Governança de GitHub Actions

O teste de governança exige:

- inventário de workflows;
- ausência dos workflows legados;
- zero commit/push/PR/merge/`gh workflow run` operacional;
- zero sleep/polling/retry ilimitado;
- timeout e concurrency em todos os jobs;
- `npm ci` e cache;
- zero cron de negócio e permissões de escrita;
- workflows pesados somente manuais;
- artifacts com retenção curta;
- kickoff com uma chamada;
- orquestração `advance` no backend.

### Sprint 3.5

- parser FNET e anomalias temporais;
- coletor geral sem exceção por ticker;
- checkpoint/retomada sem duplicação;
- hash e dataset imutável;
- seleção de versão e no-look-ahead;
- locks, attempts e audit;
- controles saudáveis sem falso positivo;
- casos graves/reversíveis com eventos e janelas explícitos;
- fechamento somente com evidência primária completa;
- equivalentes de `risk-lab-deva11-phase-a.test.ts` e `risk-lab-deva11-evidence.test.mjs` para cada fundo;
- duas execuções idênticas;
- arquivos legíveis/recomponíveis;
- ausência de workflow exclusivo por fundo;
- auditoria pós-merge em `main`.

### Prompt Premium v3

Testar, no mínimo:

- fundo de tijolo, papel, desenvolvimento, FoF, FIAGRO e FI-Infra;
- dados completos, incompletos, conflitantes e liquidez implausível;
- carteira concentrada, diversificada e sem posição no fundo;
- fundo mais descontado já concentrado não vira compra prioritária;
- queda de preço sem mudança de fundamento preserva valor justo;
- queda de dividendo por deterioração pode revisar faixa e leitura;
- meta atingida retorna “não aumentar”;
- aporte que não compra cota gera saldo/segunda alternativa;
- desenvolvimento com P/VP baixo recebe desconto adicional de execução;
- fundo de tijolo pode melhorar a carteira mesmo com desconto menor;
- mesma fórmula/competência e duas casas decimais em todas as superfícies;
- ausência de jargão não explicado, repetição e afirmação sem evidência;
- custo de tokens e cache/TTL.

### Radar/Acompanhar fundo

- 1 fundo no Grátis e 10 no Premium, no servidor;
- duplicidade, concorrência, troca de plano e downgrade;
- fundo já na carteira não consome vaga;
- autorização por usuário;
- adicionar/remover idempotente;
- conversão Radar → carteira;
- opt-in, cooldown, deduplicação e digest;
- evento sem evidência não dispara alerta categórico.

### Ledger e meses históricos

- mês corrente excluído de maior/menor, total, média e consolidações;
- mesma regra para navegador e Firestore;
- snapshot do primeiro dia preservado;
- fronteira dezembro/janeiro e julho/agosto;
- criação do ano somente quando necessária;
- compra, venda parcial, subscrição, grupamento, desdobramento, custo, rendimento e retroatividade;
- reprocessamento idempotente e reconciliação.

### SEO

- sitemap contém somente fundos/páginas elegíveis;
- robots/canonical/redirects;
- Admin e carteira privada com noindex/bloqueio adequado;
- SSR e conteúdo principal rastreável;
- schema markup corresponde ao conteúdo visível;
- páginas sem conteúdo único não são publicadas;
- links internos HTML;
- Core Web Vitals e mobile;
- monitoramento de indexação, CTR, posição e conversão.

### Critérios universais de conclusão

Uma fase só é concluída quando:

1. código está em `main`;
2. CI obrigatória está verde no SHA da PR;
3. deployment exato está saudável quando aplicável;
4. smoke/validação equivalente está documentado;
5. universo aplicável foi coberto;
6. correções são globais e testadas;
7. ausências, conflitos e exceções estão explícitos;
8. double check/auditoria estão persistidos;
9. segurança, custo, rollback e observabilidade foram validados;
10. evidência final está no Git;
11. Handoff canônico foi atualizado;
12. issue da fase só é encerrada após auditoria da `main`.

---

## 12. Pendências e decisões ainda abertas

### Próximos bloqueadores técnicos

1. Criar branch/PR exclusiva para 3.5-B1 — VSLH11.
2. Reutilizar o finalizador geral e o formato anual comprovado no DEVA11.
3. Impedir regra nova dependente do ticker.
4. Concluir B2–B5 um fundo por vez.
5. Formar o dataset congelado somente depois dos seis casos.
6. Executar backtest offline antes de integrar produto.
7. Migrar coleta FNET para fila persistida e worker/backend.
8. Confirmar limites/custo do plano Vercel antes de scheduler definitivo.
9. Medir uso real de Actions por 30 dias e recalibrar orçamento.
10. Reexecutar smoke direto no domínio de Produção em ambiente com DNS disponível e salvar a resposta/commit no Git.

### PRs e limpeza

11. Fechar PRs #5, #77 e #80 como superseded, preservando histórico.
12. Atualizar PR #65 sobre `main`, revisar texto final, executar CI e só então decidir merge.
13. Garantir que nenhum Handoff versionado paralelo seja criado no repositório.
14. Remover manualmente da Biblioteca do projeto o arquivo `DADOS_FII_HANDOFF_v6.3.0.md` e outras cópias antigas; a ferramenta de Biblioteca disponível nesta auditoria não possui operação de exclusão.

### Monetização e planos

15. Definir preços de Grátis, Premium e Super Premium.
16. Definir mensal/anual, trial, cupom, cobrança, inadimplência, cancelamento, reembolso e impostos.
17. Confirmar se Super Premium existirá e sua matriz de entitlements.
18. Definir tratamento de downgrade quando o usuário exceder o novo limite do Radar.
19. Definir quota, cache, TTL e orçamento de IA por plano.
20. Medir custo marginal por relatório, fundo acompanhado, alerta e usuário ativo.
21. Validar juridicamente a fronteira entre informação personalizada, educação financeira e recomendação regulada.

### Canais

22. WhatsApp: escolher provedor, custo, opt-in, templates, opt-out, janela de envio e fallback.
23. Telegram: permanece adiado.
24. E-mail: concluir digest único e medir abertura, clique, bounce, unsubscribe e falso alerta.
25. Push/web notification: decidir prioridade após métricas de e-mail/Radar.

### Produto e UX

26. Definir a lista final de decisões do Modo Gestor e linguagem jurídica adequada.
27. Definir se o relatório Premium será mensal, sob demanda, por evento crítico ou combinação com quotas.
28. Definir cache e regra de regeneração: mudança de fundamento/evento, não oscilação diária isolada.
29. Definir a experiência de dados insuficientes e perguntas ainda sem resposta.
30. Definir política de correção e histórico de mudança de recomendação.
31. Definir 20 fundos prioritários da SEO-S2.
32. Definir se o Radar terá relatório automático inicial ou geração sob demanda.

### Dados e fornecedores

33. Resolver/documentar lacunas externas remanescentes.
34. Avaliar licenciamento e SLA de cotação, volume, liquidez e notícias.
35. Definir fonte e frequência para campos avançados por categoria.
36. Definir metas de cobertura: identidade 98%, dividendos 95%, preço/P/VP/PL/liquidez 90%, documentos 98%, parser 98%, erro bloqueante <2%, duplicidade de alertas <0,5% e entrega >99% excluindo provedor.
37. Manter documento não legível como inconclusivo.

### SEO e aquisição

38. Configurar/validar Search Console e registrar baseline.
39. Verificar domínio canônico, redirects, sitemap, robots, SSR e indexabilidade.
40. Não comprar backlinks nem publicar páginas rasas geradas em massa.
41. Definir autoria/revisão, metodologia, fontes, data real de atualização, política de correções e explicação do uso de IA.
42. Medir conversão orgânica em cadastro, Radar e carteira.

### Fontes visuais do Prompt Premium

43. A análise e o catálogo das nove referências estão preservados em `docs/sources/premium-prompt/REFERENCIAS_PROMPT_PREMIUM_FII.md`.
44. Os binários `01` a `09` não estavam acessíveis como arquivos recuperáveis nesta auditoria; não foram recriados nem declarados como salvos.
45. Quando os originais forem disponibilizados, adicioná-los em `docs/sources/premium-prompt/images/`, conferir hash e atualizar o README.
46. Não copiar marcas, logos ou texto integral das referências; usar somente a estrutura conceitual adaptada a FIIs.

---

## Estado canônico final em 24/07/2026

- **Fase 1:** concluída.
- **Fase 2:** concluída.
- **Fase 3:** em andamento.
- **Sprint 3.4:** concluída.
- **3.5-R:** concluída.
- **3.5-A — DEVA11:** concluída.
- **Sprint 3.5 completa:** aberta.
- **Próxima fase:** 3.5-B1 — VSLH11, não iniciada.
- **Risk Lab no Premium/alertas:** bloqueado até gates 3.5/3.6.
- **Prompt Premium v3:** especificado, não implementado.
- **Radar/Acompanhar fundo:** planejado para Fase 4, regra-base 1 Grátis/10 Premium.
- **SEO:** plano oficial paralelo, SEO-S1 ainda não iniciada.
- **GitHub Actions:** otimização concluída; worker FNET pendente.
- **Handoff no Git:** somente `DADOS_FII_HANDOFF.md` deve existir como canônico.
