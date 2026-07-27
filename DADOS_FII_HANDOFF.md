Este documento substitui todos os planejamentos anteriores quando houver divergência.

# Dados FII — Documento Canônico de Handoff

**Versão:** 10.0.0  
**Data:** 27/07/2026  
**Repositório:** `IsraelJr/dados-fii`  
**Branch principal:** `main`  
**Branch de trabalho:** `agent/product-validation-phase-1`  
**Issue atual:** `#154`  
**PR atual:** `#155` — draft  
**Sprint atual:** `PV-1 — Jornada principal da carteira e histórico manual`

## Decisões vigentes que substituem decisões anteriores

| Decisão vigente | Decisão substituída | Efeito |
|---|---|---|
| O projeto entrou na fase **Produto Validável**. | A sequência anterior colocava SEO-S1 e expansão de páginas como frente principal. | Produto, retenção, confiabilidade e validação comercial passam à frente de tráfego e monetização por anúncios. |
| `PV-1` é a única sprint funcional prioritária. | SEO-S1 era a sprint atual. | SEO permanece em manutenção técnica, sem expansão até a jornada da carteira ser comprovada. |
| Google AdSense está congelado como prioridade de produto. | AdSense era tratado como marco de monetização. | Nenhum desenvolvimento pode exigir anúncio assistido ou otimizar a experiência para inventário publicitário. |
| O histórico manual do ano corrente será gratuito e sem propaganda. | Limite de dois meses ou desbloqueio por anúncio estavam em avaliação. | A função será usada para ativação e retenção, não como pedágio artificial. |
| Premium será visível para descoberta e beta antes do checkout. | Premium ficava invisível exceto para e-mail administrativo. | Demanda poderá ser medida sem prometer cobrança inexistente. |
| Acesso administrativo atual não prova validação do Premium. | Uso do proprietário podia ser confundido com validação de usuário. | Validação exige usuários externos, telemetria e disposição real a pagar. |
| A carteira deve ser um copiloto de decisões, não um narrador de oscilações. | Alertas poderiam enfatizar altas e baixas diárias. | O produto separará mudança material de ruído e explicará impacto na renda, risco e tese. |
| O Handoff v10.0.0 é a única fonte canônica ativa. | Handoff v9.0.0 e roadmaps anteriores. | Evidências históricas continuam válidas, mas a ordem futura foi substituída. |

## 1. Estado atual do projeto

### Estado executivo

- Fases 1, 2 e 3 permanecem formalmente concluídas quanto às entregas e evidências já aprovadas.
- Release corretivo histórico aprovado: `0e029f78560d11d12720c447f2f9058c482e4277`.
- PRs corretivas: `#141`, `#142` e `#143`.
- Gate read-only: run `30236078462`.
- Production Premium Smoke: run `30236078473`, artifact `8641670026`.
- Audit event: `pKWEwtSiIbdatbauietl`.
- Hash da evidência Premium: `8a9709056d046a8f2f73d4e20e7cdcb77c861706b592c24a6333fdf566ee983b`.
- A nova fase foi aberta na branch `agent/product-validation-phase-1`, issue `#154` e PR draft `#155`.
- O documento de direção da fase está em `docs/product/product-validation-phase-1.md`.

### Auditoria inicial da PV-1

O estado atual da carteira não atende ainda ao contrato de Produto Validável:

- `src/app/carteira/page.tsx` concentra regras financeiras, persistência, carregamento, snapshots e interface no mesmo componente;
- carteira e snapshots utilizam `localStorage` (`dados-fii-wallet-v1` e `dados-fii-wallet-monthly-snapshots-v1`);
- snapshot do mês corrente é regravado conforme preços e dados carregados, sem modelo explícito de proveniência;
- `parseCurrency` converte valores inválidos para zero, o que conflita com a regra fail-closed;
- o histórico de dividendos é reconstruído a partir da carteira atual, não representa necessariamente a posição histórica do usuário;
- não existe ainda domínio separado para entrada manual, conflito com snapshot, autoria, versão ou isolamento entre usuários;
- a PR antiga `#65` não é base canônica para PV-1 e deverá ser encerrada ou substituída após reconciliação.

