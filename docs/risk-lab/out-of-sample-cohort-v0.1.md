# Coorte externa v0.1 — crédito imobiliário

## Status

**Pré-registrada e bloqueada para execução.**

O ruleset `v0.1.0` permanece congelado. Nenhum backtest pode começar até que datas, janelas e fontes primárias estejam verificadas e gravadas no registro estruturado.

## Composição congelada

| Papel | Fundos |
|---|---|
| Deterioração grave | DEVA11, VSLH11 |
| Controles saudáveis | KNCR11, KNSC11 |
| Estresse reversível | MCCI11, RBRY11 |

HCTR11 e TGAR11 são excluídos porque participaram do desenvolvimento do piloto.

## Hipóteses registradas antes da extração

### Deterioração grave

O motor deve produzir amarelo, laranja ou vermelho antes do evento material, usando apenas informações públicas disponíveis em cada data simulada.

O evento material será a primeira confirmação primária de default, inadimplência, impairment ou reestruturação relevante, ou um corte recorrente de rendimento de pelo menos 30% versus a mediana dos seis meses anteriores quando atribuído a perda de crédito.

### Controles saudáveis

Não devem receber vermelho em nenhum período. Laranja só será aceitável quando existir evidência primária material e temporariamente negativa.

### Estresse reversível

O motor pode emitir amarelo ou laranja durante a piora, mas não deve manter vermelho quando a cobertura de caixa e os indicadores de crédito se recuperarem sem default material.

A janela será definida por uma queda de pelo menos 20% na média de rendimentos de três meses versus a mediana dos seis meses anteriores, seguida de recuperação da média de três meses para pelo menos 90% da referência.

## Trava antes do backtest

Para liberar a execução, é obrigatório:

1. confirmar em fonte primária a data objetiva do evento de DEVA11;
2. confirmar em fonte primária a data objetiva do evento de VSLH11;
3. confirmar início, fim e recuperação do estresse de MCCI11;
4. confirmar início, fim e recuperação do estresse de RBRY11;
5. registrar URLs primárias e datas no JSON da coorte;
6. alterar o status para `ready_for_execution`;
7. alterar `executionAllowed` para `true` em commit separado e auditável;
8. manter todos os casos com `dataExtractionStarted: false` até essa liberação.

## Ações proibidas

- trocar um fundo depois de observar o resultado do motor;
- alterar limites, pesos ou lógica do ruleset `v0.1.0`;
- redefinir a bomba depois do backtest;
- usar documento posterior à data simulada;
- converter ausência de informação em zero;
- iniciar a extração antes da verificação dos eventos.

## Próxima entrega

A próxima entrega não executará o motor. Ela preencherá somente as datas e fontes primárias dos quatro casos que exigem evento ou janela de estresse. Depois disso, haverá uma revisão independente do registro antes da liberação do backtest.
