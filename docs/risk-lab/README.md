# Risk Lab — piloto HCTR11/TGAR11

Este módulo valida um detector precoce de deterioração de tese sem usar informação futura.

## Princípios

1. Cada observação guarda `competenceDate`, `knownAt`, confiança e evidência.
2. O alerta nasce na data em que a informação se tornou pública, não no encerramento da competência analisada.
3. O backtest rejeita qualquer dado publicado depois da data simulada.
4. Risco estrutural e deterioração são avaliados separadamente.
5. Regras são determinísticas, versionadas e explicáveis.
6. IA pode extrair informações, mas não cria números ausentes nem substitui a fonte.
7. Qualidade documental (`gold`) e liberação para produção (`productionApproved`) são decisões separadas.

## Escopo v0.1

- HCTR11: crédito high yield, carência, inadimplência e cobertura dos dividendos.
- TGAR11: desenvolvimento/equity, cobertura de caixa, reserva, reavaliações e eventos de liquidez.
- Fundos de controle serão incluídos antes de qualquer uso público.

## Estrutura

- `src/types/riskLab.ts`: contratos do domínio e metadados de proveniência.
- `src/lib/risk-lab/RuleEngine.ts`: avaliação explicável e bloqueio de look-ahead.
- `src/lib/risk-lab/rules.ts`: regras iniciais do piloto.
- `src/lib/risk-lab/BacktestEngine.ts`: simulação cronológica.
- `src/lib/risk-lab/DatasetLoader.ts`: validação de datasets candidatos, ouro e bloqueio de produção.
- `tests/risk-lab-pilot.test.ts`: casos históricos sintéticos mínimos.
- `tests/risk-lab-dataset.test.ts`: execução sobre datasets documentais e testes das travas de qualidade.
- `datasets/candidate-hctr-tgar-v0.1.json`: observações extraídas da investigação com datas de publicação e evidências.
- `datasets/gold-hctr-tgar-v0.1.json`: somente observações promovidas após conferência direta da fonte primária.
- `data-dictionary-v0.1.json`: métricas e semântica.
- `backtest-spec-v0.1.md`: critérios de validação.

## Níveis de qualidade do dataset

### Candidate

Pode incluir fontes secundárias rastreáveis, trechos ainda sem página exata e métricas com confiança inferior a 90%. Serve para desenvolver o pipeline, testar regras e localizar lacunas documentais. Nenhuma conclusão pública deve depender exclusivamente dessa camada.

### Gold

Para promoção, cada observação precisa ter:

- documento primário regulatório ou da gestora;
- URL rastreável;
- página exata;
- trecho que sustente diretamente o valor;
- data da primeira publicação pública;
- classificação `confirmed`;
- confiança mínima de 90%;
- `knownAt` correspondente à primeira disponibilização pública;
- data, método e responsável pela revisão;
- método `manual_document_review`.

Trocar apenas o rótulo de `candidate` para `gold` faz o carregador rejeitar o arquivo. Fonte secundária, página ausente ou revisão somente automatizada também são rejeitadas.

## Liberação para produção

`productionApproved` não é sinônimo de `gold`:

- um dataset `candidate` nunca pode ser aprovado para produção;
- um dataset `gold` pode continuar com `productionApproved: false`;
- a liberação pública exige revisão final, fundos de controle e medição de falsos positivos.

## Estado atual

O dataset candidato v0.1 reproduz:

- HCTR11 laranja em 22/11/2024 e vermelho em 12/12/2024;
- TGAR11 amarelo em 31/07/2024 e laranja em 26/01/2026.

A data de 31/07/2024 substitui 30/06/2024 como momento acionável do alerta do TGAR11, porque o dado do primeiro semestre só se tornou público na entrega do relatório.

O primeiro seed ouro contém exclusivamente o evento HCTR11 de 12/12/2024, conferido no fato relevante oficial:

- resultado mensal igual a zero;
- distribuição de R$ 0,37 por cota;
- alerta vermelho pela regra `HY-003` — distribuição sem resultado positivo no período;
- `productionApproved: false`.

As métricas de carteira do HCTR11 de outubro de 2024 e todas as observações do TGAR11 continuam como `candidate` até conferência direta, página a página, dos documentos primários.

## Próxima entrega

Promover as métricas de carteira do HCTR11 e os primeiros eventos do TGAR11 somente após validação dos PDFs oficiais. Em seguida, preencher os meses intermediários e adicionar fundos saudáveis e fundos com estresse reversível para medir falsos positivos.
