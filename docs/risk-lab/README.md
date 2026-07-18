# Risk Lab — piloto HCTR11/TGAR11

Este módulo valida um detector precoce de deterioração de tese sem usar informação futura.

## Princípios

1. Cada observação guarda `competenceDate`, `knownAt`, confiança e evidência.
2. O alerta nasce na data em que a informação se tornou pública, não no encerramento da competência analisada.
3. O backtest rejeita qualquer dado publicado depois da data simulada.
4. Risco estrutural e deterioração são avaliados separadamente.
5. Regras são determinísticas, versionadas e explicáveis.
6. IA pode extrair informações, mas não cria números ausentes nem substitui a fonte.
7. O motor define o nível do alerta; nenhum modelo de linguagem decide se o fundo está vermelho.
8. Qualidade documental (`gold`) e liberação operacional são decisões separadas e auditáveis.

## Escopo v0.1

- HCTR11: crédito high yield, carência, inadimplência e cobertura dos dividendos.
- TGAR11: desenvolvimento/equity, cobertura de caixa, reserva, reavaliações e eventos de liquidez.
- Fundos de controle serão ampliados antes de qualquer uso público.

## Estrutura

- `src/types/riskLab.ts`: contratos analíticos do domínio.
- `src/types/riskLabProduction.ts`: contratos da execução administrativa.
- `src/lib/risk-lab/RuleEngine.ts`: avaliação explicável e bloqueio de look-ahead.
- `src/lib/risk-lab/rules.ts`: regras iniciais do piloto.
- `src/lib/risk-lab/BacktestEngine.ts`: simulação cronológica.
- `src/lib/risk-lab/DatasetLoader.ts`: validação de datasets candidatos, ouro e aprovação de produção.
- `src/lib/risk-lab/RiskLabReportBuilder.ts`: relatório determinístico autônomo.
- `src/lib/risk-lab/RiskLabRepository.ts`: persistência, histórico, auditoria e lock.
- `src/lib/risk-lab/RiskLabService.ts`: whitelist, feature flag e orquestração.
- `src/app/api/admin/system/risk-lab/route.ts`: API protegida do Admin.
- `src/app/admin/risk-lab/page.tsx`: tela unitária de execução.
- `tests/risk-lab-*.test.*`: backtest, qualidade documental, produção e arquitetura.

## Níveis de qualidade do dataset

### Candidate

Pode incluir fontes secundárias rastreáveis, trechos ainda sem página exata e métricas com confiança inferior a 90%. Serve para desenvolver o pipeline, testar regras e localizar lacunas documentais. Nenhuma conclusão pública depende dessa camada.

### Gold

Para promoção, cada observação precisa ter:

- documento primário conferido;
- URL rastreável;
- página e trecho que sustentem diretamente o valor;
- classificação `confirmed`;
- confiança mínima de 90%;
- `knownAt` correspondente à primeira disponibilização pública;
- revisão humana da competência, unidade e interpretação econômica.

Trocar apenas o rótulo de `candidate` para `gold` faz o carregador rejeitar o arquivo.

## Aprovação operacional restrita

O dataset `gold-hctr-tgar-v0.1` está aprovado somente no escopo `admin_unit_test_only` e somente para `HCTR11`.

A aprovação exige:

- responsável e data;
- motivo explícito;
- hash SHA-256 da aprovação;
- whitelist de tickers;
- escopo declarado.

O runtime recusa dataset candidato, aprovação incompleta, ticker fora da whitelist ou escopo diferente.

## Teste em produção

Após autenticar no Admin, a tela é:

```text
/admin/risk-lab
```

O botão **Gerar relatório de risco**:

1. carrega o seed ouro aprovado;
2. aplica o motor v0.1.0;
3. reproduz o alerta vermelho histórico do HCTR11 em 12/12/2024;
4. persiste relatório imutável no Firestore;
5. atualiza o último resultado;
6. grava auditoria com hashes do dataset e das regras;
7. libera o lock da execução.

Coleções usadas:

```text
RiskLabReports
RiskLabStatus
RiskLabAudit
RiskLabLocks
```

## Isolamento obrigatório

Esta fatia vertical:

- não integra o Relatório Premium;
- não chama o AI Insights Engine;
- não envia e-mail, Telegram ou notificação no site;
- não publica recomendação ao usuário;
- não autoriza TGAR11 nem outros fundos;
- não representa análise atual do HCTR11.

A feature flag `ENABLE_RISK_LAB_ADMIN=false` desliga imediatamente a execução administrativa.

## Estado atual

O dataset candidato reproduz:

- HCTR11 laranja em 22/11/2024 e vermelho em 12/12/2024;
- TGAR11 amarelo em 31/07/2024 e laranja em 26/01/2026.

O dataset ouro aprovado reproduz exclusivamente:

- HCTR11 vermelho em 12/12/2024 pela regra `HY-003` — distribuição positiva sem resultado mensal positivo.

## Próximas validações antes da generalização

1. executar manualmente o botão no ambiente implantado;
2. conferir `RiskLabReports`, `RiskLabStatus` e `RiskLabAudit`;
3. ampliar o dataset ouro com períodos intermediários;
4. aumentar a amostra de fundos saudáveis e com estresse reversível;
5. somente depois discutir integração com o Relatório Premium e monitoramento contínuo.
