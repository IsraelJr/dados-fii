# Risk Lab — piloto HCTR11/TGAR11

Este módulo valida um detector precoce de deterioração de tese sem usar informação futura.

## Princípios

1. Cada observação guarda `competenceDate`, `knownAt`, confiança e evidência.
2. O alerta nasce na data em que a informação se tornou pública, não no encerramento da competência analisada.
3. O backtest rejeita qualquer dado publicado depois da data simulada.
4. Risco estrutural e deterioração são avaliados separadamente.
5. Regras são determinísticas, versionadas e explicáveis.
6. IA pode extrair informações, mas não cria números ausentes nem substitui a fonte.

## Escopo v0.1

- HCTR11: crédito high yield, carência, inadimplência e cobertura dos dividendos.
- TGAR11: desenvolvimento/equity, cobertura de caixa, reserva, reavaliações e eventos de liquidez.
- Fundos de controle serão incluídos antes de qualquer uso público.

## Estrutura

- `src/types/riskLab.ts`: contratos do domínio.
- `src/lib/risk-lab/RuleEngine.ts`: avaliação explicável e bloqueio de look-ahead.
- `src/lib/risk-lab/rules.ts`: regras iniciais do piloto.
- `src/lib/risk-lab/BacktestEngine.ts`: simulação cronológica.
- `src/lib/risk-lab/DatasetLoader.ts`: validação de datasets candidatos e ouro.
- `tests/risk-lab-pilot.test.ts`: casos históricos sintéticos mínimos.
- `tests/risk-lab-dataset.test.ts`: execução sobre o primeiro dataset documental.
- `datasets/candidate-hctr-tgar-v0.1.json`: observações extraídas da investigação com datas de publicação e evidências.
- `data-dictionary-v0.1.json`: métricas e semântica.
- `backtest-spec-v0.1.md`: critérios de validação.

## Níveis de qualidade do dataset

### Candidate

Pode incluir fontes secundárias rastreáveis, trechos ainda sem página exata e métricas com confiança inferior a 90%. Serve para desenvolver o pipeline, testar regras e localizar lacunas documentais. Nenhuma conclusão pública deve depender exclusivamente dessa camada.

### Gold

Para promoção, cada observação precisa ter:

- documento primário conferido;
- URL rastreável;
- trecho que sustente diretamente o valor;
- classificação `confirmed`;
- confiança mínima de 90%;
- `knownAt` correspondente à primeira disponibilização pública;
- revisão humana da competência, unidade e interpretação econômica.

Trocar apenas o rótulo de `candidate` para `gold` faz o carregador rejeitar o arquivo.

## Estado atual

O dataset candidato v0.1 reproduz:

- HCTR11 laranja em 22/11/2024 e vermelho em 12/12/2024;
- TGAR11 amarelo em 31/07/2024 e laranja em 26/01/2026.

A data de 31/07/2024 substitui 30/06/2024 como momento acionável do alerta do TGAR11, porque o dado do primeiro semestre só se tornou público na entrega do relatório.

## Próxima entrega

Conferir os documentos primários página a página, registrar a primeira URL oficial disponível e promover somente as observações aprovadas para `gold-hctr-tgar-v0.1.json`. Depois disso, preencher os meses intermediários e adicionar fundos de controle.
