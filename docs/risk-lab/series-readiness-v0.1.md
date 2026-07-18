# Prontidão da série mensal verificada — Risk Lab v0.1

## Objetivo

Mostrar, para MCCI11 e RBRY11, se os avisos de rendimentos aprovados já formam uma sequência documental mínima para alimentar o detector de estresse.

Este componente mede cobertura. Ele não executa o detector, não produz alertas e não libera o backtest externo.

## Critério técnico

A série é marcada como `readyForStressDetection` quando existe pelo menos uma sequência de nove competências mensais consecutivas e aprovadas.

Os nove meses correspondem ao mínimo necessário para:

- seis meses de referência;
- três meses da primeira janela possível de estresse.

Isso não garante que exista estresse nem recuperação. Apenas indica que o detector já poderia receber uma entrada mínima contínua.

## Indicadores exibidos

- quantidade total de observações aprovadas;
- primeira e última competência aprovadas;
- competências ausentes entre as duas extremidades;
- maior sequência mensal contínua;
- quantidade mínima exigida;
- status de prontidão;
- confirmação explícita de que o detector não foi executado.

## Regras de integridade

- meses ausentes permanecem ausentes;
- observações duplicadas para a mesma competência são rejeitadas;
- não é permitido misturar tickers;
- nove observações dispersas não equivalem a nove meses consecutivos;
- a maior sequência é calculada sem preencher lacunas;
- o componente não importa nem chama `DividendStressWindowEngine`.

## Interpretação correta

### Coleta incompleta

Ainda não há nove competências consecutivas aprovadas.

### Série suficiente

Há uma sequência mínima de nove meses verificados. Isso não significa:

- estresse detectado;
- recuperação detectada;
- alerta gerado;
- fundo aprovado ou reprovado;
- backtest executado.

## Próxima etapa após a prontidão

Quando a série real estiver documentalmente completa, a execução do detector deverá ocorrer em ação administrativa separada, com registro de versão, hash da série, resultado imutável e confirmação de que a coorte ainda está bloqueada para conclusões finais.
