# Fase 2 — Sprints 2.1 e 2.2

Este documento segue o `DADOS_FII_HANDOFF.md` v2.0.0. Na ordem canônica, a Sprint 2.2 é o Score Engine; Health, Validation e Dashboard pertencem às Sprints 2.3, 2.4 e 2.5.

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

## Estruturas antecipadas

As APIs e telas de Health, Validation e Admin que já existiam na branch foram preservadas com Firebase Auth, `ADMIN_EMAILS`, cookie HttpOnly e rate limiting. Elas são fundações antecipadas, mas só serão consideradas concluídas após os critérios formais das Sprints 2.3, 2.4 e 2.5.

## Variáveis de ambiente

```text
ADMIN_EMAILS=admin1@dominio.com,admin2@dominio.com
ENABLE_SCORE_ENGINE=true
ENABLE_SYSTEM_VALIDATION=false
ENABLE_HEALTH_MONITOR=false
ENABLE_AI_INSIGHTS=false
ENABLE_REPORT_PREMIUM=false
REGULATORY_CACHE_TTL_MS=300000
REGULATORY_MARKET_CACHE_TTL_MS=60000
REGULATORY_CACHE_MAX_ENTRIES=500
```

O Score Engine fica ativo por padrão e só é desligado quando `ENABLE_SCORE_ENGINE=false`. Os demais flags permanecem reservados às suas sprints canônicas.

## Verificação

`npm run typecheck` valida os contratos TypeScript. `npm run test:sprint2` cobre separação arquitetural, ausência de Firestore nas APIs regulatórias novas, proteção de campos legados, autorização de publicação, geração dos sete scores, limites, explicabilidade, composição Premium e ausência de mutação da entrada.
