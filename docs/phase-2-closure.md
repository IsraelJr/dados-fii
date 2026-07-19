# Sprint 2.12 — encerramento automatizado da Fase 2

## Objetivo

Encerrar a Fase 2 somente depois de executar em Produção a carga oficial do catálogo, o double check global e uma homologação estratificada. A automação não transforma ausência de evidência em dado e não exige clique administrativo.

## Fluxo retomável

A rota protegida `GET /api/cron/phase-2-closure` avança uma etapa por chamada. Três chamadas temporárias e espaçadas permitem respeitar o tempo máximo de cada função:

1. `catalog-preview`: baixa fontes oficiais, normaliza, concilia e cria uma prévia imutável vinculada por hash;
2. `catalog-apply`: aplica exatamente a prévia aprovada pela engine, criando backup, versão, hash de publicação, auditoria e diretório materializado;
3. `production-smoke`: executa Validation, Health e relatórios para FII, FIAGRO e FI-Infra.

Cada execução usa lock com expiração. Uma repetição retoma o passo pendente; depois do estado `passed`, novas chamadas não fazem escrita regulatória.

## Gates antes da publicação

A carga é bloqueada se qualquer item abaixo falhar:

- conciliação B3/CVM inferior a 100%;
- dados básicos dos fundos ativos inferiores a 100%;
- cobertura essencial inferior a 95%;
- qualquer grupo de CNPJ duplicado;
- universo oficial suspeito de truncamento;
- ausência dos fundos sentinela;
- `safeToApply` falso;
- inativação sem `destructiveChangesAllowed`;
- qualquer gap formal da própria `FundCatalogEngine`.

## Proteções da aplicação

A Sprint reutiliza `RegulatoryDataService` e `RegulatoryRepository`. Não existe acesso direto ao Firestore nas rotas ou no orquestrador.

A aplicação existente continua exigindo:

- `runId` válido;
- hash de aprovação de 64 caracteres;
- igualdade entre o hash recebido e a prévia persistida;
- recomputação e igualdade do `planHash`;
- backup imutável por fundo alterado;
- versão e `publicationHash`;
- auditoria e diretório materializado após a carga.

## Double check global

Depois da carga, a auditoria relê todos os documentos do catálogo e confirma:

- 100% de dados básicos;
- pelo menos 95% de dados essenciais aplicáveis;
- zero CNPJ duplicado;
- zero fundo com campo básico ausente;
- igualdade entre fundos ativos auditados e diretório público;
- associação de auditoria e diretório ao mesmo `runId` aplicado.

Campos que a fonte oficial não publica permanecem `null`, com proveniência e warning, e não são inventados.

## Homologação estratificada

A seleção é determinística e cobre uma amostra ativa de cada classe. Quando disponíveis, os sentinelas são:

- FII: `MXRF11`;
- FIAGRO: `VGIA11`;
- FI-Infra: `BODB11`.

Para cada amostra são exigidos cadastro básico, relatório gratuito, AI Insights e relatório Premium completo. A homologação também rejeita texto de IA que declare CNPJ, gestor ou administrador ausente quando esses dados estão presentes no objeto regulatório.

As chaves de requisição incluem `runId` e ticker. Assim, uma repetição da mesma carga reaproveita o cache e evita consumo duplicado de IA.

## Evidência e privacidade

O estado completo e seu histórico ficam em `RegulatoryPhase2ClosureRuns`; cada transição também entra em `RegulatoryAuditLogs`. Antes da persistência, o objeto passa por serialização JSON para impedir valores `undefined` no Firestore.

`GET /api/system/phase-2-closure` disponibiliza apenas a evidência sanitizada: commit, deployment, contagens, checks, amostras e hash final. A resposta não contém ator interno, erro bruto, segredo do cron, hash de aprovação ou dados de usuário.

## Encerramento

A Fase 2 só pode ser marcada como 100% concluída quando:

1. CI e build do commit da Sprint estiverem verdes;
2. deployment de Produção estiver verde;
3. o endpoint de evidência retornar `status: passed`;
4. o JSON sanitizado de Produção for salvo em `docs/production-evidence/phase-2/` e versionado no Git;
5. os crons temporários forem removidos em um commit de limpeza.
