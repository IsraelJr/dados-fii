# Fase 2 — Sprints 2.1 e 2.2

## Sprint 2.1 — Foundation / RegulatoryDataService

O `RegulatoryDataService` é o ponto único de leitura e escrita dos dados de fundos usados pelas rotas `/api/fii` e `/api/fii/batch`. Ele preserva os campos legados, normaliza FII, FIAGRO e FI-Infra, combina a base `Fiis`, o overlay regulatório versionado e as cotações da planilha.

### Precedência do merge

1. Base legada `Fiis` para compatibilidade com os consumidores atuais.
2. Overlay publicado em `RegulatoryFunds/{ticker}` para dados cadastrais e regulatórios.
3. Planilha de cotações somente para preço, abertura, variação, mínima e máxima.

Os metadados `regulatoryMeta` informam versão, fontes, resultado da validação e hit/miss do cache. O cache de fundos tem TTL padrão de 5 minutos e o de cotações, 1 minuto. Publicação e rollback invalidam imediatamente a entrada afetada.

### Coleções

| Coleção | Finalidade |
|---|---|
| `Fiis` | Base legada lida durante a transição |
| `RegulatoryFunds` | Estado regulatório publicado por ticker |
| `RegulatoryFundVersions/{ticker}/versions` | Versões imutáveis e rollback |
| `RegulatoryValidationRuns` | Histórico das validações |
| `RegulatoryParserHealth` | Saúde consolidada de cada parser/fonte |
| `RegulatoryAuditLogs` | Auditoria de validação, publicação e rollback |

## Sprint 2.2 — Health & Admin

Todas as rotas abaixo aceitam somente `POST`, exigem cookie de sessão HttpOnly criado a partir de um Firebase ID Token válido, e validam no servidor se o e-mail verificado pertence a `ADMIN_EMAILS`.

| Rota | Função | Limite padrão |
|---|---|---|
| `/api/admin/system/health` | Health Score, última validação, parsers e cache | 30/min |
| `/api/admin/system/parser-health` | Saúde detalhada das fontes | 30/min |
| `/api/admin/system/validation-history` | Histórico de até 50 execuções | 30/min |
| `/api/admin/system/run-validation` | Executa e audita a validação | 3/5 min |
| `/api/admin/session` | Login, status e logout da sessão admin | 8/5 min no login |

O painel fica em `/admin/sistema`. O antigo `/admin/observabilidade` passa a usar a mesma sessão, sem enviar segredo no JavaScript, URL, header ou corpo.

### Variáveis de ambiente

```text
ADMIN_EMAILS=admin1@dominio.com,admin2@dominio.com
REGULATORY_CACHE_TTL_MS=300000
REGULATORY_MARKET_CACHE_TTL_MS=60000
REGULATORY_CACHE_MAX_ENTRIES=500
```

`ADMIN_UPDATE_SECRET` e `CRON_SECRET` não autenticam os novos endpoints administrativos. Continuam disponíveis somente para rotinas legadas/cron enquanto essas rotas forem migradas separadamente.

### Critérios de aceite cobertos

- Tipagem única para FII, FIAGRO e FI-Infra.
- Merge compatível com a resposta atual das APIs de consulta.
- Cache com TTL, limite, single-flight para a planilha e invalidação em escrita.
- Publicação e rollback versionados com auditoria.
- Validação de ticker, tipo, CNPJ, identificação, segmento e fonte.
- Health Score, saúde dos parsers e histórico persistido.
- APIs novas sem acesso direto ao Firestore.
- Sessão HttpOnly, Firebase Auth, allowlist de e-mail, mesma origem e rate limiting.
- Painel administrativo sem segredo exposto no cliente.