### Matriz atual

| Área | Estado |
|---|---|
| Segurança, CI e Risk Lab históricos | Formalmente concluídos |
| Carteira atual | Funcional, porém client-side e não validada para PV-1 |
| Histórico patrimonial | Parcial; snapshots locais sem contrato de proveniência completo |
| Histórico manual | Não implementado |
| Telemetria da jornada | Não implementada |
| Premium automático | Implementado para acesso controlado; não validado comercialmente |
| Checkout/cobrança | Não implementado e fora da PV-1 |
| AdSense | Congelado |

## 2. Fases concluídas

### Fase 1 — Regulatory Engine

**Estado:** formalmente concluída.

Parser regulatório, normalização, reconciliação, QA, publicação, backup, rollback e auditoria.

### Fase 2 — Core Intelligence & Product Foundation

**Estado:** formalmente concluída quanto à base histórica.

Inclui `RegulatoryDataService`, repositórios, cache, scores, Health, Validation, Admin, relatórios, AI Insights, monitor, catálogo, carteira e jobs.

### Fase 3 — Risk Lab

**Estado:** formalmente concluída.

- dataset e backtest preservados;
- ruleset `0.2.0` homologado;
- Premium read-only;
- notificações e efeitos externos bloqueados;
- smoke OIDC e auditoria persistida aprovados.

## 3. Sprint atual

### PV-1 — Jornada principal da carteira e histórico manual

**Objetivo:** entregar um fluxo real, confiável e comprovado em produção:

`cadastro/login → carteira → persistência → histórico → diagnóstico → retorno posterior sem perda de dados`.

### Escopo obrigatório

- auditar e corrigir criação, importação e persistência da carteira;
- criar domínio de histórico separado da interface;
- permitir entrada manual gratuita do ano corrente;
- solicitar ano e mês na criação da competência;
- cadastrar patrimônio e dividendos;
- editar e excluir apenas registros manuais autorizados;
- impedir duplicidade por usuário e competência;
- preservar snapshots automáticos e legado;
- registrar proveniência: `manual`, `automatic_snapshot` ou `legacy`;
- não sobrescrever conflito silenciosamente;
- atualizar gráficos e resumos;
- instrumentar telemetria sem valores financeiros ou dados pessoais.

### Critério de conclusão

PV-1 somente será concluída quando o mesmo SHA possuir:

1. testes unitários, integração, regras e E2E verdes;
2. isolamento entre usuários comprovado;
3. carteiras vazia, existente e legado cobertas;
4. dezembro/janeiro e mês corrente/encerrado cobertos;
5. Preview aprovado;
6. deploy em produção;
7. smoke não destrutivo em produção;
8. telemetria mínima comprovada;
9. Handoff atualizado com IDs reais.

Documento, código isolado, teste pontual ou validação manual não concluem a sprint.

## 4. Ordem oficial das próximas sprints

1. **PV-1 — Jornada principal da carteira e histórico manual.**
2. **PV-2 — Descoberta do Premium e beta controlado, sem checkout falso.**
3. **PV-3 — Telemetria, retenção e validação de disposição a pagar.**
4. **PV-4 — Relatório incremental: “o que mudou desde a última análise”.**
5. **PV-5 — Radar/Acompanhar fundo fora da carteira.**
6. **PV-6 — Cobrança, somente após evidência comercial suficiente.**
7. **PV-7 — Carteira histórica verdadeira, retorno total e atribuição.**
8. **PV-8 — Screener, comparador, filtros salvos e fair value por categoria.**

SEO editorial, AdSense, WhatsApp, Telegram e novas ferramentas não podem antecipar PV-1 a PV-3.

## 5. Escopo e critérios de aceite de cada sprint

### PV-1

Escopo e aceite definidos na seção 3 e na issue `#154`.

### PV-2

Escopo:

- tornar a proposta Premium visível;
- exibir benefícios, diferenças e amostra;
- registrar interesse e consentimento;
- permitir liberação manual de beta;
- manter checkout indisponível até existir fluxo real.

