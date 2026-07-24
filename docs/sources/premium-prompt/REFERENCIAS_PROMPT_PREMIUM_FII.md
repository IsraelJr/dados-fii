# Referências visuais para o Prompt Premium FII

**Versão:** 1.1.0  
**Data:** 24/07/2026  
**Uso:** Sprint 3.7 e validações futuras do Relatório Premium.

## Objetivo

Preservar a análise de nove referências visuais sem copiar marcas, logos ou prompts genéricos. O Dados FII utiliza metodologia própria para FII, FIAGRO e FI-Infra.

## Catálogo

| Arquivo esperado | Tema | Adaptação válida |
|---|---|---|
| `01-screener-referencia.jpeg` | Screener | Mandato, renda coberta, desconto ajustado ao risco, liquidez, concentração, governança baseada em evidência e pares. |
| `02-valuation-referencia.jpeg` | Valuation | Faixa e cenários específicos por tipo; não usar DCF genérico de ações. |
| `03-risco-carteira-referencia.jpeg` | Risco | Concentração, correlação, liquidez, juros, stress, drawdown e impacto por posição. |
| `04-previa-resultados-referencia.jpeg` | Prévia | Próxima competência, quatro competências anteriores, métricas, riscos e catalisadores oficiais. |
| `05-modelo-carteira-referencia.jpeg` | Carteira | Core/satélite, metas, aportes, rebalanceamento e política de investimento. |
| `06-analise-tecnica-referencia.jpeg` | Técnica | Fora do núcleo; somente módulo futuro com séries, metodologia, backtest e revisão jurídica. |
| `07-carteira-dividendos-referencia.jpeg` | Dividendos | Cobertura, caixa, recorrência, cortes, reservas, projeção por faixa e diversificação. |
| `08-analise-competitiva-referencia.jpeg` | Competitiva | Pares do mesmo mandato, escala, qualidade, risco, renda, gestão e catalisadores. |
| `09-estrutura-analise-financeira-referencia.jpeg` | Processo | Objetivo, entrada, validação, evidência, cálculos, riscos, restrições e acompanhamento. |

## Contrato do Prompt Premium v3

O backend fornece perfil/objetivo, carteira e metas, identidade do fundo, preço e competência, VP, dividendos, cobertura, liquidez, patrimônio/cotas/cotistas, dados específicos do tipo, eventos, scores, fontes, confiança, lacunas e pares.

A resposta contém resumo, qualidade dos dados, mudanças, renda, patrimônio/valuation, liquidez, riscos, cenários, pares, impacto na carteira, pontos positivos/negativos, invalidadores da tese, perguntas abertas e conclusão informativa.

## Regras por categoria

- **Tijolo:** ocupação, imóveis, inquilinos, contratos, revisões, NOI, cap rate, obras e transações.
- **Papel/CRI:** devedores, garantias, subordinação, indexadores, duration, carência, waiver, PDD, caixa versus distribuição e concentração.
- **Desenvolvimento/híbrido:** VGV, estoque, landbank, cronograma, liquidez, execução, obra, repasse e caixa versus reavaliação.
- **FoF:** sobreposição, dupla taxa, desconto, giro, concentração e renda recorrente versus ganho de capital.
- **FIAGRO/FI-Infra:** contraparte, garantias, cadeia/projeto, regulação, indexador, duration e riscos comprovados.

## Restrições

- não inventar dados;
- não atribuir governança forte por simples identificação;
- não tratar falha de CNPJ como risco do fundo;
- bloquear liquidez implausível;
- não transformar ágio/desconto ou DY em recomendação;
- explicar jargão;
- não ocultar fonte, competência, premissa ou confiança;
- não emitir ordem automática, garantia de retorno, stop, target ou `strong buy/sell`;
- exibir apenas “Conteúdo informativo, sem recomendação de investimento.”

## Contrato de evidência

`fact`, `calculation`, `estimate`, `inference`, `unavailable` e `inconclusive`.

## Validação mínima

Um fundo de cada categoria; dados completos/incompletos/conflitantes/implausíveis; carteiras concentrada/diversificada/sem posição; consistência entre Relatório, Premium, ScoreEngine e Risk Lab; mesma fórmula/competência; medição de repetição, jargão, afirmação sem evidência e custo.
