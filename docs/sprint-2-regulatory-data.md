# Fase 2 — Sprints 2.1 a 2.8

Este documento segue o `DADOS_FII_HANDOFF.md` v2.3.0. A implementação avança na ordem canônica até o Relatório Gratuito e o AI Insights Engine.

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

## Variáveis de ambiente

```text
ADMIN_EMAILS=admin1@dominio.com,admin2@dominio.com
ENABLE_SCORE_ENGINE=true
ENABLE_SYSTEM_VALIDATION=true
ENABLE_HEALTH_MONITOR=true
ENABLE_AI_INSIGHTS=true
ENABLE_REPORT_PREMIUM=false
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
```

Os recursos aceitam opt-out explícito com `false`. `ENABLE_AI_INSIGHTS=true` requer `OPENAI_API_KEY`; o modelo pode ser substituído sem alterar APIs consumidoras. Premium permanece desabilitado até a Sprint 2.9.

## Verificação

`npm run typecheck` valida os contratos TypeScript. `npm run test:sprint2` cobre arquitetura regulatória, publicação segura, scores, Health, Validation, Dashboard, Timeline, Relatório Gratuito determinístico e AI Insights estruturado com reutilização de cache.
