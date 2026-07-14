# Fase 2 — Sprints 2.1 a 2.11

Este documento segue o `DADOS_FII_HANDOFF.md` v3.0.0 e registra a implementação completa da Fase 2.

## Sprint 2.1 — RegulatoryDataService

O `RegulatoryDataService` é o orquestrador único dos dados regulatórios consumidos pelas APIs. A implementação foi separada nos componentes previstos no handoff:

- `RegulatoryRepository`: único componente da nova camada autorizado a acessar o Firestore;
- `RegulatoryDataService`: composição, cache, cotações, validação e scores;
- `RegulatoryNormalizer`: ticker, FII/FIAGRO/FI-Infra, rendimentos e merge seguro;
- `RegulatoryValidator`: ticker, tipo, CNPJ, identificação, segmento e fontes;
- `RegulatoryCache`: cache TTL limitado com política LRU;
- `RegulatoryTypes`: coleções, contratos de publicação, rollback e registros.

### Precedência e proteção do merge

1. A base legada `Fiis` preserva compatibilidade com os consumidores atuais.
2. O overlay `RegulatoryFunds/{ticker}` acrescenta dados cadastrais e regulatórios.
3. A planilha de cotações fornece somente preço, abertura, variação, mínima e máxima.

Campos de identidade operacional, timestamps, cotações e `earningsYYYY` pertencem ao pipeline legado e não podem ser sobrescritos automaticamente pelo overlay. Os metadados `regulatoryMeta` informam versão, fontes, validação e hit/miss do cache.

Publicação e rollback exigem ator, aprovação humana, hash, motivo e backup imutável. Cada operação gera uma nova versão, hash de publicação e registro de auditoria. O cache do ticker é invalidado depois da transação.

### Coleções

| Coleção | Finalidade |
|---|---|
| `Fiis` | Base legada lida durante a transição |
| `RegulatoryFunds` | Estado regulatório publicado por ticker |
| `RegulatoryFundVersions/{ticker}/versions` | Versões imutáveis e rollback |
| `RegulatoryFundBackups/{ticker}/backups` | Backup imutável antes de publicação ou rollback |
| `RegulatoryValidationRuns` | Histórico das validações |
| `RegulatoryParserHealth` | Saúde consolidada de cada parser/fonte |
| `RegulatoryAuditLogs` | Auditoria de validação, publicação e rollback |
| `RegulatoryTimelineEvents` | Eventos e documentos normalizados da timeline |
| `RegulatoryMonitorRuns` | Histórico auditável das execuções do monitor |
| `RegulatoryMonitorAlerts` | Estado, deduplicação e cooldown dos alertas |
| `RegulatoryMonitorLocks` | Lock distribuído com expiração para impedir crons sobrepostos |

## Sprint 2.2 — Score Engine

Todo score é calculado pelo `ScoreEngine`; nenhuma API calcula ou persiste notas manualmente. Uma consulta de um fundo novo gera automaticamente:

- Risk;
- Dividend;
- Governance;
- Growth;
- Liquidity;
- Quality;
- Premium.

Cada resultado contém nota de 0 a 100, confiança, faixa, métricas utilizadas e explicações. Nota mais alta representa melhor condição no critério; em `Risk`, portanto, nota alta significa menor risco estimado. Dados insuficientes produzem nota neutra com baixa confiança, sem inventar valores.

O Premium é uma composição determinística: Risk 25%, Dividend 20%, Quality 20%, Governance 15%, Growth 10% e Liquidity 10%. Scores são dados derivados e ficam apenas na resposta/cache; não são gravados manualmente no Firestore.

## Sprint 2.3 — Health System

`GET /api/admin/system/health` retorna um Health Score ponderado e diagnósticos independentes de:

- Firestore;
- Parser;
- QA;
- Publicação;
- Rollback;
- Cache;
- Score Engine.

Cada componente informa status, nota, mensagem, horário, metadados e, quando aplicável, latência. O Firestore é testado pelo `RegulatoryRepository`; publicação e rollback usam a trilha de auditoria; o ScoreEngine executa um autoteste; e o cache expõe hits, misses, expirações e evictions.

## Sprint 2.4 — Validation System

O `ValidationRunner` executa a validação regulatória, calcula cobertura por FII, FIAGRO e FI-Infra e produz checks estruturados para registros, tipos, mercado e ScoreEngine.

