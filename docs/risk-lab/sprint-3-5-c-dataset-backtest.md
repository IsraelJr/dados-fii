# Sprint 3.5-C — Dataset imutável e backtest sem look-ahead

**Status:** `completed_requires_calibration`  
**Ruleset avaliado:** v0.1.0, mantido sem calibração  
**Dataset:** `risk-lab-credit-oos-phase-c-v1` v1.0.0  
**Observações:** 318  
**Cobertura conclusiva:** 83,33%

## Resultado executivo

A metodologia da 3.5-C passou sem bloqueadores: os seis casos foram recompostos exclusivamente das evidências imutáveis versionadas no Git, os hashes individuais e consolidados conferiram e nenhum ponto do backtest utilizou informação posterior à data simulada.

O desempenho, porém, exige calibração na Sprint 3.6. O ruleset v0.1.0 produziu um falso positivo no KNSC11 e o MCCI11 permaneceu inconclusivo porque sua série congelada não confirmou a janela pré-registrada de estresse reversível. Nenhuma regra foi alterada para melhorar artificialmente o resultado.

## Resultado por fundo

| Fundo | Papel pré-registrado | Resultado | Primeiro sinal | Referência primária |
|---|---|---|---|---|
| DEVA11 | severe_deterioration | verdadeiro positivo | 2022-10-07T17:35:00-03:00 | 2023-03-06T00:00:00-03:00 |
| VSLH11 | severe_deterioration | verdadeiro positivo | 2022-01-07T17:44:00-03:00 | 2023-03-06T00:00:00-03:00 |
| KNCR11 | healthy_control | verdadeiro negativo | — | inconclusiva |
| KNSC11 | healthy_control | falso positivo | 2022-09-30T17:49:00-03:00 | inconclusiva |
| MCCI11 | reversible_stress | inconclusivo | — | inconclusiva |
| RBRY11 | reversible_stress | verdadeiro positivo | 2022-12-09T17:34:00-03:00 | 2023-03-09T18:34:00-03:00 |

## Métricas

- casos totais: 6;
- conclusivos: 5;
- verdadeiros positivos: 3;
- verdadeiros negativos: 1;
- falsos positivos: 1;
- falsos negativos: 0;
- inconclusivos: 1;
- cobertura: 83,33%;
- lead time médio: 220,52 dias.

## Evidência primária

- DEVA11: fato relevante oficial `424937`, de 06/03/2023, com não pagamento;
- VSLH11: fato relevante oficial `424942`, de 06/03/2023, com não pagamento;
- KNCR11 e KNSC11: cobertura anual dos catálogos CVM e extração dos fatos relevantes críticos sem evento material reconhecido;
- MCCI11 e RBRY11: cobertura anual, documentos críticos extraídos e ausência de evento material incompatível com o rótulo;
- RBRY11 confirmou a janela de estresse e recuperação; MCCI11 não a confirmou e foi mantido inconclusivo.

## Hashes

- identidade da coorte: `97a3fc3bea0adde463ee3a8d06a9e40a6e90dc0f22303bad85e3dd488bfb7726`;
- dataset consolidado: `f18f61b7ddb5cc63955fa9791c6e5e3e43552134aaa28a9dd622a96ee587fcae`;
- relatório do backtest: `4b0ced4e8ef662a23317e850353209b72804745be3afa7dc128e05356b2e7c6f`;
- índice da evidência: `edb90face1dddff390dcbf260cf60dc0bb3c053f20ea4ea5a17a0788b98c308e`.

## Decisão de produto

A 3.5-C não integra o Risk Lab ao Relatório Premium, não envia notificações e não homologa o ruleset. A próxima unidade é a Sprint 3.6 — calibração e homologação, que deverá tratar o falso positivo do KNSC11 e a inconclusividade do MCCI11 sem vazamento de informação futura.