Aceite:

- nenhum botão promete pagamento inexistente;
- `premium_viewed` e `premium_interest_submitted` medidos;
- acesso Premium sempre resolvido no servidor;
- custo de IA limitado e auditável.

### PV-3

Escopo:

- eventos da jornada;
- funil de ativação;
- retenção D7 e D30;
- coorte beta externa;
- entrevistas orientadas a comportamento e preço.

Aceite:

- eventos não carregam carteira, valores, e-mail ou ticker sensível sem necessidade;
- métricas reproduzíveis;
- decisão documentada sobre preço e cobrança;
- validação não baseada apenas no proprietário.

### PV-4

Escopo: relatório-base + delta desde a última análise.

Aceite: não repetir relatório completo sem necessidade; separar mudança material, ruído, fato, inferência e ação necessária.

### PV-5

Escopo: acompanhar fundo fora da carteira, timeline, relatório pré-compra e mudança material.

Aceite: Grátis acompanha até 1 fundo; Premium até 10; ausência de mudança não notifica; deduplicação e opt-out.

### PV-6

Escopo: checkout, recorrência, cancelamento, webhooks, conciliação e entitlement.

Aceite: cobrança idempotente, ambiente de teste, recuperação de falhas, plano server-side, auditoria e suporte a cancelamento.

## 6. Regras arquiteturais obrigatórias

1. Fluxo: Route Handler → autenticação/schema → controller/application service → domínio → repository → Firestore/provedor.
2. Nenhum `route.ts` importa Firestore diretamente.
3. Componente React não contém regra financeira, regra de conflito ou persistência de domínio.
4. Repository não importa React, `NextResponse` ou apresentação.
5. Carteira e histórico possuem tipos fortes e schemas versionados.
6. Competência usa formato canônico `YYYY-MM`.
7. Ausência não vira zero; `NaN`, infinito, data futura e valor inválido falham fechado.
8. Uma competência possui identidade por usuário, carteira e mês.
9. Snapshot automático não é editável como registro manual.
10. Conflito manual/snapshot é explícito e auditado.
11. Proveniência e timestamps são obrigatórios.
12. Logs e telemetria não contêm valores financeiros, posições, e-mail, token ou cookie.
13. Plano, admin e identidade vêm do servidor.
14. Risk Lab permanece read-only no Premium.
15. Correções são gerais, sem hardcode por ticker ou usuário.
16. CI é gate de merge e deploy.

## 7. Arquivos, branches, commits e PRs existentes

### Estado histórico

- Release corretivo: `0e029f78560d11d12720c447f2f9058c482e4277`.
- PRs históricas principais: `#141`, `#142`, `#143`, `#146`, `#147`, `#148`, `#149`, `#150`, `#151`, `#152`, `#153`.
- PR antiga aberta: `#65`; não integra automaticamente a PV-1.

### Nova fase

- Branch: `agent/product-validation-phase-1`.
- Primeiro commit: `21f84c7fb311070b118ecaaa5f837b9c0aa91775`.
- Issue: `#154 — PV-1: validar jornada principal da carteira e histórico manual`.
- PR draft: `#155 — docs: inicia fase de validação do produto`.
- Documento: `docs/product/product-validation-phase-1.md`.
- Handoff: v10.0.0.

### Arquivos centrais já identificados

- `src/app/carteira/page.tsx`;
- `DADOS_FII_HANDOFF.md`;
- `tests/canonical-handoff.test.mjs`;
- `tests/e2e/critical-journeys.spec.ts`;
- `firestore.rules`;
- `.github/workflows/phase-2-closure.yml`.

## 8. Funcionalidades concluídas, parciais e pendentes

### Concluídas

- motor regulatório e catálogo;
- base de carteira atual;
- relatórios Free, AI Insights e Premium;
- Risk Lab read-only;
- CI, segurança e produção corretiva;
- snapshots locais básicos.

### Parciais

