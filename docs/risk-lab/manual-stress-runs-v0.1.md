# Execuções manuais do detector de estresse — v0.1

## Objetivo

Executar o `DividendStressWindowEngine` somente sobre séries mensais aprovadas manualmente, preservando um snapshot auditável e sem produzir efeitos externos.

## Pré-condições

- ticker restrito a `MCCI11` ou `RBRY11`;
- pelo menos nove competências consecutivas em `RiskLabVerifiedDividendNotices`;
- cada observação deve ter fonte primária e revisão manual;
- chamada administrativa autenticada;
- `ENABLE_RISK_LAB_STRESS_RUN=true`;
- confirmação explícita no corpo da requisição.

## Endpoint

`GET /api/admin/system/risk-lab/stress-runs`

Retorna, para cada fundo:

- prontidão da série;
- estado da feature flag;
- última execução persistida, quando existir.

`POST /api/admin/system/risk-lab/stress-runs`

Corpo:

```json
{
  "action": "execute",
  "ticker": "MCCI11",
  "confirmed": true
}
```

## Identidade da execução

A execução é identificada por:

- ticker;
- versão congelada `dividend-stress-v0.1.0`;
- SHA-256 do snapshot canônico das observações verificadas.

Repetir a execução sobre o mesmo snapshot devolve o registro existente e não cria nova auditoria.

## Persistência

- resultados: `RiskLabDividendStressRuns`;
- auditoria: `RiskLabDividendStressRunAudit`.

O registro inclui os IDs das observações, competências, hash, responsável, data, resultado e a declaração explícita de ausência de efeitos externos.

## Limitação prudencial

A execução matemática não encerra a validação do caso. Até existir uma revisão documental dos eventos materiais de crédito, todo resultado permanece:

- `classificationFinal: false`;
- limitado por `material_credit_events_not_reviewed`.

Portanto, mesmo quando o motor retornar `reversible_stress_confirmed`, a classificação armazenada continua preliminar.

## Efeitos proibidos

A execução não pode:

- criar alertas;
- enviar notificações;
- alterar o Relatório Premium;
- publicar dados;
- disparar backtest da coorte;
- modificar o ruleset.

Essas garantias são gravadas no artefato e protegidas por testes arquiteturais.
