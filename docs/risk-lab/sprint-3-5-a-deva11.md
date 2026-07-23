# Sprint 3.5-A — caso determinístico DEVA11

**Status técnico:** implementação, evidência e gates remotos concluídos na branch `agent/sprint-3-5-a-deva11-final`; integração e auditoria da `main` são os únicos gates restantes.

## Escopo

Esta fase processa exclusivamente o DEVA11. Não executa backtest, não acessa Produção, não integra Relatório Premium, não envia notificações e não inicia os outros cinco fundos da coorte.

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
- observações anuais: `observations-2021.json` a `observations-2026.json` no mesmo diretório;
- finalizador geral: `src/lib/risk-lab/SingleFrozenDividendCaseFinalizer.ts`;
- execução CLI: `scripts/finalize-frozen-dividend-case.ts`.

A série foi dividida por ano para permanecer legível, transportável e auditável no Git. O índice registra a contagem e o hash de cada ano e recompõe a série completa de 65 observações.

## Determinismo

Duas execuções independentes sobre a mesma entrada produziram os mesmos valores:

- hash do checkpoint de entrada: `6b923ceeff2a0a9ddcd27d72b4d8125d3b2cc6aca6109c57531c3efed36d4a89`;
- hash do caso final: `fca3de0e38755c8213d7e37d5112b51733c794dd29a2f2f7cb5be82980313aa2`;
- hash da auditoria: `157e807f7a61c4d9bb34eedc324e761c8a19c25ac93505023606f6ffcd2159af`;
- hash combinado das 65 observações: `6788292746eeb5321d36cd198c75b5810c3797cead357341cc04df9254fee20c`;
- hash do índice de evidência: `62a19d9b20b57b49489d7ab51ed85d72505625ca68f47762a5045fc3c650993b`.

## Testes

### Finalizador isolado

`tests/risk-lab-deva11-phase-a.test.ts` valida:

- resultado reproduzível;
- regra de competência fora da janela;
- exclusão de classe secundária;
- falha fechada para documento primário válido ainda não processado;
- falha fechada para evidência ausente ou insuficiente;
- ausência de regra codificada por ticker.

### Evidência completa

`tests/risk-lab-deva11-evidence.test.mjs` valida:

- leitura dos seis arquivos anuais e 65 observações;
- campos obrigatórios e proveniência oficial;
- ordenação e unicidade das competências;
- hashes anuais e hash combinado;
- recomposição e hash do caso;
- hash da auditoria e do índice;
- duas execuções idênticas;
- classificações dos documentos `137843` e `349282`;
- reconciliação das duas reapresentações;
- ausência do workflow temporário e de efeitos de produto.

Resultados no GitHub Actions:

- suíte integral Risk Lab: **aprovada**;
- gate determinístico DEVA11: **aprovado**;
- governança do GitHub Actions: **aprovada**;
- typecheck: **aprovado**;
- regressão da Fase 2: **aprovada**.

Nenhum workflow exclusivo do DEVA11 foi mantido.

## Critérios da fase

| Critério | Resultado |
|---|---|
| zero pendências dentro da janela | atendido |
| zero conflitos não explicados | atendido |
| competência, valor, data-base e pagamento rastreáveis | atendido |
| duas execuções com o mesmo hash | atendido |
| nenhuma regra codificada por ticker | atendido |
| nenhum backtest ou integração de produto | atendido |
| testes automatizados locais e remotos | atendido |
| integração e auditoria do SHA final em `main` | pendente |

## Decisão

A implementação da Fase 3.5-A está aprovada para integração. A fase será marcada como formalmente concluída e a issue #99 será encerrada somente depois do merge da PR final e da auditoria do SHA resultante em `main`.

A Fase 3.5-B1 — VSLH11 não começa automaticamente.
