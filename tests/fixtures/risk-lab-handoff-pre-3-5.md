# Dados FII — Documento Canônico de Handoff

**Versão:** 6.2.0
**Commit auditado em Produção:** `e9a5d6ec263c0aa87961133a361891f60175dba4`
**Branch desta atualização:** `automation/risk-lab-3-4-release-0072ecf340e6`
**PR desta atualização:** #59 — `chore: formaliza conclusão da Sprint 3.4`

| Sprint corrente canônica: **3.5 — Coorte externa e backtest sem informação futura**. | Sprint 3.4 como sprint corrente. | A Sprint 3.4 foi homologada em Produção com evidência auditável, mantendo o Risk Lab isolado do Premium e das notificações. |

- A Sprint 3.4 do Risk Lab foi concluída em Produção com 11/11 checks, 6/6 casos obrigatórios e zero blockers; evidência `deb0f79597c2fbfb87214c6d05df37cbe782e084e4a7289a487042c3582a567f`. O Risk Lab continua isolado do Premium e das notificações; a coorte externa permanece bloqueada até verificação primária.

| Fase 3 — Risk Lab | Sim, até 3.4 | Sim | Sim (`e9a5d6e`, Vercel verde) | Smoke 3.4: 11/11 checks e 6/6 casos; coorte externa pendente | Em andamento |

**Em andamento.** As Sprints 3.0 a 3.4 possuem código, testes e homologação de Produção. A Sprint 3.5 continua bloqueada até a verificação primária da coorte externa.

## 3. Sprint atual

### Sprint 3.5 — Coorte externa e backtest sem informação futura

**Objetivo:** verificar a coorte pré-registrada em fontes primárias e executar o backtest sem informação futura, preservando integralmente o ruleset `v0.1.0`.

**Trabalho obrigatório:**

1. confirmar `knownAt`, URL, trecho, página, hash e versão por observação;
2. executar `DEVA11`, `VSLH11`, `KNCR11`, `KNSC11`, `MCCI11` e `RBRY11` sem look-ahead;
3. medir antecedência, falsos positivos, falsos negativos, inconclusão e cobertura;
4. manter `executionAllowed=false` enquanto faltar verificação primária;
5. versionar a evidência e preservar o ruleset congelado.

**Critério de aceite:** nenhuma conclusão final sustentada apenas por fonte secundária; controles saudáveis sem vermelho injustificado; ambiguidades como inconclusivas; métricas e evidências persistidas no Git.

## 4. Ordem oficial das próximas sprints

1. **Sprint 3.5 — Coorte externa e backtest sem informação futura.**
2. **Sprint 3.6 — Métricas, calibração e gate formal.**
3. **Sprint 3.7 — Risk Lab read-only no Relatório Premium e Prompt Premium v3.**
4. **Sprint 3.8 — Impacto na carteira e alertas opt-in.**
5. **Sprint 4.1 — Radar: acompanhar fundo fora da carteira.**
6. **Sprint 4.2 — Radar: eventos, tese e relatório pré-compra.**
7. **Sprint 4.3 — Planos, preferências, canais e monetização.**
8. **Sprint 5.1 — Carteira histórica verdadeira e ledger de eventos.**
9. **Sprint 5.2 — Motor de risco, exposição e atribuição acionável.**
10. **Sprint 5.3 — Inteligência sobre comunicados oficiais.**
11. **Sprint 5.4 — Screener quantitativo, pares e fair value por tipo de FII.**
12. **Sprint 5.5 — Benchmark, retorno total, calendário, centro fiscal e simuladores.**

## 5. Escopo e critérios de aceite de cada sprint

### Sprint 3.5 — Coorte externa

**Escopo:** verificar em fonte primária e executar, sem alterar o ruleset `v0.1.0`, `DEVA11`, `VSLH11`, `KNCR11`, `KNSC11`, `MCCI11` e `RBRY11`.

**Aceite:** `knownAt`, URL, trecho, página, hash e versão por observação; nenhum look-ahead; métricas de primeiro amarelo/laranja/vermelho, antecedência, falso positivo, falso negativo, inconclusão e cobertura; controles saudáveis sem vermelho injustificado. O teste atual mantém `executionAllowed=false` até a verificação primária.
