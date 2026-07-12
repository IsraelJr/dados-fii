# Piloto de ingestão automática do TGAR11

O piloto valida a descoberta, extração e normalização de dados oficiais antes de qualquer publicação na coleção `Fiis`.

## Segurança

- O endpoint aceita somente `TGAR11`.
- Todas as informações são gravadas em staging.
- `publishToOfficialBase` permanece `false` durante todo o fluxo.
- Uma falha em qualquer etapa é registrada em `FiiIngestionRuns/{runId}`.
- Nenhum dado existente em `Fiis/TGAR11` é sobrescrito.

## Fluxo

1. O administrador dispara `/api/admin/fii-ingestion/start`.
2. Um Vercel Workflow é iniciado imediatamente ou após o atraso informado.
3. O CNPJ é resolvido pelo parâmetro, pelo documento `Fiis/TGAR11` ou pela variável `TGAR11_CNPJ`.
4. O catálogo CKAN da CVM localiza o recurso anual do informe mensal.
5. O ZIP é baixado, filtrado pelo CNPJ e normalizado.
6. O catálogo de documentos eventuais é filtrado pelo mesmo CNPJ.
7. A OpenAI tenta extrair dados adicionais a partir dos documentos oficiais localizados.
8. O validador calcula cobertura e deixa o resultado pronto para revisão.

## Coleções

```text
FiiIngestionRuns/{runId}
FiiIngestionStaging/{runId}
FiiIngestionStaging/{runId}/MonthlySnapshots/{snapshotId}
FiiIngestionStaging/{runId}/Documents/{documentId}
```

## Disparo pelo painel

A página `/admin` possui o card **Piloto de ingestão TGAR11** com:

- CNPJ opcional;
- ano de referência;
- atraso em minutos;
- status atualizado automaticamente.

## Disparo por API

```bash
curl -X POST https://www.dadosfii.com.br/api/admin/fii-ingestion/start \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $ADMIN_UPDATE_SECRET" \
  -d '{
    "ticker": "TGAR11",
    "year": 2026,
    "delayMinutes": 0
  }'
```

Consulta:

```bash
curl -X POST https://www.dadosfii.com.br/api/admin/fii-ingestion/status \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $ADMIN_UPDATE_SECRET" \
  -d '{"runId":"ID_DA_EXECUCAO"}'
```

## Variáveis

```env
ADMIN_UPDATE_SECRET=...
CRON_SECRET=...
FIREBASE_SERVICE_ACCOUNT_KEY=...
OPENAI_API_KEY=...
OPENAI_SEARCH_MODEL=gpt-4.1-mini
TGAR11_CNPJ=... # opcional quando o CNPJ já existe no Firestore
```

O projeto precisa estar com Vercel Workflows habilitado e Fluid Compute ativo no ambiente de implantação.

## Critério de aprovação do piloto

O piloto é considerado tecnicamente promissor quando:

- encontra registros mensais pelo CNPJ;
- indexa documentos oficiais;
- mantém rastreabilidade da origem;
- calcula cobertura dos campos críticos;
- não altera a base oficial;
- identifica claramente extrações que precisam de revisão humana.
