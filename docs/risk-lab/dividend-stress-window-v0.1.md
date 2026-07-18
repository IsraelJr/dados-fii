# Janela de estresse reversível em rendimentos — Risk Lab v0.1

## Objetivo

Identificar, de forma determinística e auditável, uma janela candidata de estresse e recuperação em rendimentos mensais. Este componente não gera alerta amarelo, laranja ou vermelho e não altera o Relatório Premium.

## Entrada aceita

Cada rendimento mensal precisa possuir:

- ticker;
- competência no formato `AAAA-MM`;
- valor por cota;
- data real do anúncio público;
- documento primário oficial;
- URL do FNET ou da gestora autorizada;
- trecho verificado;
- revisão manual, responsável e data da revisão.

Os campos legados `earningsAAAA`, agregadores, páginas de resumo e séries sem documento não são elegíveis para validação fora da amostra.

## Cálculo congelado da coorte

### Referência

- seis competências mensais consecutivas;
- referência igual à mediana dos seis rendimentos.

### Estresse

- três competências consecutivas imediatamente posteriores;
- média dos três meses menor ou igual a 80% da referência;
- equivale a queda mínima de 20%;
- a data de detecção é a data pública mais tardia entre os três anúncios, nunca a competência contábil.

### Recuperação

- primeira janela posterior de três competências consecutivas;
- média igual ou superior a 90% da referência;
- toda a trajetória entre referência, estresse e recuperação precisa ser mensalmente contínua;
- mês ausente permanece ausente e impede confirmar a recuperação.

### Bloqueio por evento de crédito

Mesmo havendo recuperação do rendimento, a classificação reversível é bloqueada quando existe evento material de crédito, verificado em fonte primária, conhecido até a data da recuperação.

Na versão atual, o bloqueio é conservador: qualquer evento material não resolvido fornecido ao motor impede classificar a janela como reversível. Uma futura metodologia de resolução de eventos deverá possuir versão própria e não pode alterar silenciosamente o comportamento desta rodada.

## Saídas

- `no_qualifying_stress`;
- `stress_without_recovery`;
- `recovery_blocked_by_material_credit_event`;
- `reversible_stress_confirmed`.

A saída apenas descreve a janela. Ela não representa recomendação, score de gestão ou conclusão sobre a qualidade do fundo.

## Uso em MCCI11 e RBRY11

O motor só poderá ser executado com dados reais quando os avisos oficiais de rendimentos tiverem sido coletados e revisados. Até lá:

- nenhuma data de estresse está registrada;
- nenhuma data de recuperação está registrada;
- a coorte permanece bloqueada;
- nenhum backtest externo foi executado.
