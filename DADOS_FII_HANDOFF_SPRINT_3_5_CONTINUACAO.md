Este documento é o Handoff operacional mais recente da Sprint 3.5 e deve ser lido junto de `DADOS_FII_HANDOFF.md`. Em caso de divergência sobre a Sprint 3.5, este arquivo prevalece até ser incorporado ao documento canônico principal.

# Dados FII — Handoff de Continuidade da Sprint 3.5

**Versão operacional:** 6.2.1-continuacao  
**Data:** 21/07/2026  
**Repositório:** `IsraelJr/dados-fii`  
**Branch principal:** `main`  
**Sprint corrente:** 3.5 — Coorte externa e backtest sem informação futura  
**Status:** EM ANDAMENTO — NÃO CONCLUÍDA  
**Último commit implantado e auditado em Produção:** `4e5bd0561c1dcd0ede3f8a0ad145936a31277f2a`  

---

## 1. Regra de continuidade

A Sprint 3.5 não pode ser declarada concluída apenas porque o workflow executou os seis fundos ou porque o CI está verde. O encerramento exige evidência real em Produção, metodologia válida, ausência de look-ahead, fonte primária adequada, métricas persistidas e zero blocker metodológico de coleta/integridade.

O proprietário não deve aprovar tecnicamente fundos, selecionar documentos, informar IDs ou decidir se um evento financeiro é válido. A automação deve executar, auditar e falhar fechada quando houver dúvida.

Premium, IA textual e notificações continuam isolados do Risk Lab até os gates das Sprints 3.6, 3.7 e 3.8.

---

## 2. O que foi concluído nesta conversa

### 2.1 Execução administrativa

- Criada API administrativa protegida para executar as pendências da Sprint 3.5.
- Criado botão `Executar pendências automaticamente`.
- O botão foi inicialmente colocado apenas em `/admin/risk-lab/cohort-backtest`.
- Após o proprietário não encontrá-lo, ele foi exibido diretamente no topo de `/admin/sistema`.
- PR #69: destravou a execução da Sprint 3.5 pelo Admin.
- PR #70: exibiu a ação diretamente no Admin principal.
- A autorização e o acionamento deixaram de ser blockers.

### 2.2 Execução segmentada

- A chamada monolítica excedia a janela operacional da Vercel.
- A execução foi dividida em `initialize → seis fundos → finalize`.
- Cada fundo é persistido antes da etapa seguinte.
- Locks órfãos passaram a ser recuperáveis.
- A execução pode ser retomada sem perder os casos anteriores.
- PR #74: execução segmentada e correção do erro TypeScript no painel.

### 2.3 Parser e catálogo CVM

- O parser antigo rejeitava linhas da CVM porque exigia `TP_FUNDO_CLASSE` contendo literalmente `FII`.
- A base atual da CVM usa Fundo, Classe e Subclasse após a RCVM 175.
- O parser foi generalizado por CNPJ, sem exceções por ticker.
- PR #75: adaptação ao schema atual da CVM.

### 2.4 Formalização da evidência

- A formalização foi dividida em etapas auditáveis: preparar arquivos, publicar branch, criar PR e mesclar apenas quando aprovada.
- A branch de evidência é publicada antes da tentativa de criar PR.
- A falha recorrente na criação automática da PR não apaga a evidência.
- PR #76: formalização auditável e retomável.

### 2.5 Coleta mensal em lote da CVM

- O scraping individual do Fundos.NET mostrou-se instável para dezenas de documentos.
- Foi implementada uma fonte oficial em lote baseada nos ZIPs anuais `inf_mensal_fii_<ano>.zip` da CVM.
- Foram adicionados parser, hashes, versões, `Data_Entrega`, cache por exercício e proteção de janela.
- PR #83: migração do caminho mensal para o lote oficial da CVM.
- PR #84: seleção da maior versão que já era conhecida na data simulada, impedindo revisão futura de contaminar o passado.
- Os commits da PR #83 e #84 foram implantados em Produção.

---

## 3. Última execução válida em Produção

### Release

`4e5bd0561c1dcd0ede3f8a0ad145936a31277f2a`

### Workflow

GitHub Actions run: `29833116219`  
Artifact: `risk-lab-cohort-backtest-production-v2`  
Artifact ID: `8496239446`

