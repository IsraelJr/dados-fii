Este documento substitui todos os planejamentos anteriores quando houver divergência.

# Dados FII — Documento Canônico de Handoff

**Versão:** 5.0.0  
**Data:** 19/07/2026  
**Repositório:** `IsraelJr/dados-fii`

## Decisões que substituem as anteriores

- **Fase 3 = Risk Lab.** O Radar Inteligente passa para a Fase 4.
- **Fluxo principal = ticker-only.** O proprietário não procura IDs, não escolhe documentos e não aprova dados técnicos.
- Dúvida, falta ou conflito retornam `inconclusive`/`blocked`.
- Importação, fila de IDs, revisão e execução manual permanecem somente como debug. PRs #38, #40 e #41 substituem como fluxo principal #28, #35, #36 e #37.
- HCTR11/TGAR11 são casos de desenvolvimento. Coorte externa: DEVA11, VSLH11, KNCR11, KNSC11, MCCI11 e RBRY11.
- Ruleset `v0.1.0` congelado. Mudanças exigem nova versão, hash e repetição integral.
- “Nenhum evento explícito encontrado” não certifica ausência de risco.
- Merge não prova Produção: exige deployment e smoke test do commit exato.
- Texto vigente: **“Dividendos consolidados pelo histórico mensal da carteira.”** PR #39 substitui #34; #32 foi revertido por #33.

## 1. Estado atual do projeto

**Fases 1 e 2 concluídas e validadas em Produção:** engine CVM/B3, parser, reconciliação, catálogo normalizado, backup/aprovação/hash/rollback, RegulatoryDataService, ScoreEngine, Health/Validation, Dashboard, Timeline, relatórios Gratuito/Premium, AI Insights, observabilidade e monitor.

Auditoria de 16/07/2026: 511/511 B3 conciliados com CVM; 504/504 ativos com cadastro básico; 491/502 com indicadores essenciais; zero CNPJ duplicado; 11 exceções externas nulas; nenhum valor inventado.

**Risk Lab concluído em código até PR #41:** piloto HCTR11, métricas separadas, ruleset congelado, coorte, detector, descoberta por ticker, série mensal automática, tratamento de conflitos/lacunas, triagem automática de crédito, Admin sem validação documental e isolamento de Premium/notificações.

**Deploy:** `main` em `ae0a6c8969bd68526e414617bcf1ced49096b9a1`; CI aprovado; Vercel bloqueada por `build-rate-limit`; Produção não comprovada nesse commit; sem decisão de contratar Pro.

Trilhas paralelas: Risk Lab, Data Coverage Hardening e SEO 90 dias.

## 2. Fase concluída

- **Fase 1 — concluída:** Regulatory Engine, QA, publicação protegida, backup, hash, rollback e CI.
- **Fase 2 — concluída:** serviços, scores, relatórios, IA, observabilidade, monitor e qualidade global.
- **Fase 3 — em andamento:** 3.0 PRs #22-23; 3.1 #24-26; 3.2 #27-37; 3.3 #38/#40/#41 concluídas em código.

## 3. Sprint atual

**Sprint 3.4 — Ativação em Produção e homologação ponta a ponta.**

Fluxo: `ticker → identidade/CNPJ → fontes oficiais → validação → série mensal → detector → triagem de crédito → validated/inconclusive/blocked`.

Status: bloqueada pelo limite de builds da Vercel.

## 4. Ordem oficial das próximas sprints

1. **3.4:** deploy e homologação.
2. **3.5:** backtest fora da amostra.
3. **3.6:** métricas, calibração e gate.
4. **3.7:** integração read-only ao Premium.
5. **3.8:** piloto opt-in de impacto e alertas.
6. **4.1:** Radar — fundação, planos e segurança.
7. **4.2:** Radar — eventos e mudanças de tese.
8. **4.3:** Radar — experiência e monetização.

SEO, cobertura de dados e incidentes operacionais seguem em paralelo.

## 5. Escopo e critérios de aceite

