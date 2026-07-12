# Piloto de ingestão automática do TGAR11

O piloto valida a descoberta, extração e normalização de dados oficiais antes de qualquer publicação na coleção `Fiis`.

## Segurança

- O endpoint aceita somente `TGAR11`.
- Todas as informações são gravadas em staging.
- `publishToOfficialBase` permanece `false` durante todo o fluxo.
- Uma falha em qualquer etapa é registrada em `FiiIngestionRuns/{runId}`.
- Nenhum dado existente em `Fiis/TGAR11` é sobrescrito.
- O painel administrativo usa um cookie assinado, HttpOnly e com validade padrão de oito horas.
- A chave administrativa é usada somente no login e não fica disponível ao JavaScript.
- O login funciona com a chave já existente; `ADMIN_USER` é opcional e serve apenas para identificar a sessão.
- O botão Sair encerra a sessão imediatamente.
- As chaves atuais continuam aceitas em chamadas técnicas e tarefas agendadas.

## Parser mensal v2

O ZIP anual da CVM possui três subtipos de CSV:

- `geral`: identificação, nome, ISIN, segmento, mandato e quantidade de cotas;
- `complemento`: patrimônio líquido, cotas emitidas, VP/cota, cotistas, dividend yield e rentabilidades;
- `ativo_passivo`: caixa, CRI, LCI, imóveis, contas a receber e rendimentos a distribuir.

O parser v2:

1. lê somente esses três arquivos reconhecidos;
2. decodifica os CSVs como Latin-1;
3. filtra o CNPJ por coluna, não apenas por ocorrência textual;
4. mantém a versão mais recente de cada subtipo por competência;
5. consolida `geral + complemento + ativo_passivo` por `CNPJ + Data_Referencia`;
6. grava uma única linha por competência;
7. registra arquivos de origem, subtipo, linha, versão e fragmentos brutos;
8. identifica divergências entre subtipos como conflitos explícitos.

A chave do snapshot é derivada de `ticker + data de referência`, sem índice de linha.

## Análise documental por IA

A análise documental não depende mais de busca web. Os oito documentos oficiais mais recentes são enviados à Responses API como `input_file` por URL, com detalhe visual baixo para controlar custo e tokens.

Regras:

- somente links oficiais da CVM, FNET ou RAD são aceitos;
- sites agregadores e fontes externas não entram na análise;
- a cobertura é calculada pela interseção entre URLs submetidas e documentos marcados como realmente acessados;
- fontes não autorizadas retornadas pelo modelo são descartadas;
- cobertura inferior a 50% permanece como `partial`;
- o modo de entrada é registrado como `direct_pdf`.

É possível repetir somente esta etapa, preservando os snapshots mensais:

```text
/api/admin/fii-ingestion/retry-ai?runId=IDENTIFICADOR
```

## Fluxo

1. O administrador entra em `/admin` uma vez.
2. O servidor cria a sessão segura no navegador.
3. O administrador inicia o card **Piloto de ingestão TGAR11** sem informar novamente a chave.
4. Um Vercel Workflow é iniciado imediatamente ou após o atraso informado.
5. O CNPJ é resolvido pelo parâmetro, pelo documento `Fiis/TGAR11` ou pela configuração do ambiente.
6. O catálogo CKAN da CVM localiza o recurso anual do informe mensal.
7. O ZIP é baixado, filtrado pelo CNPJ e consolidado pelo parser v2.
8. O catálogo de documentos eventuais é filtrado pelo mesmo CNPJ.
9. A OpenAI recebe diretamente os PDFs oficiais selecionados.
10. O validador calcula cobertura, duplicidades, conflitos e cobertura documental da IA.

## Coleções

```text
FiiIngestionRuns/{runId}
FiiIngestionStaging/{runId}
FiiIngestionStaging/{runId}/MonthlySnapshots/{snapshotId}
FiiIngestionStaging/{runId}/Documents/{documentId}
```

## QA manual por API

Após a execução terminar com `status: completed`, o administrador pode abrir:

```text
/api/admin/fii-ingestion/qa?persist=1
```

A rota seleciona automaticamente a execução concluída mais recente. Também aceita:

```text
/api/admin/fii-ingestion/qa?runId=IDENTIFICADOR&persist=1
```

O QA retorna `fail` quando houver qualquer uma destas condições:

- execução produzida pelo parser antigo;
- publicação oficial não comprovadamente bloqueada;
- ausência do staging ou CNPJ inválido;
- mais de uma linha para a mesma competência;
- cobertura de qualquer campo essencial abaixo de 80%;
- conflito entre os três subtipos mensais;
- divergência entre contagem gravada e resumo do workflow;
- `readyForReview` falso ou bloqueios registrados pelo workflow.

A extração por IA só recebe `pass` quando utiliza pelo menos 50% dos documentos submetidos. Abaixo disso, permanece como análise parcial e gera alerta.

A resposta inclui `assistantReviewPayload`, pronto para copiar e enviar ao assistente. O relatório completo pode ser persistido em:

```text
FiiIngestionRuns/{runId}.manualQa
FiiIngestionStaging/{runId}.manualQa
```

A API nunca autoriza publicação automática. Mesmo um resultado aprovado permanece bloqueado até revisão humana.

## Configuração opcional

- `ADMIN_SESSION_SECRET`: chave exclusiva para assinatura da sessão;
- `ADMIN_SESSION_TTL_SECONDS`: duração da sessão;
- `OPENAI_DOCUMENT_MODEL`: modelo com suporte a PDF/visão usado na análise direta.

Quando `OPENAI_DOCUMENT_MODEL` não existe, a aplicação usa `OPENAI_MODEL` e, por último, `gpt-4.1-mini`.

O projeto precisa estar com Vercel Workflows e Fluid Compute habilitados.

## Critério de aprovação do piloto

O piloto somente avança para revisão humana quando:

- usa o parser v2;
- encontra competências mensais únicas;
- alcança pelo menos 80% de cobertura em data, patrimônio, cotas, cotistas e VP/cota;
- não apresenta conflitos entre subtipos;
- mantém rastreabilidade da origem;
- não altera a base oficial;
- classifica corretamente a cobertura parcial da IA.
