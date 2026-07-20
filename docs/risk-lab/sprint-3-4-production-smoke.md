# Sprint 3.4 — Smoke automatizado de Produção

## Objetivo

Homologar o fluxo automático do Risk Lab no deployment real, sem exigir seleção de documentos ou validação técnica do proprietário e sem integrar resultados ao Relatório Premium ou às notificações.

## Matriz obrigatória

- `HCTR11`: unidade histórica real;
- `MCCI11`: série mensal e detector reais;
- `RBRY11`: série mensal e detector reais;
- ticker inválido: rejeição antes de consulta externa;
- série insuficiente: estado inconclusivo e detector interrompido;
- documento ambíguo: classificação final interrompida.

## Gates

1. deployment exato de Produção identificado;
2. descoberta automática habilitada;
3. rate limit do Admin preservado em três pesquisas a cada quinze minutos;
4. pesquisas reais por ticker sem estado bloqueado;
5. resultado final persistido após a triagem de crédito;
6. auditoria separada por scan;
7. identificadores com hash determinístico;
8. zero integração com Premium;
9. zero alerta ou notificação;
10. evidência imutável com SHA-256.

## Disparo automático inicial

O workflow `Risk Lab Production Smoke` é acionado pelo merge em `main`, espera o commit exato tornar-se o deployment ativo de Produção e então dispara a execução. A rota temporária exige simultaneamente ambiente de Produção, `runId` congelado, SHA de 40 caracteres igual a `VERCEL_GIT_COMMIT_SHA`, origem declarada `github-actions` e validade até 21/07/2026.

Não existe segredo em texto puro. O executor é idempotente, protegido por lock e limitado a uma evidência aprovada. Após a conclusão, o gatilho temporário deve ser removido e a rota deve permanecer somente para leitura pública sanitizada.

## Evidências

- Firestore: `RiskLabProductionSmokeRuns`, `RiskLabProductionSmokeAudit` e `RiskLabProductionSmokeLocks`;
- scans: `RiskLabAutomaticScans` e `RiskLabAutomaticScanAudit`;
- artifact do GitHub Actions com a resposta sanitizada;
- Git: `docs/production-evidence/risk-lab/` após o resultado aprovado.


## Resultado de Produção

- Status: `passed`;
- run: `risk-lab-3-4-20260720-v1`;
- commit executado em Produção: `e9a5d6ec263c0aa87961133a361891f60175dba4`;
- ambiente: `production`;
- deployment: `https://www.dadosfii.com.br`;
- checks: `11/11`;
- casos obrigatórios: `6/6`;
- blockers: `0`;
- hash: `deb0f79597c2fbfb87214c6d05df37cbe782e084e4a7289a487042c3582a567f`;
- Premium integrado: `false`;
- notificações enviadas: `false`.

Os casos reais `HCTR11`, `MCCI11` e `RBRY11` ficaram `inconclusive` por insuficiência de evidência estruturada, sem falsa classificação final. Isso aprova a segurança operacional e a semântica do pipeline, mas não substitui a verificação primária e o backtest da Sprint 3.5.