- **3.4:** implantar o commit atual, registrar URL/commit/horário, conferir flags, testar HCTR11/MCCI11/RBRY11, validar bloqueios e confirmar ausência de efeitos em Premium/notificações. Aceite: Vercel `Ready`, Admin ticker-only, typecheck, `test:sprint2`, `test:risk-lab`, build e smoke verdes.
- **3.5:** executar os seis fundos sem mudar `v0.1.0`; registrar `knownAt`, fontes e versões; medir primeiro amarelo/laranja/vermelho, antecedência, falsos positivos/negativos, inconclusão e cobertura. Aceite: sem informação futura, achados materiais oficiais, controles sem vermelho injustificado.
- **3.6:** decidir aprovar/reprovar/revisar; nova regra gera nova versão/hash e repetição. Gate mínimo: zero vermelho falso positivo nos controles; nenhuma conclusão final só com fonte secundária; ambiguidades inconclusivas.
- **3.7:** Premium somente leitura, com flag, fontes, linguagem simples, métricas separadas, falha isolada e rollback.
- **3.8:** impacto por peso/renda, opt-in, painel antes de canais interruptivos, deduplicação/cooldown. Sem alertas periódicos sem mudança ou vermelho por ausência.
- **4.1:** acompanhamento fora da carteira, plano resolvido no servidor e cotas vigentes de 1 fundo/ciclo no Grátis e 10 no Premium, salvo nova decisão.
- **4.2:** eventos, dividendos, tese e relatório pré-compra com fontes.
- **4.3:** preferências, canais, consentimento e monetização sem spam.

## 6. Regras arquiteturais obrigatórias

1. APIs usam serviços/repositórios; Firestore direto somente quando formalmente justificado.
2. Dados derivados são calculados; campos protegidos não são sobrescritos.
3. Scores passam pelo ScoreEngine; IA textual pelo AIInsightsEngine; IA não decide alerta determinístico.
4. Publicação sensível exige fonte/data, hash, identidade, idempotência, auditoria, backup e rollback.
5. Risk Lab principal é ticker-only; proprietário não valida documentos.
6. Fontes oficiais prevalecem; secundárias só localizam/contextualizam; sem bypass de captcha, URL livre ou host não autorizado.
7. `knownAt` governa o backtest; look-ahead proibido.
8. Falta/conflito/ambiguidade bloqueiam; ausência de evento não certifica segurança.
9. Regras versionadas e congeladas; ferramentas manuais são debug.
10. Sem integração ao Premium antes do gate e sem alertas antes da 3.8.
11. Não inventar preço, VP, P/VP, dividendos, liquidez, vacância, crédito ou evento; separar fato, cálculo, estimativa, inferência e indisponibilidade.
12. SEO exige fonte, data, método e limitações; não autoriza páginas rasas em massa.

## 7. Arquivos, branches, commits e PRs

