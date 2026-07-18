# Especificação do backtest v0.1

## Objetivo

Verificar se regras objetivas detectariam deterioração antes de cortes, defaults ou drawdowns, sem usar fatos posteriores.

## Unidade temporal

Um snapshot representa tudo o que era publicamente conhecido até `asOf`. A competência contábil não substitui a data de publicação.

## Regras de integridade

- `knownAt <= asOf` para toda observação.
- `publishedAt <= knownAt` quando a data de publicação estiver registrada.
- Documentos reapresentados são novas versões.
- Ausência de dado permanece `null`.
- Inferências são marcadas e não podem ter a mesma confiança de fatos confirmados.
- Regras e thresholds são versionados.
- Um dataset `candidate` não pode ter `productionApproved: true`.

## Promoção para gold

Cada observação promovida deve conter:

- fonte primária regulatória ou da gestora;
- URL rastreável;
- página exata;
- trecho que sustente diretamente o valor;
- primeira data de publicação pública;
- classificação `confirmed`;
- confiança mínima de 90%;
- data e responsável pela revisão;
- método `manual_document_review`.

A promoção é feita por observação. Um evento validado não autoriza promover automaticamente outros meses, métricas ou fundos.

## Liberação para produção

Qualidade documental e liberação pública são controles distintos:

- `gold` comprova a trilha documental;
- `productionApproved` autoriza consumo pelo produto;
- o dataset ouro inicial deve permanecer com `productionApproved: false`;
- a aprovação para produção exige revisão final, controles saudáveis e avaliação de falsos positivos.

## Saídas obrigatórias

- risco estrutural;
- alerta de deterioração;
- alerta prudencial;
- confiança consolidada;
- confiança individual de cada regra acionada;
- regras acionadas;
- métricas e documentos que sustentam cada regra.

A confiança consolidada pode ser inferior à confiança da evidência crítica quando o assessment combinar regras distintas, como alerta estrutural e deterioração.

## Critérios de aprovação do piloto

- 100% das métricas materiais rastreáveis a documentos;
- zero uso de informação futura;
- reprodução dos marcos manuais dentro de um ciclo de publicação;
- nenhum vermelho em fundos saudáveis de controle;
- falsos laranjas raros e explicáveis;
- resultados reproduzíveis com a mesma versão de regras e dados;
- nenhum consumo de dataset com `productionApproved: false` pelas rotas públicas.

## Conjunto inicial

1. HCTR11 — caso de deterioração de crédito.
2. TGAR11 — caso de deterioração de conversão de valor econômico em caixa.
3. Pelo menos quatro fundos de controle: dois estáveis e dois com estresse reversível.