### Resultado operacional

- deployment exato: aprovado;
- inicialização: aprovada;
- seis fundos executados e persistidos;
- consolidação: aprovada;
- evidência e hashes: produzidos;
- branch imutável de evidência: publicada;
- criação automática da PR: falhou novamente na etapa final;
- Premium integrado: `false`;
- notificações enviadas: `false`.

### Resultado metodológico

A nova fonte em lote eliminou o blocker de série vazia. Os seis fundos passaram a ter dezenas de observações contínuas.

Entretanto, a execução não pode ser aprovada porque `Rendimentos_Distribuir / Cotas_Emitidas` do Informe Mensal é um indicador contábil e não reproduz de forma universal o dividendo efetivamente anunciado ao cotista.

Foram observados:

- valores zero artificiais;
- mudança de base/cotas interpretada como estresse;
- falso positivo no controle `KNSC11`;
- `MCCI11` sem confirmação de recuperação de 90%;
- casos graves sem evento primário confirmado;
- resultado econômico inadequado para validar o detector de dividendos.

Conclusão vigente: o lote mensal da CVM é útil como controle contábil, proveniência e fonte auxiliar, mas não deve ser tratado como substituto universal do aviso estruturado de rendimento anunciado.

---

## 4. Evidências e PRs que devem ser preservadas

### PRs de tentativa reprovada

- PR #77 — `audit: registra blockers metodológicos da Sprint 3.5`.
- PR #80 — `audit: registra blockers da tentativa 0f1ebec da Sprint 3.5`.

Essas PRs preservam tentativas reprovadas e não devem ser apagadas nem reescritas.

### PRs incorporadas

- #69 — execução pelo Admin;
- #70 — botão no Admin principal;
- #71 — backtest metodológico v2;
- #72 — concorrência por exercício;
- #74 — execução segmentada;
- #75 — parser RCVM 175;
- #76 — formalização auditável;
- #79 — descoberta estruturada Fundos.NET;
- #83 — lote mensal oficial da CVM;
- #84 — seleção de versão conhecida na data simulada.

### Tentativas e releases importantes

- `afef58f`: primeira execução segmentada completa; série mensal vazia.
- `0f1ebec`: descoberta Fundos.NET acionada, mas resolução/HTML instável.
- `f50be1c`: lote mensal CVM implantado.
- `a65d976`: gatilho 6/6, execução concluída e branch de evidência publicada.
- `4e5bd05`: versão temporal correta em Produção e última evidência auditada.

O marcador `docs/production-evidence/risk-lab/sprint-3-5-deploy-trigger.json` chegou a `attempt: 6` de `maximumAttempts: 6`. Novas execuções não devem depender de ampliar silenciosamente esse contador; a estratégia operacional precisa ser explicitamente versionada.

---

## 5. Diagnóstico consolidado das fontes

### Catálogo de documentos eventuais da CVM

- Serve para fatos relevantes, relatórios e eventos.
- Não fornece sozinho a série mensal de dividendos anunciados.

### Informe Mensal FII em lote da CVM

- Fonte oficial, estável e eficiente.
- Traz `Rendimentos_Distribuir`, `Cotas_Emitidas`, `Data_Entrega` e `Versao`.
- Deve permanecer como controle contábil e fonte auxiliar.
- Não deve ser usado sozinho como dividendo anunciado por cota para o detector.

### Fundos.NET / avisos estruturados

- É a fonte adequada para o valor anunciado, competência, data-base, pagamento, versão e protocolo.
- O endpoint de listagem aceita consulta por CNPJ e paginação.
- O HTML individual e o protocolo são instáveis sob muitas requisições simultâneas.
- A coleta deve ocorrer em GitHub Actions, não dentro da função Vercel.
- A execução deve ser sequencial por fundo, com retentativas, backoff, hashes, checkpoint e retomada.

---

## 6. Branch interrompida — não fazer merge direto

Branch atual interrompida pelo pedido `Stop!`:

`agent/sprint-3-5-frozen-dividend-notices`

Alterações iniciadas nessa branch:

- `RiskLabCohortIdentityService.ts`;
- ação `identities` na API pública protegida pelo SHA exato de Produção;
- ampliação de entidades HTML no `FnetDividendNoticeParser.ts`;
- início de `scripts/collect-risk-lab-dividend-notices.ts`.

