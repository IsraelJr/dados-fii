# Sprint 3.5 — ação no Admin principal

A ação administrativa do backtest da coorte fica visível diretamente em `/admin/sistema` após a sessão Admin ser reconhecida.

## Comportamento

- botão: `Executar pendências automaticamente`;
- chama `POST /api/admin/system/risk-lab/cohort-backtest`;
- não exige confirmação, aprovação ou conhecimento técnico sobre fundos;
- exibe status, cobertura e quantidade de blockers;
- mantém link para os detalhes completos em `/admin/risk-lab/cohort-backtest`;
- não integra Premium, IA textual, alertas ou notificações.

O componente permanece oculto enquanto não houver sessão administrativa válida e volta a consultar a sessão após o login.
