# Relatório de execução — hotfix do histórico anual

**Data:** 03/08/2026
**Branch:** `fix/portfolio-history-month-paths`
**Base:** `main` em `dc12dfb8eac1d3105c96eb859b8919915e659acc`
**Estado:** PR dedicada, draft e sem merge

## Causa raiz

O repository anual usava uma propriedade computada `months.MM` dentro de `transaction.set(..., { merge: true })`. O SDK do Firestore trata chaves de `DocumentData` como segmentos literais nessa operação; portanto os `POST`s retornavam 201, mas criavam um campo top-level literal como `months.02`. A leitura procurava `data.months["02"]`, não encontrava fevereiro e o `DELETE` respondia 404.

## Política implementada

- a competência é validada estritamente como `YYYY-MM`, com ano suportado e mês entre `01` e `12`;
- a escrita usa somente `months: { [month]: entry }` em transação;
- `merge: true` preserva outros meses e campos do documento anual;
- transações serializam gravações concorrentes no mesmo documento sem perder meses;
- o contrato de `POST` duplicado continua determinístico: a segunda inclusão é rejeitada como já existente;
- o `DELETE` é idempotente e restrito à competência, usuário e carteira solicitados;
- autenticação, isolamento, origens `manual`, `automatic_snapshot` e `legacy`, e as regras temporais existentes não foram alterados.

## Compatibilidade conservadora

Leitura, busca, atualização e exclusão reconhecem o mapa canônico e o campo literal defeituoso.

| Estado | Leitura | Escrita lazy |
|---|---|---|
| somente literal válido | literal | copia para canônico e remove literal atomicamente |
| canônico + literal idênticos | canônico | remove literal atomicamente |
| canônico + literal diferentes | canônico | preserva ambos e emite diagnóstico sem conteúdo |
| conteúdo persistido inválido | falha fechado | não sobrescreve |

Não há migração global. O reparo ocorre somente no documento anual e nos meses alcançados pela operação do usuário. Um `DELETE` manual válido remove canônico e literal da competência exata; outros meses e campos permanecem intactos.

## Arquivos alterados

- domínio e serviço do histórico para validação estrita e cleanup idempotente;
- controller de histórico para delegar a exclusão por competência ao serviço;
- repository Firestore dividido entre adaptação de runtime e núcleo transacional testável;
- testes unitários, arquiteturais e integração real no Firestore Emulator;
- script existente de Firestore Rules ampliado para executar a integração do repository;
- documentação canônica e este relatório.

Não foram alterados sessão Firebase, família de sessões, runner ou secrets de QA, bypass Vercel, parser de percentuais, Portfolio Intelligence ou as branches das PRs #168, #169 e #170.

## Evidência funcional específica

O Firestore Emulator aprovou os seguintes cenários:

- meses `01` a `12` e virada dezembro/janeiro;
- dois meses no mesmo ano e gravações concorrentes;
- preservação de campos auxiliares;
- `POST` repetido sem duplicação;
- migração de literal para canônico;
- deduplicação quando os formatos são idênticos;
- conflito preservado com leitura canônica e diagnóstico sanitizado;
- origem `legacy` preservada e imutável;
- `DELETE` dos dois formatos, repetição e recuperação de falha parcial;
- isolamento por usuário e snapshot automático imutável;
- seis inclusões artificiais, leitura e exclusão de fevereiro, preservação dos cinco demais meses e cleanup completo repetível.

Resultado final da integração: 18/18 testes, incluindo 14 subtestes transacionais do histórico, o agrupamento do repository e 3 testes de Rules/fail-closed.

## Gates

| Gate | Resultado |
|---|---|
| ESLint | aprovado |
| TypeScript | aprovado |
| histórico unitário/arquitetural | aprovado: 27/27 |
| Firestore repository + Rules | aprovado: 18/18 |
| cobertura específica da hotfix | 93,96% linhas, 83,01% branches e 94,83% funções; núcleo Firestore com 95,34% linhas e 97,06% funções |
| cobertura crítica existente | métricas aprovadas: 100% linhas, 93,66% branches e 98,53% funções; processo vermelho somente pelo mesmo `REG-DEF-04` de `main` |
| mutation sanity | aprovado |
| build de produção | aprovado com credencial Firebase sintética gerada somente em memória |
| HTTP smoke | aprovado: 200/400/401/403/404/405/503 e headers defensivos |
| auditoria de produção | aprovada: 0 vulnerabilidades |
| secret scan | aprovado: 630 arquivos versionados, executado após staging |
| `test:all` | 601 aprovados, 1 falha e 1 integração com Emulator corretamente ignorada fora de `test:rules`; única falha é o `REG-DEF-04` temporal preexistente e inalterado em relação a `main` |

## Riscos e recomendação

- Conflitos entre canônico e literal não são resolvidos automaticamente; o dado literal é preservado para reparo controlado.
- Documentos anuais sem novos acessos não são migrados, por decisão conservadora.
- O gate completo permanece vermelho enquanto `main` mantiver a expectativa temporal não determinística de `REG-DEF-04`; essa correção pertence à PR #168 e não foi copiada para esta hotfix.

Não fazer merge nem marcar a PR como pronta enquanto qualquer gate permanecer vermelho. A PR deve continuar draft até revisão explícita da política de compatibilidade e dos resultados finais.
