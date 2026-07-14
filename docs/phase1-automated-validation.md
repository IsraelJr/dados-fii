# Validação automatizada da Fase 1

A Fase 1 possui dois níveis de validação automatizada.

## 1. Validação obrigatória em pull requests

O workflow `Phase 1 Validation CI` executa:

- testes unitários e de contratos;
- typecheck;
- auditoria de vulnerabilidades críticas em dependências de produção;
- Playwright local em Chromium;
- bloqueio de APIs regulatórias anônimas;
- bloqueio de APIs administrativas sem sessão;
- rejeição de credencial administrativa inválida;
- verificação dos cabeçalhos básicos de segurança.

Esse modo usa somente credenciais falsas de CI e não toca no Firestore real.

## 2. Smoke operacional no Preview

O workflow também pode ser executado manualmente em **Actions → Phase 1 Validation CI → Run workflow**.

Informe:

- `preview_url`: URL completa do deployment de Preview;
- `run_live_ingestion`: `true` somente para executar uma ingestão real controlada do MXRF11 em staging.

Secrets necessários no environment `preview` do GitHub:

- `E2E_ADMIN_UPDATE_SECRET`: mesmo valor de `ADMIN_UPDATE_SECRET` do Preview;
- `E2E_VERCEL_BYPASS_TOKEN`: token de bypass, somente quando o Preview estiver protegido pela Vercel.

O Preview também precisa possuir:

- `ADMIN_SESSION_SECRET` independente;
- `FII_INGESTION_PUBLICATION_ENABLED=false`;
- `FII_INGESTION_ROLLBACK_ENABLED=false`;
- `ADMIN_LEGACY_SECRET_ENABLED=false`.

## O que o smoke operacional valida

Quando `run_live_ingestion=true`, a automação:

1. cria a sessão administrativa;
2. inicia MXRF11 com IA desativada;
3. tenta iniciar o mesmo ticker novamente e exige HTTP 409;
4. acompanha o run e o lock autenticado;
5. verifica heartbeat e avanço de etapas;
6. exige conclusão do workflow;
7. confirma remoção do lock;
8. executa QA persistido e exige score 100;
9. gera pré-publicação sem persistir;
10. confirma que publicação permanece bloqueada pelo ambiente.

A automação nunca:

- habilita publicação;
- aprova um pacote;
- escreve em `Fiis/{ticker}/regulatoryData`;
- habilita rollback;
- executa rollback;
- faz merge do PR.

## Evidências

Em todas as execuções, o GitHub Actions salva quando disponíveis:

- relatório HTML do Playwright;
- JSON dos resultados;
- screenshots de falhas;
- vídeos de falhas;
- traces para reprodução.

Retenção:

- validação local: 14 dias;
- smoke no Preview: 30 dias.

## Comandos locais

```bash
npm run test:phase1
npm run test:phase1:security
```

Para testar um Preview:

```bash
E2E_BASE_URL="https://preview.example.com" \
E2E_ADMIN_UPDATE_SECRET="..." \
npm run test:phase1:security
```

A ingestão real exige ainda:

```bash
E2E_RUN_LIVE_INGESTION=true npm run test:phase1:operational
```
