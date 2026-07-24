# Sprint 3.5-B1 — caso determinístico VSLH11

**Status técnico:** implementação e evidência preparadas na branch `agent/sprint-3-5-b1-vslh11`; integração, CI remota, deployment aplicável e auditoria da `main` permanecem como gates obrigatórios.

## Escopo

Esta fase processa exclusivamente o VSLH11. Não executa backtest, não recalibra o ruleset, não acessa Produção operacional, não integra Relatório Premium, não envia notificações e não inicia KNCR11, KNSC11, MCCI11 ou RBRY11.

## Fontes imutáveis

Foram usados dois artefatos originais do GitHub Actions, baixados novamente e conferidos por SHA-256:

| Uso | Run | Artifact | SHA-256 |
|---|---:|---:|---|
| checkpoint principal | `29892173774` | `8519627249` | `13925125a3e69f8dddae8416ae653105c0d9ee897765267c66586f2084e00a00` |
| diagnóstico e recuperação | `29881954620` | `8515476365` | `8ed76121aa14086cba740ad921cdcef925e44bd274cb86ca42bc14bba1ee9d0e` |

Os hashes dos ZIPs baixados coincidiram com os digests registrados originalmente. Nenhum documento foi reescrito, inferido ou aprovado manualmente.

## Estado inicial

O checkpoint principal continha:

- documentos descobertos: **79**;
- documentos concluídos: **77**;
- observações válidas: **64**;
- pendências transitórias: `312220` e `1055396`;
- mensagem das duas falhas: `This operation was aborted`;
- treze documentos de classes secundárias já marcados como concluídos sem observação econômica.

O artefato diagnóstico preservava as observações oficiais dos dois documentos abortados e as mensagens explícitas das treze classes secundárias.

## Reconciliação geral

Foi criado `FrozenDividendCheckpointReconciler`, sem regra por ticker. Ele:

1. exige que as recuperações cubram exatamente todas as pendências;
2. aceita recuperação apenas quando a falha original é transitória e `retryable=true`;
3. valida identidade, competência, janela temporal, valor, URLs, hashes, protocolo e proveniência da observação recuperada;
4. exige evidência exata para todos os documentos concluídos sem observação;
5. classifica classe secundária somente quando o ticker difere do principal, mas pertence à mesma família;
6. falha fechado para outra família, observação divergente, digest inválido, evidência ausente ou competência fora da janela;
7. gera hashes do checkpoint original, checkpoint reconciliado e reconciliação.

A regra é reutilizável nos fundos seguintes da coorte.

## Recuperação dos dois abortos

| Documento | Competência | Valor por cota | Evidência |
|---:|---|---:|---|
| `312220` | `2022-05` | `0,120` | observação oficial preservada no artifact `8515476365` |
| `1055396` | `2025-11` | `0,029` | observação oficial preservada no artifact `8515476365` |

As observações mantêm data da informação, data-base, pagamento, URL oficial, protocolo, versão e hashes da fonte.

## Classes secundárias

Treze documentos foram comprovados como classes secundárias da mesma família:

- `VSLH13`: `152889`, `152890`, `182993`, `191954`, `192027`, `232145`, `253930`;
- `VSLH14`: `152900`, `191955`, `192028`, `232142`, `253933`;
- `VSLH15`: `152893`.

Nenhum deles alimenta a série econômica de `VSLH11`. A exclusão decorre da identidade oficial da classe, não de uma lista especial codificada para o fundo.

## Resultado

- documentos descobertos/classificados: **79/79**;
- documentos pendentes: **0**;
- conflitos não explicados: **0**;
- observações brutas após reconciliação: **66**;
- competências mensais selecionadas: **64**;
- período selecionado: fevereiro de 2021 a junho de 2026;
- única competência sem observação: **2023-12**;
- maior sequência contínua: **34 meses**.

A ausência de dezembro de 2023 é uma lacuna documental explícita. Não foi preenchida por estimativa, zero inventado ou informação futura.

## Seleção de reapresentações

Duas observações antigas foram substituídas por versões oficiais posteriores:

| Excluído | Selecionado | Competência | Regra |
|---:|---:|---|---|
| `152886` v1 | `153493` v2 | `2021-02` | maior versão do mesmo evento oficial |
| `191952` v1 | `192026` v2 | `2021-06` | maior versão na mesma competência |

As duas decisões são determinísticas e não produzem conflito econômico oculto.

## Artefatos finais

- manifesto: `docs/production-evidence/risk-lab/vslh11-phase-b1-manifest.json`;
- índice: `docs/production-evidence/risk-lab/vslh11-phase-b1/index.json`;
- observações anuais: `observations-2021.json` a `observations-2026.json`;
- reconciliador geral: `src/lib/risk-lab/FrozenDividendCheckpointReconciler.ts`;
- finalizador geral preservado: `src/lib/risk-lab/SingleFrozenDividendCaseFinalizer.ts`.

## Determinismo

Duas execuções independentes sobre a mesma entrada produziram os mesmos valores:

- hash do checkpoint principal: `2de8f866fd4b4400b309090830a282f2bb1ccc97689ce1745a6c0faca251d755`;
- hash do checkpoint reconciliado: `29c18ce11077894d024738513882ca8e7cfe7a09c7e5eeb7659f4552e8c1277f`;
- hash da reconciliação: `b6d944ea86854254cba6bfd22a1a15f388574bb83a4e1b0a546f71718a76eb25`;
- hash do caso: `a24d0185599fa80c2606dfc8a462dfe77bc4fad76a4a86e82dc8dc127768299d`;
- hash da auditoria: `ece06fcc7b4ac7317d80e00747f3be458ec3ff322c5284020ebaead73e23365f`;
- hash combinado das 64 observações: `2551679cf4a16ecb389c474f26c541670db69c7c39f34484a28cc6a61cae85ea`;
- hash do índice: `952c88ec36f930ce83d153bedb07344226cf8d9029d14ada1576514214269092`.

## Testes

### Reconciliador geral

`tests/risk-lab-frozen-dividend-checkpoint-reconciler.test.ts` cobre:

- recuperação transitória reproduzível;
- cobertura exata das pendências;
- rejeição de falha não transitória;
- rejeição de observação de outra identidade;
- rejeição de classe de outra família;
- rejeição de competência fora da janela.

### Evidência real

`tests/risk-lab-vslh11-evidence.test.mjs` cobre:

- seis arquivos anuais e 64 competências;
- campos obrigatórios e proveniência oficial;
- hashes anuais, combinado, caso, auditoria, reconciliação e índice;
- duas execuções idênticas;
- recuperação dos documentos `312220` e `1055396`;
- classificação dos treze documentos secundários;
- seleção das duas reapresentações;
- ausência de workflow exclusivo e de efeitos de produto.

## Critérios da fase

| Critério | Estado antes da integração |
|---|---|
| 79/79 documentos classificados | atendido pela evidência gerada |
| zero pendências | atendido |
| zero conflitos não explicados | atendido |
| regra reutilizável sem ticker hardcoded | atendido |
| duas execuções com hashes idênticos | atendido |
| testes sintéticos e reais | implementados; CI pendente |
| Preview Vercel | pendente |
| integração e auditoria da `main` | pendente |
| atualização do Handoff | bloqueada até auditoria pós-merge |

## Regra de parada

A fase termina no VSLH11. O próximo fundo será o KNCR11 na Fase 3.5-B2, somente depois do merge, auditoria da `main`, atualização do Handoff e encerramento da issue desta fase.
