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

## Fluxo

1. O administrador entra em `/admin` uma vez.
2. O servidor cria a sessão segura no navegador.
3. O administrador inicia o card **Piloto de ingestão TGAR11** sem informar novamente a chave.
4. Um Vercel Workflow é iniciado imediatamente ou após o atraso informado.
5. O CNPJ é resolvido pelo parâmetro, pelo documento `Fiis/TGAR11` ou pela configuração do ambiente.
6. O catálogo CKAN da CVM localiza o recurso anual do informe mensal.
7. O ZIP é baixado, filtrado pelo CNPJ e normalizado.
8. O catálogo de documentos eventuais é filtrado pelo mesmo CNPJ.
9. A OpenAI tenta extrair dados adicionais a partir dos documentos oficiais localizados.
10. O validador calcula cobertura e deixa o resultado pronto para revisão.

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

A página restaura automaticamente a sessão enquanto o cookie continuar válido.

## Disparo por API

Chamadas técnicas continuam compatíveis com o cabeçalho administrativo já utilizado pelo projeto.

## QA manual por API

Após a execução terminar com `status: completed`, o administrador pode abrir:

```text
/api/admin/fii-ingestion/qa
```

A rota seleciona automaticamente a execução concluída mais recente do TGAR11. Também aceita um identificador específico:

```text
/api/admin/fii-ingestion/qa?runId=IDENTIFICADOR
```

Para salvar o relatório de QA no documento da execução e no staging:

```text
/api/admin/fii-ingestion/qa?persist=1
```

A resposta inclui:

- status e escopo da execução;
- confirmação de bloqueio da publicação oficial;
- contagem real e esperada de snapshots e documentos;
- cobertura dos campos mensais;
- consistência do CNPJ;
- plausibilidade de datas e valores;
- verificação das fontes oficiais;
- situação da extração por IA;
- score, veredito, alertas e recomendações;
- amostras compactas para revisão;
- `assistantReviewPayload`, pronto para copiar e enviar ao assistente.

A API nunca autoriza publicação automática. Mesmo um resultado aprovado permanece bloqueado até revisão humana.

## Configuração adicional opcional

É possível configurar uma chave exclusiva para assinar as sessões administrativas e alterar a duração padrão. Quando a chave exclusiva não existe, a aplicação usa a chave administrativa atual como fallback.

O projeto precisa estar com Vercel Workflows habilitado e Fluid Compute ativo no ambiente de implantação.

## Critério de aprovação do piloto

O piloto é considerado tecnicamente promissor quando:

- encontra registros mensais pelo CNPJ;
- indexa documentos oficiais;
- mantém rastreabilidade da origem;
- calcula cobertura dos campos críticos;
- não altera a base oficial;
- identifica claramente extrações que precisam de revisão humana.
