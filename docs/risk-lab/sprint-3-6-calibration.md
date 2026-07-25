# Sprint 3.6 — Calibração e homologação do ruleset

**Status:** `homologated`
**Ruleset de origem:** v0.1.0
**Ruleset homologado:** v0.2.0
**Dataset preservado:** `risk-lab-credit-oos-phase-c-v1` v1.0.0
**Hash do dataset:** `f18f61b7ddb5cc63955fa9791c6e5e3e43552134aaa28a9dd622a96ee587fcae`

## Decisão executiva

O ruleset v0.2.0 foi homologado exclusivamente para uso metodológico offline. A estrutura 6–3–3 e o limiar de estresse de 80% foram preservados. O limiar de recuperação passou de 90% para 89%, com margem mínima de decisão de 0,5 ponto percentual e validação leave-one-verified-case-out.

A mudança não cria uma exceção para KNSC11. O novo contrato separa uma recuperação reversível sem evento material — informação útil, mas sem alerta de risco — de estresse persistente ou recuperação bloqueada por evento material, que permanecem como risco elevado.

## Resultado por fundo

| Fundo | Papel congelado | Estado final | Disposição | Avaliação |
|---|---|---|---|---|
| DEVA11 | severe_deterioration | stress_without_recovery | alerta de risco elevado | correto |
| VSLH11 | severe_deterioration | stress_without_recovery | alerta de risco elevado | correto |
| KNCR11 | healthy_control | no_qualifying_stress | sem sinal | correto |
| KNSC11 | healthy_control | reversible_stress_confirmed | recuperação informativa, sem alerta de risco | correto |
| MCCI11 | reversible_stress | no_qualifying_stress | sem sinal | inconclusivo, fora da otimização |
| RBRY11 | reversible_stress | reversible_stress_confirmed | recuperação informativa, sem alerta de risco | correto |

## Validação fora da amostra

Todos os cinco folds leave-one-verified-case-out selecionaram o mesmo limiar de recuperação de 89% e classificaram corretamente o fundo mantido fora do ajuste:

- DEVA11: threshold 89,00%, holdout correto = sim;
- VSLH11: threshold 89,00%, holdout correto = sim;
- KNCR11: threshold 89,00%, holdout correto = sim;
- KNSC11: threshold 89,00%, holdout correto = sim;
- RBRY11: threshold 89,00%, holdout correto = sim;

## Métricas de homologação

- casos totais: 6;
- casos verificáveis: 5;
- corretos entre verificáveis: 5;
- acurácia nos verificáveis: 100,00%;
- cobertura da verdade-terreno: 83,33%;
- falsos positivos: 0;
- falsos negativos: 0;
- casos inconclusivos: 1.

## Tratamento do MCCI11

O MCCI11 continua com verdade-terreno inconclusiva e não foi usado para escolher parâmetros, calcular acurácia ou melhorar artificialmente o resultado. O caso permanece no relatório como `inconclusive_unscored`, com rastreabilidade integral.

## Segurança metodológica

- dataset e identidade da coorte conferidos pelos hashes da 3.5-C;
- falhas originais da 3.5-C preservadas no histórico;
- nenhum look-ahead nos casos ou folds;
- espaço de busca limitado a 10 candidatos de recuperação;
- nenhum parâmetro escolhido por ticker;
- duas execuções independentes com hashes idênticos;
- Premium e notificações permanecem desabilitados.

## Hashes

- configuração do ruleset: `91bf016c119ebbc929409c28f08a751ec4bcc6cb4f6f344656cfa7ef6818a4ec`;
- espaço de candidatos: `b34f2dddf9eb0b9d2bba4ec4351905bba723178eec7d65d1c8e286cbea5e320d`;
- relatório de calibração: `fd695ecf4cbc759f9953ddcaf15ef14f28ba43a0b3d74098dd5cd1938baa9c81`;
- índice da evidência: `35dd492e433855e50849cba05990bb9c5255be6f209fbcce5d5a9cb832ef0017`.

## Decisão de produto

A homologação metodológica da Sprint 3.6 não integra automaticamente o Risk Lab ao produto. A próxima unidade é a Sprint 3.7 — integração read-only no Relatório Premium e Prompt Premium v3, que exige feature flag, contrato de interpretação, fallback, rollback e testes próprios.
