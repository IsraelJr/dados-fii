# Sprint 2.12 — encerramento automatizado da Fase 2

**Status:** concluída em Produção em 20/07/2026.  
**Run:** `catalog-20260719204643291-c845f739`  
**Schema da evidência:** `2`  
**Commit executado:** `f4602e223e04c2d917b22a19391dbbd9e6f6286b`  
**Deployment:** `https://www.dadosfii.com.br`  
**Hash da evidência:** `2a3a3750eaeb55d4bae7c1240d3f29797d752a8382639edce60af02f869867c5`

## Objetivo

Encerrar as Fases 1 e 2 somente depois de executar em Produção a carga oficial do catálogo, o double check global e uma homologação estratificada. A automação não transforma ausência de evidência em dado e não depende de clique administrativo.

## Fluxo executado

A rota protegida `GET /api/cron/phase-2-closure` executou um fluxo retomável e idempotente:

1. `catalog-preview`: fontes oficiais, normalização, conciliação e prévia vinculada por hashes;
2. `catalog-apply`: aplicação exata da prévia aprovada, com backup, versão, publicação e auditoria;
3. `production-smoke`: Validation, Health e relatórios estratificados;
4. persistência da evidência sanitizada e verificação automatizada no Git;
5. remoção dos três agendamentos temporários e do disparador de uso único.

O estado final permanece consultável, em modo somente leitura, por `GET /api/system/phase-2-closure`.

## Gates de catálogo aprovados

| Gate | Resultado |
|---|---:|
| Conciliação B3/CVM | 100% |
| Cadastro básico dos ativos | 100% |
| Cobertura essencial aplicável | 97,81% |
| CNPJ duplicado entre ativos | 0 |
| Fundos ativos | 504 |
| Diretório público materializado | 504 |
| Atualizados | 554 |
| Inativados com evidência | 1 |
| Health | 98 |
| Validation | 100, 384 processados |
| Checks finais | 25/25 aprovados |

Lacunas não publicadas por fonte oficial permanecem `null`, acompanhadas de proveniência e aviso. Elas não são convertidas em zero nem em afirmações da IA.

## Homologação estratificada

| Caso | Classe | Papel | Gratuito | AI Insights | Premium |
|---|---|---|---:|---:|---:|
| MXRF11 | FII | padrão | aprovado | aprovado | aprovado |
| VGIA11 | FIAGRO | padrão | aprovado | aprovado | aprovado |
| BODB11 | FI-Infra | padrão | aprovado | aprovado | aprovado |
| RJDA11 | FII | dados essenciais externos incompletos | aprovado | aprovado | aprovado |
| HGPO11 | FII | inativo/liquidação, histórico preservado | aprovado | aprovado | aprovado |

A seleção cobre as três classes e também comportamentos incompleto e excepcional. O contrato exige cadastro básico, relatório gratuito, AI Insights e Premium para todos os cinco casos.

## Proteções verificadas

- APIs e orquestrador delegam ao `RegulatoryDataService`/`RegulatoryRepository`;
- nenhuma rota nova acessa Firestore diretamente;
- aplicação vinculada por `runId`, `sourceHash`, `planHash`, aprovação e publicação;
- backup imutável, versionamento, auditoria e rollback preservados;
- lock e retomada impedem concorrência e repetição destrutiva;
- cache por run/ticker evita consumo duplicado de IA;
- evidência pública não expõe ator interno, erro bruto, segredo ou hash de aprovação.

## Evidência canônica

O arquivo versionado `docs/production-evidence/phase-2/phase-2-closure-catalog-20260719204643291-c845f739-v2.json` é validado pelo teste arquitetural da Sprint 2.12. Ele contém o resultado integral sanitizado, os 25 checks, as cinco amostras e o hash final.

Com essa evidência persistida e os mecanismos temporários removidos, as Fases 1 e 2 atendem ao critério formal de conclusão.
