# Fase 2 — Sprints 2.1 a 2.4

Este documento segue o `DADOS_FII_HANDOFF.md` v2.1.0. Na ordem canônica, a Sprint 2.2 é o Score Engine, a 2.3 é Health e a 2.4 é Validation. Dashboard continua como Sprint 2.5.

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

Todas as rotas exigem Firebase Authentication, e-mail em `ADMIN_EMAILS`, perfil `admin`, cookie HttpOnly, mesma origem e rate limiting. O Dashboard existente continua uma fundação antecipada; seus critérios formais pertencem à Sprint 2.5.

## Variáveis de ambiente

```text
ADMIN_EMAILS=admin1@dominio.com,admin2@dominio.com
ENABLE_SCORE_ENGINE=true
ENABLE_SYSTEM_VALIDATION=true
ENABLE_HEALTH_MONITOR=true
ENABLE_AI_INSIGHTS=false
ENABLE_REPORT_PREMIUM=false
REGULATORY_CACHE_TTL_MS=300000
REGULATORY_MARKET_CACHE_TTL_MS=60000
REGULATORY_CACHE_MAX_ENTRIES=500
```

Score, Health e Validation ficam ativos por padrão e aceitam opt-out explícito com `false`. Os flags de IA e Premium permanecem reservados às suas sprints canônicas.

## Verificação

`npm run typecheck` valida os contratos TypeScript. `npm run test:sprint2` cobre arquitetura regulatória, proteção de campos legados, publicação segura, sete scores, Health completo, métricas de cache, cobertura FII/FIAGRO, checks de validação e persistência de falhas.
