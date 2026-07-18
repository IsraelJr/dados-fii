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

## Liberação operacional

Qualidade documental e autorização de uso são controles distintos:

- `gold` comprova a trilha documental;
- `productionApproved` autoriza somente o escopo registrado;
- a aprovação exige responsável, data, motivo, hash SHA-256, whitelist de tickers e escopo;
- o seed inicial está limitado a `admin_unit_test_only` e `HCTR11`;
- a aprovação administrativa não autoriza relatório Premium, notificações ou análise pública;
- o runtime deve rejeitar qualquer ticker, dataset ou escopo diferente.

## Saídas obrigatórias

- risco estrutural;
- alerta de deterioração;
- alerta prudencial;
- confiança consolidada;
- confiança individual de cada regra acionada;
- regras acionadas;
- métricas e documentos que sustentam cada regra;
- versão e hash do dataset;
- versão e hash do conjunto de regras;
- responsável e horário da execução;
- indicação explícita de que Premium e notificações não foram acionados.

A confiança consolidada pode ser inferior à confiança da evidência crítica quando o assessment combinar regras distintas, como alerta estrutural e deterioração.

## Critérios de aprovação do piloto analítico

- 100% das métricas materiais rastreáveis a documentos;
- zero uso de informação futura;
- reprodução dos marcos manuais dentro de um ciclo de publicação;
- nenhum vermelho em fundos saudáveis de controle;
- falsos laranjas raros e explicáveis;
- resultados reproduzíveis com a mesma versão de regras e dados.

## Critérios da fatia vertical administrativa

A execução unitária do HCTR11 é considerada pronta para implantação quando:

1. a rota exige a autenticação administrativa já utilizada pelo sistema;
2. a tela `/admin/risk-lab` oferece um único botão de execução;
3. apenas `HCTR11` é aceito pelo serviço e pelo dataset aprovado;
4. o marco de 12/12/2024 produz alerta prudencial e de deterioração vermelhos;
5. a regra `HY-003` aparece entre as regras acionadas;
6. as evidências exibidas são primárias, com página e URL oficial;
7. o relatório é persistido de forma imutável;
8. último resultado, histórico e auditoria são atualizados;
9. cliques concorrentes são bloqueados por lock com TTL;
10. falhas também são auditadas;
11. a feature flag permite desligamento imediato;
12. TGAR11 e outros tickers são recusados;
13. nenhum caminho chama Relatório Premium, AI Insights, e-mail, Telegram ou notificações;
14. um fundo high yield saudável de controle não recebe vermelho;
15. um fundo estressado reversível pode receber laranja sem ser forçado a vermelho;
16. typecheck e testes específicos passam no CI.

## Smoke test após implantação

O teste manual no ambiente implantado deve confirmar:

1. login no Admin;
2. abertura de `/admin/risk-lab`;
3. clique em **Gerar relatório de risco**;
4. exibição do alerta vermelho do HCTR11;
5. presença da regra `HY-003` e das duas evidências da página 3;
6. criação de documentos em `RiskLabReports`, `RiskLabStatus` e `RiskLabAudit`;
7. ausência de e-mails, notificações e alterações no Relatório Premium;
8. segunda execução registrada separadamente e sem sobrescrever o relatório anterior.

## Conjunto inicial

1. HCTR11 — caso de deterioração de crédito e único ticker autorizado na fatia administrativa.
2. TGAR11 — caso de desenvolvimento mantido somente no dataset candidato e bloqueado na produção.
3. Controles automatizados iniciais: um high yield estável e um estresse reversível.
4. Antes da generalização: pelo menos quatro fundos documentais de controle, dois estáveis e dois com estresse reversível.
