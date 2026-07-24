# Sprint 3.5-B3 — caso determinístico KNSC11

## Estado

Concluído tecnicamente na branch da issue #117. A conclusão formal depende de CI, Preview, merge, auditoria do `main` e atualização do Handoff em PR separada.

## Escopo

Esta unidade trata somente o KNSC11 como controle saudável da coorte externa. Não executa backtest, não altera endpoints operacionais, não integra o Risk Lab ao Relatório Premium, não envia notificações e não inicia MCCI11 ou RBRY11.

## Fonte imutável

- workflow run: `29881954620`;
- artifact: `8515476365`;
- nome: `risk-lab-frozen-dividend-checkpoint-v3`;
- SHA-256 do ZIP: `8ed76121aa14086cba740ad921cdcef925e44bd274cb86ca42bc14bba1ee9d0e`;
- release commit: `b54bc58276f43695c3f48f2aa8c9f47a2cadac2a`;
- download repetido em 24/07/2026 com digest idêntico ao registrado pelo GitHub Actions.

O checkpoint principal anterior não continha KNSC11. Por isso esta fase usa somente o checkpoint completo do artefato diagnóstico, sem inventar uma segunda fonte ou declarar independência inexistente.

## Estado inicial

- documentos descobertos: `52`;
- documentos com observação válida: `49`;
- falhas: `3`;
- observações brutas: `49`;
- competências distintas: `48`;
- período: `2022-01` a `2025-12`;
- lacunas: `0`.

### Classes secundárias

| Documento | Falha oficial | Classificação |
|---|---|---|
| `283956` | `Ticker FNET inválido: KNSC13` | classe secundária da família KNSC |
| `283976` | `Ticker FNET inválido: KNSC14` | classe secundária da família KNSC |
| `283999` | `Ticker FNET inválido: KNSC15` | classe secundária da família KNSC |

A classificação usa `SingleFrozenDividendCaseFinalizer`, que aceita um ticker diferente do ticker principal somente quando os quatro caracteres da família coincidem. Um ticker de outra família falha fechado.

## Reapresentação de janeiro de 2022

O checkpoint contém dois documentos para a competência `2022-01`:

| Documento | Versão | Valor | Pagamento | Resultado |
|---|---:|---:|---|---|
| `261396` | 1 | 1,25 | 11/01/2022 | substituído |
| `261675` | 2 | 1,25 | 11/02/2022 | selecionado |

A regra geral seleciona a maior `protocolVersion`; em empate, usa anúncio mais recente e depois o ID do documento. Não há exceção específica para KNSC11.

## Resultado final

- documentos classificados: `52/52`;
- observações brutas preservadas: `49`;
- competências selecionadas: `48`;
- pendências: `0`;
- conflitos: `0`;
- lacunas: `0`;
- maior sequência contínua: `48` meses.

## Hashes determinísticos

- checkpoint de entrada: `740df8717b831fa892e3a32d35e4cff636381118146676b6191f044a2b006edf`;
- checkpoint finalizado: `1aaccf1822f73a50689899d0f8d7c644da6e9fbb421e16a3ea8ec684e8816216`;
- caso: `4eddc7ed639e97d3828bce8a54d905105d4f60031a1ed8f332695ea97f31b4c2`;
- auditoria: `ec34755f95f6bd25f1af7421b66fc6874d9c73eeb2ab3b924471f765be04a22a`;
- 48 observações: `00ddf8ec44c0f02757b766f3b98781d80649bc1fca973c4b46cf05a866014045`;
- índice de evidência: `149ababbbd26ac4cf21b5462022e0c921cff3ff10a1797f0d4047fda2d3bdb65`.

Duas execuções independentes produziram o mesmo conjunto de hashes.

## Evidência versionada

- `docs/production-evidence/risk-lab/knsc11-phase-b3-manifest.json`;
- `docs/production-evidence/risk-lab/knsc11-phase-b3/index.json`;
- `docs/production-evidence/risk-lab/knsc11-phase-b3/observations-2022.json`;
- `docs/production-evidence/risk-lab/knsc11-phase-b3/observations-2023.json`;
- `docs/production-evidence/risk-lab/knsc11-phase-b3/observations-2024.json`;
- `docs/production-evidence/risk-lab/knsc11-phase-b3/observations-2025.json`.

## Testes

O teste integral `tests/risk-lab-knsc11-evidence.test.mjs` verifica:

1. recomposição dos quatro arquivos anuais e das 48 competências;
2. hashes do caso, auditoria, observações e índice;
3. igualdade das duas execuções registradas;
4. cobertura exata das três classes secundárias;
5. seleção da versão 2 em `2022-01`;
6. ausência de workflow exclusivo, ticker hardcoded e efeito de produto.

O gate da fase também executa os testes sintéticos já existentes do finalizador geral, preservando falha fechada para outra família, evidência incompleta ou período indevidamente classificado.

## Segurança e limites

- nenhum ticker foi adicionado ao finalizador compartilhado;
- nenhum dado faltante virou zero;
- nenhum conflito foi ocultado;
- nenhum endpoint de produção foi alterado;
- nenhum alerta ou relatório consumiu o resultado;
- MCCI11 e RBRY11 permanecem fora desta unidade;
- a Sprint 3.5 completa continua aberta até dataset e backtest.
