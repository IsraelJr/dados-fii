# Sprint 3.5-A — caso determinístico DEVA11

**Status técnico:** implementação e evidência concluídas na branch `agent/sprint-3-5-a-deva11-clean`; integração dependente da PR de arquitetura do GitHub Actions e dos gates de CI.

## Escopo

Esta fase processa exclusivamente o DEVA11. Não executa backtest, não acessa Vercel ou Produção, não integra Relatório Premium, não envia notificações e não inicia os outros cinco fundos da coorte.

## Fontes imutáveis

Foram usados dois artefatos originais do GitHub Actions, baixados novamente e conferidos por SHA-256:

| Uso | Run | Artifact | SHA-256 |
|---|---:|---:|---|
| checkpoint principal | `29892173774` | `8519627249` | `13925125a3e69f8dddae8416ae653105c0d9ee897765267c66586f2084e00a00` |
| diagnóstico dos dois pendentes | `29881954620` | `8515476365` | `8ed76121aa14086cba740ad921cdcef925e44bd274cb86ca42bc14bba1ee9d0e` |

Os arquivos baixados novamente coincidiram byte a byte com as cópias preservadas na investigação anterior.

## Resultado

- documentos descobertos: **85**;
- documentos classificados: **85**;
- documentos pendentes: **0**;
- conflitos não explicados: **0**;
- observações brutas no checkpoint: **67**;
- competências mensais selecionadas: **65**;
- período: janeiro de 2021 a junho de 2026;
- única competência sem observação: **2024-07**;
- maior sequência contínua: **42 meses**.

A ausência de julho de 2024 é uma lacuna documental explícita, não um documento pendente ou conflito escondido.

## Classificação dos dois documentos pendentes

### Documento 137843

- ticker identificado: `DEVA11`;
- período oficial bruto: `12-20`;
- competência normalizada: `2020-12`;
- classificação: `outside_cohort_window`;
- motivo: anterior ao início da coorte em `2021-01-01`.

A regra é temporal e reutilizável; não existe exceção codificada para DEVA11.

### Documento 349282

- ticker oficial identificado: `DEVA13`;
- classificação: `secondary_share_class`;
- motivo: classe secundária da mesma família, diferente da identidade principal `DEVA11`.

A regra compara identidade e raiz da classe; não existe lista especial por ticker.

## Reconciliação de 67 para 65 observações

Duas observações antigas foram substituídas por versões posteriores do mesmo evento oficial:

| Excluído | Selecionado | Competência final | Regra |
|---:|---:|---|---|
| `191928` v1 | `191981` v2 | `2021-06` | mesma competência, maior versão de protocolo |
| `299179` v1 | `299296` v2 | `2022-04` | reapresentação do mesmo evento oficial, maior versão |

Os valores permaneceram iguais em cada par. A seleção é determinística e não cria conflito econômico oculto.

## Artefatos finais

- manifesto: `docs/production-evidence/risk-lab/deva11-phase-a-manifest.json`;
- índice auditável: `docs/production-evidence/risk-lab/deva11-phase-a/index.json`;
- série mensal compactada: `docs/production-evidence/risk-lab/deva11-phase-a/observations.json.gz.base64`;
- finalizador geral: `src/lib/risk-lab/SingleFrozenDividendCaseFinalizer.ts`;
- execução CLI: `scripts/finalize-frozen-dividend-case.ts`.

O artefato de observações usa JSON comprimido com gzip e codificado em base64. Seu SHA-256 sobre os bytes gzip é:

`e3c28ee35d357e74caeded55b6f4de0787489558a3f66f28c32c381bae2a5a43`

## Determinismo

Duas execuções independentes sobre a mesma entrada produziram os mesmos valores:

- hash do checkpoint de entrada: `6b923ceeff2a0a9ddcd27d72b4d8125d3b2cc6aca6109c57531c3efed36d4a89`;
- hash do caso final: `fca3de0e38755c8213d7e37d5112b51733c794dd29a2f2f7cb5be82980313aa2`;
- hash da auditoria: `157e807f7a61c4d9bb34eedc324e761c8a19c25ac93505023606f6ffcd2159af`;
- hash do índice de evidência: `b6f39bea9df860d0ddf12103de9f59abbb65e1370ed2c832cec6f9601c0a1f87`.

## Testes

### Finalizador isolado

`tests/risk-lab-deva11-phase-a.test.ts` valida:

- resultado reproduzível;
- regra de competência fora da janela;
- exclusão de classe secundária;
- falha fechada para documento primário válido ainda não processado;
- ausência de regra codificada por ticker.

### Evidência completa

`tests/risk-lab-deva11-evidence.test.mjs` valida:

- descompactação e 65 observações;
- campos obrigatórios e proveniência oficial;
- ordenação e unicidade das competências;
- hashes anuais;
- recomposição e hash do caso;
- hash da auditoria e do índice;
- duas execuções idênticas;
- classificações dos documentos `137843` e `349282`;
- reconciliação das duas reapresentações;
- ausência do workflow temporário e de efeitos de produto.

Execução local do teste de evidência: **6/6 aprovados**.

Os dois testes foram adicionados como gate explícito da CI especializada `Risk Lab CI`. Nenhum workflow exclusivo do DEVA11 foi mantido.

## Critérios da fase

| Critério | Resultado |
|---|---|
| zero pendências dentro da janela | atendido |
| zero conflitos não explicados | atendido |
| competência, valor, data-base e pagamento rastreáveis | atendido |
| duas execuções com o mesmo hash | atendido |
| nenhum código por ticker | atendido |
| nenhum backtest ou integração de produto | atendido |
| testes automatizados | atendido localmente; CI remota pendente do executor do GitHub |

## Decisão

A implementação da Fase 3.5-A está pronta para integração. A fase só deve ser marcada como formalmente concluída e a issue #99 encerrada após:

1. a PR de otimização do GitHub Actions ser integrada;
2. a PR empilhada desta fase executar seus gates com steps reais;
3. os checks ficarem verdes;
4. o merge ser concluído sem alteração dos hashes acima.

A Fase 3.5-B1 — VSLH11 não deve começar automaticamente antes desse gate.