- carteira: funciona, mas depende de `localStorage` e componente monolítico;
- histórico patrimonial: snapshots existem, sem proveniência e persistência server-side completas;
- histórico de dividendos: reconstrução pela carteira atual, não posição histórica verdadeira;
- Premium: tecnicamente disponível para acesso controlado, sem validação comercial;
- SEO: fundação existente, expansão congelada.

### Pendentes

- histórico manual do ano corrente;
- domínio e repository da carteira/histórico;
- isolamento entre usuários;
- telemetria de ativação e retenção;
- descoberta Premium e lista de interesse;
- beta externo;
- relatório incremental;
- Radar/Acompanhar fundo;
- cobrança;
- retorno total e atribuição;
- screener e comparador.

## 9. Decisões de segurança

- Segredos permanecem server-only.
- `NEXT_PUBLIC_*` nunca concede plano ou privilégio.
- Carteira e histórico são privados e `noindex`.
- Entitlement é resolvido no servidor.
- Firestore cliente permanece fail-closed conforme arquitetura vigente.
- Escritas exigem autenticação, schema, ownership, idempotência quando aplicável e auditoria.
- Usuário só acessa e altera seus próprios registros.
- Snapshot automático não pode ser adulterado pelo cliente como se fosse manual.
- Eventos analíticos não armazenam valores da carteira.
- Erros públicos não expõem detalhes internos.

## 10. Variáveis de ambiente

### Existentes e obrigatórias conforme ambiente

- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `CRON_SECRET`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `ADMIN_EMAILS`
- `ENABLE_WALLET_RISK_REPORT_AUTOMATIC`
- `ENABLE_WALLET_RISK_REPORT_MANUAL_FALLBACK`
- `ENABLE_RISK_LAB_PREMIUM_READONLY`

### Política

- nenhuma variável nova será criada sem owner, ambiente, segredo/pública, fallback, rollback e teste;
- telemetria será escolhida na PV-1/PV-3 e não poderá receber payload financeiro;
- flags temporárias possuem data ou condição de remoção.

## 11. Testes obrigatórios

- `npm ci`;
- audit de produção e secret scan;
- lint e typecheck;
- suíte completa;
- testes unitários do domínio de histórico;
- testes de schema e valores pt-BR;
- duplicidade e conflito de competência;
- ownership e isolamento entre usuários;
- Firestore Emulator ou equivalente;
- cobertura crítica e mutation sanity;
- build;
- smoke HTTP;
- E2E desktop e mobile;
- acessibilidade;
- carteira vazia, existente e legado;
- dezembro/janeiro;
- mês corrente e mês encerrado;
- snapshot automático versus manual;
- Preview;
- produção e smoke do SHA exato.

Nenhuma validação manual do usuário substitui essa obrigação.

## 12. Pendências e decisões ainda abertas

### Comerciais

- preço do Premium;
- cobrança recorrente, anual ou compra avulsa;
- provedor de pagamento;
- cartão, Pix recorrente ou Pix avulso;
- política de beta, créditos e limites de IA;
- gatilho mínimo para iniciar PV-6.

### Produto

- tratamento visual de conflito manual/snapshot;
- edição permitida do mês corrente;
- retenção de dados após exclusão da carteira;
- importação de anos anteriores;
- importação por planilha;
- definição do diagnóstico inicial gratuito;
- conteúdo da prévia Premium.

### Canais

- WhatsApp: custo, opt-in, template, frequência e proteção de dados;
- Telegram permanece adiado;
- e-mail deve permanecer deduplicado e orientado a mudança material.

### Operação

- encerrar ou substituir a PR `#65`;
- decidir ferramenta de telemetria;
- selecionar coorte beta externa;
- definir suporte, termos e fluxo de exclusão de dados antes da venda.

---

## Regra executiva da nova fase

Uma demanda só entra na frente de PV-1 a PV-3 quando comprovar que:

1. melhora ativação ou retenção;
2. aumenta confiança e integridade;
3. mede interesse ou disposição a pagar;
4. reduz custo, erro ou intervenção manual.

Caso contrário, espera.
