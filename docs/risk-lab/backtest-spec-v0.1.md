# Especificação do backtest v0.1

## Objetivo

Verificar se regras objetivas detectariam deterioração antes de cortes, defaults ou drawdowns, sem usar fatos posteriores.

## Unidade temporal

Um snapshot representa tudo o que era publicamente conhecido até `asOf`. A competência contábil não substitui a data de publicação.

## Regras de integridade

- `knownAt <= asOf` para toda observação.
- Documentos reapresentados são novas versões.
- Ausência de dado permanece `null`.
- Inferências são marcadas e não podem ter a mesma confiança de fatos confirmados.
- Regras e thresholds são versionados.

## Saídas obrigatórias

- risco estrutural;
- alerta de deterioração;
- alerta prudencial;
- confiança;
- regras acionadas;
- métricas e documentos que sustentam cada regra.

## Critérios de aprovação do piloto

- 100% das métricas materiais rastreáveis a documentos;
- zero uso de informação futura;
- reprodução dos marcos manuais dentro de um ciclo de publicação;
- nenhum vermelho em fundos saudáveis de controle;
- falsos laranjas raros e explicáveis;
- resultados reproduzíveis com a mesma versão de regras e dados.

## Conjunto inicial

1. HCTR11 — caso de deterioração de crédito.
2. TGAR11 — caso de deterioração de conversão de valor econômico em caixa.
3. Pelo menos quatro fundos de controle: dois estáveis e dois com estresse reversível.
