# Sprint 3.7 — Risk Lab read-only no Premium + Prompt Premium v3

## Estado

Em implementação na issue #133. Esta documentação não representa conclusão antes de testes, Preview, merge, auditoria do `main` e atualização do Handoff.

## Objetivo

Consumir o ruleset homologado `0.2.0` no Relatório Premium exclusivamente como leitura informativa e determinística, antes da interpretação da IA.

## Regras invariantes

- feature flag própria e desligada por padrão;
- nenhuma notificação ou efeito externo;
- nenhuma recomendação automática de compra, venda ou manutenção;
- a IA não altera disposição, alerta, proveniência ou limitação do Risk Lab;
- fundos fora da coorte homologada recebem fallback explícito;
- MCCI11 permanece `inconclusive_unscored`;
- ausência de sinal não equivale a ausência de risco;
- recuperação informativa não equivale a oportunidade de compra;
- autorização Premium e auditoria permanecem no servidor;
- rollback por feature flag e reversão do commit.

## Entradas congeladas

- base canônica inicial: `902ea56dfa4a440c8b331d03a322028873ca9c59`;
- ruleset: `0.2.0`;
- dataset: `risk-lab-credit-oos-phase-c-v1`;
- dataset SHA-256: `f18f61b7ddb5cc63955fa9791c6e5e3e43552134aaa28a9dd622a96ee587fcae`;
- relatório de calibração SHA-256: `22b84180531f3687c9b3ebeb691020e75e6cb608777276061997b734090d701a`;
- especificação Modo Gestor v2 fornecida pelo usuário: SHA-256 `420eb6c2ac23ab0b0daa331ffd54cdb7215f688f38c5b628c57eabccbcc25a59`.

## Critérios de encerramento

A Sprint só pode ser encerrada após CI completa no SHA final, Preview real, zero review threads, merge exato, auditoria pós-merge, Handoff atualizado em PR separada e issue #133 fechada com evidências.

## Implementação materializada

- registro read-only: `src/lib/risk-lab/risk-lab-premium-readonly-v1.json`;
- SHA-256 do registro: `982b1c9911610eb58ad6e0af5ea6ed801063c2b9f80783a5ee9c0b45b6de9ac9`;
- adaptador: `RiskLabPremiumReadModel`;
- Prompt Premium: `premium-fund-analysis-v3`;
- versão do relatório: `2.0.0`;
- auditoria: ação `premium-read`;
- feature flag: `ENABLE_RISK_LAB_PREMIUM_READONLY`, consumida com padrão `false`;
- testes: unidade, adulteração, Prompt v3, arquitetura e integração do relatório.

O manifesto permanece como `implemented_pending_ci_and_deployment` até a validação no SHA final.