- Branch canônica: `main`; branch desta atualização: `docs/canonical-handoff-v5`.
- Commits-chave: `11e85a5` (#23), `556285c2` (#24), `6b966056` (#27), `8a6cc942` (#40), `ae0a6c89` (#41).
- PRs: #21 catálogo; #22 piloto; #23 freeze; #24 coorte; #25 ledger; #26 datas conservadoras; #27 motor; #28/#35/#36/#37 ferramentas manuais legadas; #29 cobertura; #38 ticker automático; #40 série/detector; #41 crédito automático.
- Arquivos centrais: `src/app/admin/risk-lab/automatic/page.tsx`, rota API homônima, `CvmEventualCsvParser`, `CvmEventualDocumentDiscovery`, `RiskLabTickerOrchestrator`, `AutomaticDividendSeriesService`, `DividendStressWindowEngine`, `AutomaticCreditEventScreeningService`, `RiskLabAutomaticOrchestrator`, tipos e `tests/risk-lab-*`.

## 8. Funcionalidades concluídas, parciais e pendentes

- **Concluídas:** Fases 1/2; piloto; freeze; coorte; detector; ticker-only; série e triagem automáticas; bloqueios e testes.
- **Parciais:** Fase 3; deploy; relatório final da coorte; validação DEVA/VSLH; resultado externo MCCI/RBRY; PDFs não extraíveis; persistência/auditoria do scan automático; Premium deliberadamente ausente.
- **Pendentes:** 3.4-3.8, backtest, gate, possível v0.2.0, Premium read-only, alertas, Radar, ledger histórico, screener, comparador, centro fiscal e dados profundos de ativos/crédito.

## 9. Decisões de segurança

Firebase Auth, e-mail autorizado, Admin, mesma origem, rate limit e logs sem segredos. Rota automática: GET 30/minuto, POST 3 scans/15 minutos, máximo 60 segundos. Sem URL livre, bypass de captcha ou promoção de fonte secundária. Nenhum alerta por ausência de dados ou mudança pública de recomendação. Segredos somente no ambiente.

## 10. Variáveis de ambiente

Plataforma: `ENABLE_SYSTEM_VALIDATION`, `ENABLE_HEALTH_MONITOR`, `ENABLE_AI_INSIGHTS`, `ENABLE_REPORT_PREMIUM`, `ENABLE_SCORE_ENGINE`, `ENABLE_AUTOMATIC_MONITOR`, `ENABLE_PORTFOLIO_REGULATORY_INTELLIGENCE`, variáveis Premium/monitor/SMTP/Telegram e `CRON_SECRET`.

Risk Lab:

```text
ENABLE_RISK_LAB_ADMIN
ENABLE_RISK_LAB_AUTOMATIC_DISCOVERY
ENABLE_RISK_LAB_FNET_IMPORT
ENABLE_RISK_LAB_STRESS_RUN
```

`ENABLE_RISK_LAB_AUTOMATIC_DISCOVERY` controla o fluxo principal e deve ser explícita em Produção. FNET import/stress run são debug legado. Valores secretos não entram neste documento.

## 11. Testes obrigatórios

```bash
npm run typecheck
npm run test:sprint2
npm run test:risk-lab
npm run build
```

Workflows: Portfolio Notifications CI, Risk Lab CI e deployment. Cobertura obrigatória: hash/freeze, look-ahead, ticker/CNPJ, fontes, insuficiência, lacuna, duplicidade, reapresentação, conflito, 20%/90%, data do anúncio, evento de crédito, ambiguidade, inconclusão, isolamento Premium/notificações, autenticação e rate limit.

Smoke 3.4: confirmar commit, autenticar Admin, abrir `/admin/risk-lab/automatic`, testar ticker válido/inválido, insuficiência/ambiguidade, confirmar ausência de validação humana e efeitos externos, registrar resultado.

## 12. Pendências e decisões ainda abertas

1. Repetir/criar deployment quando o limite Vercel permitir.
2. Executar coorte e publicar desempenho.
3. Definir limiares do gate e categorias suportadas.
4. Avaliar extração determinística de PDF; até lá, não legível = inconclusivo.
5. Confirmar/padronizar persistência e auditoria dos scans automáticos.
6. Decidir sobre `v0.2.0`.
7. Ocultar, mover para `/debug` ou remover rotas manuais.
8. Validar mensagens com usuário não técnico; fontes são auditoria opcional.
9. Definir gate Premium, segmentação de planos, alertas e cobrança.
10. Não contratar plano pago sem análise específica.
11. Manter SEO/Data Coverage em paralelo e atualizar este arquivo a cada mudança de fase, ruleset, coorte ou gate.

## Critério para concluir a Fase 3

Fluxo implantado e homologado; coorte completa; desempenho publicado; ambiguidades bloqueadas; ruleset versionado; gate formal; Premium read-only testado ou formalmente adiado; nenhuma notificação não autorizada; proprietário operando apenas por ticker.

Até lá, o Risk Lab é laboratório avançado, não recomendação pública nem sistema autônomo de alertas.
