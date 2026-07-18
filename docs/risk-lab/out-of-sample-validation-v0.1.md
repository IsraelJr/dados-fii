# Protocolo de validação fora da amostra — Risk Lab v0.1.0

## Objetivo

Medir se as regras congeladas detectam deterioração antes de eventos materiais sem serem ajustadas depois de conhecer o resultado dos fundos avaliados.

## Regra de ouro

A versão `0.1.0` está congelada. Nenhum limite, peso, nível de alerta ou lógica pode ser alterado durante a validação fora da amostra.

Caso uma regra precise mudar:

1. encerrar a rodada atual;
2. registrar o problema antes de recalcular qualquer resultado;
3. criar uma nova versão do ruleset;
4. separar novamente amostra de desenvolvimento e amostra de validação;
5. comparar a nova versão com a `0.1.0` em toda a base histórica.

## Seleção dos fundos

A rodada deve conter, por família de risco:

- casos de deterioração grave não usados para formular as regras;
- fundos saudáveis;
- fundos que passaram por estresse e se recuperaram;
- diferentes gestoras, tamanhos e níveis de transparência.

Os nomes e o papel de cada fundo devem ser registrados antes da execução do backtest.

## Data objetiva da bomba

Cada caso problemático deve possuir uma data de evento definida previamente, como:

- primeiro corte material de dividendos;
- primeiro default ou inadimplência material reconhecida;
- recuperação judicial relevante;
- reconhecimento de perda patrimonial;
- quebra de covenant;
- drawdown previamente parametrizado;
- fato relevante que caracterize comprometimento da tese.

A definição não pode ser trocada depois de observar os alertas.

## Execução temporal

Para cada data simulada:

- utilizar somente documentos com `publishedAt <= knownAt <= asOf`;
- manter ausências como `null`;
- registrar a versão e o hash do dataset e das regras;
- gravar o primeiro amarelo, laranja e vermelho;
- não reclassificar alertas depois de observar eventos posteriores.

## Métricas mínimas

- quantidade de fundos problemáticos avaliados;
- detectados antes do evento;
- detectados somente depois do evento;
- não detectados;
- antecedência do primeiro amarelo, laranja e vermelho;
- falsos vermelhos em fundos saudáveis;
- falsos laranjas;
- alertas que regrediram após estresse reversível;
- precisão e cobertura por família de risco.

## Critérios preliminares de sucesso

- zero falsos vermelhos em fundos saudáveis;
- alertas vermelhos sempre sustentados por evidência primária ou confirmação externa independente;
- antecedência positiva em parte relevante dos casos graves;
- regras reproduzíveis com o mesmo hash;
- documentação integral dos casos não detectados.

## Interpretação dos indicadores

- `evidenceConfidence`: confiabilidade dos dados e do diagnóstico;
- `deteriorationSeverityScore`: gravidade da deterioração, quanto maior pior;
- `thesisHealthScore`: saúde estimada da tese, quanto maior melhor;
- `managementTrustScore`: não calculado na versão `0.1.0`.

A confiança nas evidências nunca deve ser apresentada como nota de qualidade do fundo ou da gestão.
