# Modo operacional controlado de ingestão de FIIs

O modo operacional reaproveita o parser v2 validado no piloto TGAR11 e amplia o teste exclusivamente para os fundos autorizados em whitelist.

## Fundos autorizados

```text
TGAR11
VGIA11
```

Qualquer outro ticker é rejeitado tanto na API de início quanto dentro do próprio workflow.

## Segurança

- Todas as gravações permanecem em `FiiIngestionStaging` e `FiiIngestionRuns`.
- `publishToOfficialBase` é sempre `false`.
- Não existe publicação automática em `Fiis/{ticker}`.
- Apenas uma execução ativa por ticker é permitida.
- O CNPJ é validado e usado como filtro em todas as fontes da CVM.
- O QA exige parser v2, competências únicas, cobertura mínima de 80% e ausência de conflitos.
- A publicação futura dependerá de uma etapa própria de pré-publicação, comparação e aprovação humana.

## IA opcional

O enriquecimento documental por IA fica desativado por padrão.

Com a IA desativada:

- os informes mensais são coletados normalmente;
- os documentos eventuais são indexados normalmente;
- nenhum crédito da OpenAI é consumido;
- a validação não gera alerta apenas por ausência de IA.

Quando a IA é ativada, qualquer falha de cota, acesso ou processamento é tratada como falha opcional e não derruba a coleta estruturada.

## Tela administrativa

```text
/admin/fii-ingestion
```

A tela permite:

- selecionar `TGAR11` ou `VGIA11`;
- informar CNPJ opcional;
- selecionar o ano;
- configurar atraso;
- ativar ou manter desativada a IA;
- iniciar uma execução;
- acompanhar o status;
- executar o QA operacional.

O identificador da execução mais recente é guardado no navegador para permitir retomar o acompanhamento após atualizar a página.

## APIs

Iniciar:

```text
POST /api/admin/fii-ingestion/start
```

Exemplo de corpo para VGIA11 sem IA:

```json
{
  "ticker": "VGIA11",
  "year": 2026,
  "delayMinutes": 0,
  "enableAi": false
}
```

Consultar status:

```text
GET ou POST /api/admin/fii-ingestion/status
```

Executar QA:

```text
GET /api/admin/fii-ingestion/operational-qa?runId=IDENTIFICADOR&persist=1
```

## Resolução do CNPJ

A ordem é:

1. CNPJ informado manualmente na execução;
2. documento `Fiis/{ticker}`;
3. consulta pelo campo `code` na coleção `Fiis`;
4. fallback específico de ambiente apenas quando existente.

Caso `Fiis/VGIA11` não possua CNPJ, o administrador deve informar o CNPJ oficial na tela. O sistema não tenta adivinhar o CNPJ.

## Critério para revisão humana

Uma execução pode avançar para revisão humana quando:

- termina com `status=completed` e `currentStep=completed`;
- usa o parser v2;
- possui CNPJ válido e consistente;
- tem uma única linha por competência;
- alcança pelo menos 80% de cobertura nos campos essenciais;
- não contém conflito entre subtipos;
- apresenta contagem consistente com o workflow;
- mantém a base oficial bloqueada.

Mesmo uma execução aprovada pelo QA continua com:

```text
canPublishToOfficialBase: false
publicationDecision: blocked_pending_human_review
```
