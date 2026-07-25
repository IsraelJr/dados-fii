# Sprint 3.7 — Risk Lab read-only no Premium + Prompt Premium v3

## Estado

Implementação validada e pronta para merge na issue #133. A conclusão formal permanece bloqueada até merge, auditoria do `main`, atualização do Handoff em PR separada e encerramento da issue.

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

## Implementação validada

- registro read-only: `src/lib/risk-lab/risk-lab-premium-readonly-v1.json`;
- SHA-256 integral do registro: `982b1c9911610eb58ad6e0af5ea6ed801063c2b9f80783a5ee9c0b45b6de9ac9`;
- adaptador genérico: `RiskLabPremiumReadModel`;
- Prompt Premium: `premium-fund-analysis-v3`;
- Modo Gestor: `premium-manager-mode-v3`;
- versão do relatório: `2.0.0`;
- auditoria: ação `premium-read`;
- feature flag: `ENABLE_RISK_LAB_PREMIUM_READONLY`, consumida com padrão `false`;
- painel com estados traduzidos para português brasileiro;
- fallback explícito para flag desligada, fundo fora da coorte e caso inconclusivo;
- nenhum import de notificações ou mecanismo de efeito externo.

## Resultados preservados

- DEVA11 e VSLH11: risco histórico elevado;
- KNCR11: sem estresse qualificante na janela homologada;
- KNSC11 e RBRY11: recuperação informativa, sem sinal de compra;
- MCCI11: inconclusivo e não pontuado;
- fundos fora da coorte: indisponíveis, sem classificação por semelhança.

## Evidência e validação

- manifesto: `docs/production-evidence/risk-lab/premium-readonly-phase-3-7-manifest.json`;
- hash do manifesto validado por teste autoconsistente;
- 15 testes específicos da Sprint 3.7;
- suíte integral do Risk Lab e gates dos seis fundos;
- dataset 3.5-C e calibração 3.6 preservados;
- regressão integral da Fase 2;
- regressão da política de notificações;
- typecheck e build de produção verdes;
- zero review threads;
- runtime final validado no Preview Vercel Ready do commit `6bc5940b9ee15cbb8f25865f16a1191074425489`;
- alterações posteriores ao Preview restritas a documentação, manifesto e teste, sem mudança de runtime.

## Rollout e rollback

A integração está implantável atrás de feature flag desligada por padrão. Ativar a leitura exige configurar `ENABLE_RISK_LAB_PREMIUM_READONLY=true` no ambiente desejado. O rollback operacional imediato é desligar a flag; o rollback de código é reverter o merge funcional.

Nenhuma notificação é liberada por esta Sprint.

## Critérios de encerramento

A Sprint só pode ser marcada como formalmente concluída após merge exato, auditoria pós-merge do `main`, atualização do Handoff canônico em PR separada e issue #133 fechada com evidências.