| Método e rota | Função |
|---|---|
| `POST /api/admin/system/run-validation` | Executa, audita e persiste uma validação |
| `GET /api/admin/system/validation-history?limit=20` | Retorna o histórico persistido |
| `GET /api/admin/system/parser-health` | Retorna saúde consolidada dos parsers |
| `GET /api/admin/system/health` | Retorna o System Health consolidado |

Execuções interrompidas também geram um registro com status `failed`, erro e check auditável. Descobrir dados inválidos é resultado da validação, não falha silenciosa da API.

Todas as rotas exigem Firebase Authentication, e-mail em `ADMIN_EMAILS`, perfil `admin`, cookie HttpOnly, mesma origem e rate limiting.

## Sprint 2.5 — Dashboard Administrativo

O painel `/admin/sistema` consolida os sete cards canônicos:

- Saúde;
- Parser;
- Firestore;
- QA;
- Publicação;
- Rollback;
- Histórico.

Também mostra métricas de cache, autoteste do ScoreEngine, detalhes dos parsers, execução manual de validação e histórico persistido. O painel não acessa Firestore e consome apenas as APIs administrativas autenticadas.

## Sprint 2.6 — Timeline Regulatória

`GET /api/fii/{ticker}/timeline` retorna documentos, eventos, fatos relevantes, assembleias e regulamentos em ordem cronológica. A resposta aceita filtros por tipo, limite e cursor opaco.

A timeline combina, pelo `RegulatoryDataService`:

1. registros de `RegulatoryTimelineEvents`;
2. arrays compatíveis existentes no overlay `RegulatoryFunds`;
3. publicações e rollbacks da trilha `RegulatoryAuditLogs`.

Os registros são normalizados, deduplicados e sanitizados. Apenas URLs HTTP/HTTPS são expostas. A página `/fii/{ticker}` mostra a timeline, contagens por categoria, fontes e estado vazio quando ainda não há evento estruturado.

Contrato recomendado para novos registros:

```text
ticker, type, title, summary, occurredAt, publishedAt,
url, source, documentNumber, version, metadata
```

## Sprint 2.7 — Relatório Gratuito

`GET /api/fii/{ticker}/report/free` gera um relatório determinístico e cacheável, sem IA e sem acesso direto ao Firestore. O `RegulatoryDataService` reúne o fundo publicado, os sete scores e os cinco eventos regulatórios mais recentes; o `FreeReportEngine` transforma essa base em:

- identidade e indicadores essenciais;
- scores com nota e confiança;
- pontos favoráveis e pontos de atenção explicáveis;
- qualidade, erros, alertas e rastreabilidade;
- eventos regulatórios usados na leitura;
- metodologia e avisos de uso.

O relatório é derivado em tempo de leitura e nunca é gravado manualmente. A página `/fii/{ticker}` apresenta o relatório automaticamente. Conteúdo com baixa confiança é sinalizado e o relatório não produz recomendação de investimento.

## Sprint 2.8 — AI Insights Engine

O `AIInsightsEngine` é o único componente autorizado a chamar o provedor de IA. Ele recebe o Relatório Gratuito sanitizado e retorna um contrato estruturado com:

- resumo executivo;
- mudanças;
- riscos;
- oportunidades para acompanhamento;
- alertas;
- explicação em linguagem simples.

`GET /api/fii/{ticker}/insights` gera os insights sob demanda. A implementação inclui JSON Schema estrito, versionamento do prompt, fingerprint estável, cache LRU com TTL, deduplicação de requisições simultâneas, rate limiting por origem, timeout e erros normalizados. O prompt trata textos regulatórios como dados não confiáveis, proíbe fatos inventados e não permite recomendação de compra, venda ou manutenção.

A rota legada `POST /api/fii-summary` foi mantida como contrato de compatibilidade, mas agora delega ao `RegulatoryDataService` e ao AI Insights Engine. O relatório de risco da carteira também usa `AIInsightsEngine.generateText`; nenhuma API acessa OpenAI ou Perplexity diretamente.

## Sprint 2.9 — Relatório Premium

`GET /api/fii/{ticker}/report/premium` exige Firebase Authentication e um entitlement Premium, VIP, Admin ou Preview. O `RegulatoryDataService` reúne o relatório gratuito, pares do mesmo segmento e os insights gerados exclusivamente pelo AI Insights Engine. O `PremiumReportEngine` calcula:

