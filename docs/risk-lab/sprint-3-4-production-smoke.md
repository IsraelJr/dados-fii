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

## Segurança do disparo inicial

A primeira homologação usa uma rota temporária, válida apenas em Produção, protegida por token aleatório de uso operacional armazenado no código somente por hash e com expiração em 21/07/2026. O segredo em texto puro não é versionado.

Após a execução, a rota deve ser convertida em leitura pública sanitizada da evidência. O mecanismo temporário e seu hash devem ser removidos.

## Evidências

- Firestore: `RiskLabProductionSmokeRuns`, `RiskLabProductionSmokeAudit` e `RiskLabProductionSmokeLocks`;
- scans: `RiskLabAutomaticScans` e `RiskLabAutomaticScanAudit`;
- Git: `docs/production-evidence/risk-lab/` após o resultado aprovado.