A criação do script foi interrompida no meio. Antes de qualquer continuação:

1. inspecionar a branch e verificar se o arquivo parcial foi realmente gravado;
2. não abrir PR nem fazer merge sem concluir ou remover o arquivo parcial;
3. comparar a branch com `main`;
4. criar testes antes de prosseguir;
5. manter a coleta fora da Vercel e sem exceções por ticker.

---

## 7. Próximo passo exato no novo chat

Começar pela auditoria da branch interrompida:

1. listar os arquivos alterados em `agent/sprint-3-5-frozen-dividend-notices`;
2. verificar se `scripts/collect-risk-lab-dividend-notices.ts` está parcial;
3. restaurar ou completar a branch sem tocar no ruleset `v0.1.0`;
4. criar workflow de coleta congelada no GitHub Actions;
5. buscar identidades oficiais da coorte pelo endpoint protegido;
6. listar documentos de rendimentos por CNPJ e janela;
7. baixar aviso e protocolo de forma sequencial por fundo;
8. usar retentativas com backoff e checkpoint por documento;
9. validar ticker, competência, valor, versão, entrega e no-look-ahead;
10. persistir dataset congelado com URL, trecho, hashes e versão;
11. usar o dataset congelado como série de dividendos do backtest;
12. manter o lote mensal CVM como reconciliação auxiliar;
13. reexecutar os seis fundos;
14. formalizar a evidência mesmo se a criação automática da PR falhar;
15. somente concluir a Sprint com evidência metodologicamente válida.

---

## 8. Testes obrigatórios para a próxima entrega

- parser de entidades HTML reais (`&ccedil;`, `&atilde;`, `&uacute;`, aspas tipográficas e entidades numéricas);
- ticker do aviso deve corresponder ao fundo consultado;
- competência e valor devem ser válidos;
- aviso e protocolo devem concordar;
- maior versão conhecida na data simulada;
- documento posterior à janela deve ser excluído;
- checkpoint e retomada não podem duplicar observações;
- falha de um documento deve manter ID pendente e não apagar os anteriores;
- coleta sequencial por fundo e limite de concorrência global;
- hashes SHA-256 de aviso, protocolo e dataset;
- série sem buracos ou conflitos explícitos;
- zero exceções codificadas para os seis tickers;
- Premium e notificações ausentes;
- `npm run typecheck`;
- `npm run test:risk-lab`;
- `npm run test:sprint2`;
- build/Preview e deployment exato de Produção.

---

## 9. Critérios de encerramento da Sprint 3.5

A Sprint só pode ser marcada como concluída quando houver:

1. seis casos executados no deployment exato;
2. fonte primária adequada ao dado avaliado;
3. `knownAt`, URL, trecho, hash e versão por observação;
4. nenhuma informação futura;
5. 100% de cobertura metodológica aplicável;
6. zero caso inconclusivo causado por falha de coleta;
7. zero falso positivo nos controles saudáveis;
8. eventos graves confirmados por fonte primária independente;
9. janelas reversíveis confirmadas independentemente do detector;
10. evidência imutável persistida no Git;
11. CI, deployment, smoke, rollback e auditoria documentados;
12. Handoff principal promovido para a versão seguinte e Sprint 3.6 indicada como corrente.

Falsos negativos reais do ruleset devem ser medidos e encaminhados à Sprint 3.6; não devem ser eliminados por recalibração usando a mesma coorte.

---

## 10. Estado final para abertura do próximo chat

- Fases 1 e 2: formalmente concluídas.
- Sprint 3.4: concluída.
- Sprint 3.5: em andamento.
- Infraestrutura, Admin, execução segmentada e evidência: funcionais.
- Série mensal em lote CVM: implementada, mas inadequada como substituto universal do dividendo anunciado.
- Fonte correta para a série: avisos estruturados oficiais do Fundos.NET, coletados fora da Vercel e congelados com auditoria.
- Branch de continuação: `agent/sprint-3-5-frozen-dividend-notices`, interrompida e não pronta para merge.
- Próxima ação: auditar e concluir a coleta congelada dos avisos estruturados.

**Não declarar a Sprint concluída e não avançar para a Sprint 3.6 antes da evidência final válida.**
