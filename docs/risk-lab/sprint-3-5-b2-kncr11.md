# Sprint 3.5-B2 — caso determinístico KNCR11

**Status técnico local:** evidência recomposta, regra geral implementada e testes locais aprovados; integração remota depende dos gates da PR.

## Escopo

Esta fase processa exclusivamente o KNCR11, caso `healthy_control` da coorte externa. Não executa backtest, não altera Produção operacional, não integra Relatório Premium, não envia notificações e não inicia KNSC11, MCCI11 ou RBRY11.

## Fontes imutáveis

Foram utilizados dois artefatos originais do GitHub Actions, conferidos por SHA-256:

| Uso | Run | Artifact | SHA-256 |
|---|---:|---:|---|
| checkpoint principal | `29892173774` | `8519627249` | `13925125a3e69f8dddae8416ae653105c0d9ee897765267c66586f2084e00a00` |
| diagnóstico histórico | `29881954620` | `8515476365` | `8ed76121aa14086cba740ad921cdcef925e44bd274cb86ca42bc14bba1ee9d0e` |

## Estado inicial

- documentos descobertos: **52**;
- documentos concluídos no checkpoint principal: **51**;
- observações no checkpoint principal: **47**;
- pendência: documento `453528`;
- falha registrada: `Período de referência FNET posterior à informação: Abril 2023`;
- documento `453528` processado com sucesso no artefato diagnóstico;
- quatro documentos `KNCR14` comprovados no diagnóstico: `310584`, `321258`, `332122` e `346629`.

## Regra temporal geral

O documento `453528` não foi aceito por exceção de ticker. A reconciliação exige simultaneamente:

1. falha não retryable com a mensagem estruturada `Período de referência FNET posterior à informação: <mês> <ano>`;
2. mês e ano da mensagem iguais à competência da observação oficial recuperada;
3. `informationDate` igual ao último dia do mês imediatamente anterior à competência;
4. ticker, documento, janela, valor, datas, URLs, hashes e protocolo oficiais válidos;
5. observação proveniente de artefato imutável com digest SHA-256 registrado.

Para o caso real:

- período nominal da falha: **Abril 2023**;
- competência oficial: `2023-04`;
- data de informação: `2023-03-31`;
- data-base: `2023-04-28`;
- pagamento: `2023-05-12`;
- valor: **R$ 1,00 por cota**;
- classificação: `recovered_reference_period_metadata_drift`.

A implementação falha fechado se o mês nominal divergir, se a data não for o último dia do mês anterior, se a evidência não pertencer à identidade ou se qualquer campo de proveniência estiver inválido.

## Resultado

- documentos classificados: **52/52**;
- pendências: **0**;
- conflitos: **0**;
- observações brutas após reconciliação: **48**;
- competências mensais selecionadas: **48**;
- período: janeiro de 2022 a dezembro de 2025;
- lacunas: **0**;
- maior sequência contínua: **48 meses**;
- reapresentações: **0**.

## Classes secundárias

Os quatro documentos `KNCR14` foram classificados pela regra geral de família, que exige:

- ticker diferente da identidade principal;
- mesma raiz de quatro letras;
- falha não retryable explicitando o ticker secundário;
- evidência oficial e digest do artefato.

Não existe lista especial para KNCR11 no reconciliador.

## Artefatos finais

- manifesto: `docs/production-evidence/risk-lab/kncr11-phase-b2-manifest.json`;
- índice auditável: `docs/production-evidence/risk-lab/kncr11-phase-b2/index.json`;
- observações anuais: `observations-2022.json` a `observations-2025.json`;
- reconciliador geral: `src/lib/risk-lab/FrozenDividendCheckpointReconciler.ts`;
- teste sintético: `tests/risk-lab-frozen-dividend-checkpoint-reconciler.test.ts`;
- teste integral: `tests/risk-lab-kncr11-evidence.test.mjs`.

## Determinismo

Duas execuções independentes sobre a mesma entrada produziram os mesmos hashes:

- checkpoint principal: `3138b67b82e4aaf7248401c208bf97a916b39fe6c7bbe7c52503664b63b182fb`;
- checkpoint reconciliado: `c6d8b22e9bec7171bcff54ffdb0413c95cdd4ea6d2f20077962c8e1e02e2b025`;
- reconciliação: `49aec230744c4045c573a0242431da4034691af8b862617f3e0ab9e5b55abe6c`;
- caso: `d9245d60378c0eebc53a541368b01a64cd7d242761f7d0e6b01f52d344130987`;
- auditoria: `f804361e9bccd57cdca06113672c3a8e4f288c3f4d40d1da8eb237422ff31031`;
- observações combinadas: `fd7e47d03fbea224b1a0e4d0dff0629c20d59fa6fced2c8348c2aacbf417d09f`;
- índice de evidência: `c11de46d43de21e98a3eb6986a8fb5c0692465672c412b3329f20d86a9bfd1bb`.

## Testes locais executados

O teste integral da evidência real aprovou seis cenários:

- recomposição dos quatro arquivos anuais e 48 competências;
- hashes do caso, auditoria, reconciliação e índice;
- duas execuções idênticas;
- recuperação temporal fechada do documento `453528`;
- quatro classes secundárias `KNCR14`;
- ausência de conflitos, workflow próprio, hardcode de ticker e efeitos de produto.

O teste sintético do reconciliador aprovou nove cenários, incluindo:

- falha transitória;
- regra temporal válida;
- divergência entre mês nominal e competência;
- data de informação diferente do último dia do mês anterior;
- identidade incorreta;
- competência fora da janela;
- classe secundária de outra família;
- cobertura incompleta das pendências.

## Critérios para conclusão formal

A fase somente pode ser encerrada após:

- código e evidência em PR própria;
- Risk Lab integral verde;
- gates DEVA11, VSLH11 e KNCR11 verdes;
- governança, Handoff, typecheck e regressão da Fase 2 verdes;
- Preview Vercel saudável;
- zero review threads pendentes;
- merge do SHA final em `main`;
- auditoria pós-merge dos arquivos e hashes;
- atualização do Handoff em PR separada;
- encerramento da issue `#114`.
