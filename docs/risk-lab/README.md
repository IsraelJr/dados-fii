# Risk Lab — piloto HCTR11/TGAR11

Este módulo valida um detector precoce de deterioração de tese sem usar informação futura.

## Princípios

1. Cada observação guarda `competenceDate`, `knownAt`, confiança e evidência.
2. O backtest rejeita qualquer dado publicado depois da data simulada.
3. Risco estrutural e deterioração são avaliados separadamente.
4. Regras são determinísticas, versionadas e explicáveis.
5. IA pode extrair informações, mas não cria números ausentes nem substitui a fonte.

## Escopo v0.1

- HCTR11: crédito high yield, carência, inadimplência e cobertura dos dividendos.
- TGAR11: desenvolvimento/equity, cobertura de caixa, reserva, reavaliações e eventos de liquidez.
- Fundos de controle serão incluídos antes de qualquer uso público.

## Estrutura

- `src/types/riskLab.ts`: contratos do domínio.
- `src/lib/risk-lab/RuleEngine.ts`: avaliação explicável e bloqueio de look-ahead.
- `src/lib/risk-lab/rules.ts`: regras iniciais do piloto.
- `src/lib/risk-lab/BacktestEngine.ts`: simulação cronológica.
- `tests/risk-lab-pilot.test.ts`: casos históricos mínimos.
- `data-dictionary-v0.1.json`: métricas e semântica.
- `backtest-spec-v0.1.md`: critérios de validação.

## Próxima entrega

Construir o dataset ouro mensal com evidência documental e depois substituir os snapshots sintéticos dos testes por fixtures extraídas dos documentos oficiais.