- valuation por preço, P/VP e valor patrimonial estimado;
- stress tests leve, moderado e severo;
- cenários positivo, base e adverso;
- comparativos com fundos do mesmo tipo/segmento;
- recomendações de acompanhamento, sem ordens de compra ou venda;
- análise IA reutilizada do contrato central.

Os cálculos são determinísticos, derivados em tempo de leitura e acompanhados por metodologia e avisos. A flag `ENABLE_REPORT_PREMIUM` permanece desabilitada por padrão até a ativação comercial.

## Sprint 2.10 — Observabilidade

`GET /api/admin/system/observability` consolida, pelo `RegulatoryDataService`, as métricas canônicas de tempo, retries, falhas, ingestão, parser, QA e publicação. Durações, sucessos, falhas e retries da instância são instrumentados centralmente; validações e auditorias persistidas preservam o estado operacional que precisa sobreviver ao ciclo de vida serverless.

O Dashboard Administrativo apresenta o snapshot de observabilidade junto com Health, Validation e histórico. Todas as rotas administrativas continuam protegidas por Firebase Authentication, e-mail autorizado, perfil Admin, mesma origem e rate limiting.

## Sprint 2.11 — Monitor Automático

O monitor pode ser executado por `POST /api/admin/system/run-monitor` ou pelo cron autenticado `GET /api/cron/system-monitor`. O status é consultado por `GET /api/admin/system/monitor-status` e exibido no Dashboard. Em produção, o cron roda diariamente às 12:00 UTC (09:00 no horário de Brasília), mantendo compatibilidade com o plano Vercel Hobby e evitando custo de upgrade apenas por frequência.

Cada execução:

1. adquire um lock distribuído com TTL no Firestore;
2. avalia Health, parsers, QA e a validação mais recente;
3. reconcilia alertas por fingerprint estável;
4. aplica cooldown para evitar notificações repetidas;
5. persiste o resultado e a auditoria;
6. entrega alertas no painel, Firestore e, quando configurados, e-mail e Telegram;
7. libera o lock mesmo quando há falha.

O cron é autenticado por `CRON_SECRET`. `ENABLE_AUTOMATIC_MONITOR` fica desabilitado por padrão e deve ser habilitado somente depois da configuração das integrações de produção.

## Variáveis de ambiente

```text
ADMIN_EMAILS=admin1@dominio.com,admin2@dominio.com
ENABLE_SCORE_ENGINE=true
ENABLE_SYSTEM_VALIDATION=true
ENABLE_HEALTH_MONITOR=true
ENABLE_AI_INSIGHTS=true
ENABLE_REPORT_PREMIUM=false
ENABLE_AUTOMATIC_MONITOR=false
PREMIUM_PREVIEW_EMAILS=preview@dominio.com
REGULATORY_CACHE_TTL_MS=300000
REGULATORY_MARKET_CACHE_TTL_MS=60000
REGULATORY_CACHE_MAX_ENTRIES=500
AI_INSIGHTS_CACHE_TTL_MS=21600000
AI_INSIGHTS_CACHE_MAX_ENTRIES=250
AI_INSIGHTS_RATE_WINDOW_MS=600000
AI_INSIGHTS_RATE_MAX_REQUESTS=30
OPENAI_INSIGHTS_MODEL=gpt-4.1-mini
OPENAI_INSIGHTS_MAX_OUTPUT_TOKENS=1800
OPENAI_TIMEOUT_MS=120000
MONITOR_ALERT_COOLDOWN_MS=21600000
MONITOR_ALERT_EMAILS=operacao@dominio.com
SMTP_HOST=smtp.dominio.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario
SMTP_PASS=segredo
SMTP_FROM=Dados FII <alertas@dominio.com>
TELEGRAM_BOT_TOKEN=segredo
TELEGRAM_CHAT_ID=identificador
CRON_SECRET=segredo-aleatorio-com-pelo-menos-16-caracteres
```

Os recursos aceitam opt-out explícito com `false`. `ENABLE_AI_INSIGHTS=true` requer `OPENAI_API_KEY`; o modelo pode ser substituído sem alterar APIs consumidoras. Premium e Monitor permanecem desabilitados por padrão para permitir ativação operacional controlada.

## Verificação

`npm run typecheck` valida os contratos TypeScript. `npm run test:sprint2` cobre arquitetura regulatória, publicação segura, scores, Health, Validation, Dashboard, Timeline, relatórios Gratuito e Premium, AI Insights estruturado, Observabilidade e Monitor Automático.
