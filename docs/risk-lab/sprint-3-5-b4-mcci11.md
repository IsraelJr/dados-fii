# Sprint 3.5-B4 — MCCI11

## Estado

Caso determinístico concluído na branch da fase, aguardando CI, merge e auditoria do `main`.

Esta unidade processa somente o MCCI11. RBRY11, composição do dataset final, backtest, calibração, Premium e notificações permanecem fora do escopo.

## Identidade e janela

- ticker: `MCCI11`;
- CNPJ: `23648935000184`;
- papel metodológico: `reversible_stress`;
- janela fechada: `2022-01-01` a `2025-12-31`.

## Fonte imutável

- workflow run: `29881954620`;
- artifact: `8515476365`;
- nome: `risk-lab-frozen-dividend-checkpoint-v3`;
- SHA-256 do ZIP: `8ed76121aa14086cba740ad921cdcef925e44bd274cb86ca42bc14bba1ee9d0e`;
- release commit: `b54bc58276f43695c3f48f2aa8c9f47a2cadac2a`.

O ZIP foi baixado novamente e o hash conferiu com o digest publicado pelo GitHub Actions.

## Estado inicial

- 48 documentos descobertos;
- 47 documentos concluídos;
- 47 observações preservadas no checkpoint;
- uma pendência não transitória: documento `301632`, classificado no FNET como `MCCI13`;
- documento `255155` com competência informada como `2022-12`, embora anúncio, data-base e pagamento pertençam a janeiro de 2022.

## Regra temporal geral

Foi criado `FrozenDividendObservationWindowSanitizer`, sem ticker ou documento hardcoded.

A regra reconhece somente o padrão inequívoco de virada de ano em que:

1. a informação ocorre em janeiro;
2. a competência reportada usa dezembro do mesmo ano da informação, ficando artificialmente no futuro;
3. o mês correto é exatamente o mês calendário anterior à informação;
4. anúncio e data-base coincidem com a data de informação;
5. o pagamento ocorre depois da informação, dentro de uma janela curta;
6. URLs, hashes e metadados de protocolo oficiais são válidos;
7. a competência corrigida fica fora da janela da coorte.

No MCCI11, `2022-12` foi corrigido metodologicamente para `2021-12`, portanto o documento `255155` foi classificado como `outside_cohort_window_year_rollover_metadata_drift` e removido da série da coorte.

O sanitizador falha fechado quando:

- a evidência não cobre exatamente todos os candidatos;
- a observação diverge do checkpoint;
- a correção ainda pertence à janela;
- o padrão temporal é ambíguo;
- digest, identidade, URLs, hashes ou protocolo são inválidos.

## Classe secundária

O documento `301632` foi classificado como `secondary_share_class` pela regra geral que aceita somente ticker diferente da cota principal, mas pertencente à mesma família de quatro letras. O ticker observado foi `MCCI13`.

## Resultado

- documentos classificados: `48/48`;
- observações brutas no checkpoint: `47`;
- observações após sanitização temporal: `46`;
- competências mensais selecionadas: `46`;
- período observado: `2022-01` a `2025-11`;
- lacuna explícita: `2025-02`;
- maior sequência contínua: `37` meses;
- pendências: `0`;
- conflitos: `0`;
- reapresentações: `0`.

A ausência de `2025-02` permanece uma lacuna auditável. Ela não foi transformada em zero, estimada nem preenchida por fonte secundária.

## Evidência anual

As 46 observações completas foram divididas em quatro arquivos JSON auditáveis:

- `observations-2022.json`: 12 competências; hash `b7b781bd2fdf55a7c9a4c05fdd17ea165de70e31ee56c9cc621dcfb7b743239f`;
- `observations-2023.json`: 12 competências; hash `012a5d7171e6127e465b900f3e8d6ae9473979edbce6e95658c1869cd295562c`;
- `observations-2024.json`: 12 competências; hash `f49347ffd83159e0b21f66c653d5bda5d8d7d5b3ccec62d2555f3cefa0f6114b`;
- `observations-2025.json`: 10 competências; hash `537d30c2bbac1eb441b37d795b6bdd80682fbb50991f646e3a10ce98996e44a7`.

O teste integral recompõe os quatro arquivos, verifica o hash de cada ano e confirma o hash conjunto das 46 observações.

Os quatro arquivos foram regenerados diretamente do artefato imutável no GitHub Actions, com conferência prévia do SHA-256 do ZIP; o bootstrap temporário foi removido no mesmo commit e não integra o diff final.

## Hashes determinísticos

- checkpoint de entrada: `b4e52447d2495f5c482732e794ea02b19579a0267f76ecf726a53f102a53f520`;
- checkpoint sanitizado: `9c298ea7be1527670defb90fb5cfc5f84c43ae7936347f2abec5b924755ec007`;
- checkpoint finalizado: `556e02b3a0847c7b6865fbbf2255b4187c3716539a4a62bd3d625b399ae60d74`;
- sanitização: `749145f0102edbbe922733c1b24e1836d4cb770d01c21deb3d3d55c168fe764c`;
- caso: `16535e26bd75da0b67cc5be1ba3990a6a2b69d369179ea929cd54cb6138eeb06`;
- auditoria: `3a681c30244c05a1bf54ab40f65a1b34044c4bfbd656d06b56137cdf50560318`;
- observações combinadas: `75d66bf48e8d838529dd847385aadf073a8cf51aac53cbb8130bda125e42709e`;
- índice de evidência: `14c6ad2e55053d020688c0c99252e35a45c91a748cd946fd403b9acd0d99a817`.

Duas execuções independentes produziram os mesmos hashes.

## Testes

- testes sintéticos do sanitizador temporal geral;
- falha fechada para cobertura incompleta, observação divergente, competência corrigida dentro da coorte, padrão normal e digest/identidade inválidos;
- teste integral dos quatro arquivos anuais e das 46 observações reais;
- verificação do documento temporal e da classe `MCCI13`;
- verificação de ausência de hardcode, workflow exclusivo e efeitos de produto;
- preservação dos gates DEVA11, VSLH11, KNCR11 e KNSC11.

## Segurança e impacto

- nenhum endpoint de produto foi alterado;
- nenhuma notificação foi enviada;
- nenhum relatório Premium passou a consumir o Risk Lab;
- nenhum backtest foi executado;
- nenhuma credencial ou dado pessoal foi persistido;
- a mudança compartilhada é fail-closed e aplicável a qualquer fundo com o mesmo padrão comprovado.

## Rollback

O rollback consiste em reverter a PR funcional desta fase. Como não há integração com produto ou estado operacional, a reversão remove somente o sanitizador, seus testes, o gate e as evidências do MCCI11.
