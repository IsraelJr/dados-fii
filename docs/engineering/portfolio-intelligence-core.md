# Núcleo determinístico da Inteligência da Carteira

## Objetivo

O núcleo transforma o histórico consolidado e as posições atuais da carteira em métricas e sinais estruturados. O resultado é reproduzível para a mesma entrada, data de referência e versão de política. Nenhuma fórmula depende de React, Firestore, Next.js ou OpenAI.

O conteúdo é informativo e não produz recomendação de compra, venda, preço-alvo, fair value ou nota arbitrária de risco.

## Arquitetura

```text
consolidatedSnapshots + posições enriquecidas pelo RegulatoryDataService
  → adapters sem reconciliação
  → normalização e validação fail-closed
  → métricas determinísticas
  → qualidade e confiança
  → política versionada
  → sinais ordenados
  → painel de apresentação
```

Responsabilidades:

- `PortfolioIntelligence.ts`: contratos públicos, warnings e erro de validação;
- `PortfolioIntelligenceAdapters.ts`: adaptação da fonte consolidada e das posições atuais;
- `PortfolioIntelligenceMetrics.ts`: estatística de renda e concentração;
- `PortfolioIntelligenceDataQuality.ts`: cobertura, estado e confiança;
- `PortfolioIntelligencePolicy.ts`: versão e thresholds;
- `PortfolioIntelligenceSignals.ts`: regras, textos determinísticos, evidências e ordenação;
- `PortfolioIntelligenceService.ts`: normalização, orquestração e relógio injetável;
- `PortfolioIntelligencePanel.tsx`: apresentação sem cálculo financeiro.

Não foi criada API. A página já carrega os fundos por `/api/fii/batch`, cuja implementação consulta `RegulatoryDataService.getMany`. O motor não lê banco, não escreve snapshot e não repete a reconciliação entre histórico manual, cache e servidor.

## Contratos de entrada

O histórico recebe somente:

```ts
type PortfolioIntelligenceSnapshotInput = Readonly<{
  competence: string; // YYYY-MM
  dividends: number | null;
}>;
```

O adapter converte diretamente cada item de `consolidatedSnapshots`: `monthKey` vira `competence` e `estimatedMonthlyIncome` vira `dividends`.

As posições recebem:

```ts
type PortfolioIntelligencePositionInput = Readonly<{
  ticker: string;
  quantity: number;
  price: number | null;
  estimatedIncome: number | null;
  segment: string | null;
}>;
```

`null` significa ausência. Zero de dividendo ou renda estimada é um valor explícito e válido. Cotação zero não representa patrimônio válido e é normalizada como ausente.

## Contrato de saída

`PortfolioIntelligenceResult` contém:

- `policyVersion`;
- `generatedAt`;
- `asOf`;
- `metrics`;
- `signals`;
- `dataQuality`;
- `warnings`.

Cada sinal possui código, severidade, título, resumo, confiança categórica, evidências primitivas e versão da política. Não existe confiança numérica inventada.

`dataQuality.reasons` preserva motivos estruturados, ordenados e apresentáveis. Cada motivo contém código, conclusão afetada, impacto (`suppressed` ou `reduced_confidence`), mensagem e evidências primitivas. Os códigos atuais distinguem carteira vazia, cotação ausente, segmento ausente, renda estimada ausente, total conhecido igual a zero, histórico curto, histórico com lacunas e entrada rejeitada pelo modo seguro. Ausência continua sendo `null`; total explicitamente conhecido como zero continua sendo `0`.

## Política versionada

Versão atual: `1.0.0`.

| Regra | Threshold |
|---|---:|
| Meses válidos para tendência | 6 |
| Bloco recente e anterior | 3 meses cada |
| Alta | variação entre médias ≥ +5% |
| Queda | variação entre médias ≤ -5% |
| Estabilidade | variação entre -5% e +5% |
| Instabilidade | CV populacional ≥ 20% |
| Faixa intermediária de CV | 10% a 20%, sem diagnóstico forte |
| Maior posição | ≥ 30% |
| Três maiores posições | ≥ 70% |
| HHI | ≥ 2.500 |
| Dependência de renda | um fundo ≥ 35% |
| Cobertura mínima de segmentos | ≥ 70% do patrimônio cotado |
| Concentração por segmento | um segmento ≥ 50% |
| Robust z-score de mês atípico | ≥ 3,5 |
| Desvio relativo mínimo do atípico | ≥ 50% |

Alterações futuras exigem nova versão, documentação da hipótese, testes de fronteira e comparação explícita com a política anterior.

## Fórmulas

### Tendência

Para os seis meses válidos mais recentes:

```text
média anterior = média dos três primeiros meses
média recente = média dos três últimos meses
variação (%) = ((média recente - média anterior) / |média anterior|) × 100
```

Se a média anterior for zero e a recente for diferente de zero, a variação percentual fica ausente e um warning é emitido. O motor nunca retorna infinito.

### Instabilidade

O desvio-padrão é populacional:

```text
σ = sqrt(Σ(xᵢ - média)² / N)
CV (%) = σ / |média| × 100
```

Média zero produz CV ausente.

### Mediana, maior e menor mês

A mediana usa todos os meses encerrados com dividendo informado. Maior e menor mês incluem zero explícito e ignoram ausência. Empates são resolvidos pela competência cronologicamente mais antiga.

### Mês atípico

Cada mês elegível é comparado aos seis meses válidos anteriores:

```text
mediana = mediana(baseline)
MAD = mediana(|xᵢ - mediana|)
robust score = 0,6745 × |candidato - mediana| / MAD
```

O sinal exige simultaneamente robust score ≥ 3,5 e desvio relativo ≥ 50%.

Fallback quando `MAD = 0`:

1. calcular o desvio absoluto médio da baseline;
2. se ele for positivo, usar `|diferença| / desvio absoluto médio` com o mesmo threshold 3,5;
3. se a baseline for constante, considerar material apenas diferença de pelo menos R$ 0,01 e, quando a mediana não for zero, pelo menos 50%;
4. registrar `OUTLIER_ZERO_MAD_FALLBACK`.

O maior ou menor mês não é classificado automaticamente como atípico.

### Patrimônio e participações

```text
valor da posição = quantidade × cotação válida
participação (%) = valor da posição / patrimônio válido × 100
HHI = Σ(participação percentual²)
```

Posições são ordenadas por valor decrescente e, em empate, por ticker. Se qualquer posição não tiver cotação, a cobertura patrimonial percentual fica indeterminada e sinais fortes de concentração são suprimidos.

### Segmentos

Segmento ausente não vira categoria econômica. A cobertura é:

```text
patrimônio com segmento conhecido / patrimônio com cotação válida × 100
```

Concentração por segmento só pode ser emitida quando todas as posições têm cotação válida e pelo menos 70% do patrimônio cotado possui segmento conhecido.

### Renda por fundo

A participação usa a renda estimada já disponível para cada posição:

```text
participação na renda (%) = renda estimada do fundo / renda estimada total × 100
```

Se qualquer posição não tiver renda estimada disponível, o total e o sinal de dependência são suprimidos. Dividendos e yields nunca são inventados.

## Qualidade e confiança

Estado geral:

- `sufficient`: tendência, concentração, segmentos e renda têm evidência suficiente e não existe ressalva estruturada;
- `partial`: existe dado utilizável, mas pelo menos uma conclusão foi suprimida ou teve confiança reduzida;
- `insufficient`: não há histórico encerrado nem posição cotada utilizável.

Confiança:

- tendência `high`: seis meses válidos e consecutivos;
- tendência `medium`: seis meses válidos com lacuna;
- tendência `low`: menos de seis meses;
- concentração `high`: todas as posições têm cotação válida;
- concentração `low`: cobertura patrimonial não comprovável;
- segmentos `high`: cobertura ≥ 95%;
- segmentos `medium`: cobertura entre 70% e 95%;
- segmentos `low`: cobertura abaixo de 70% ou cotação incompleta;
- renda `high`: todas as posições têm renda estimada e o total é positivo;
- renda `low`: cobertura incompleta ou total sem denominador válido.

Não existe score de qualidade de 0 a 100.

## Regras temporais e validação

- o calendário usa `America/Sao_Paulo`;
- competência corrente e futura não entram nos cálculos;
- mês futuro produz warning explícito;
- lacunas não são preenchidas;
- competências e posições duplicadas são rejeitadas;
- `NaN`, infinito, valor negativo, quantidade inválida e competência inválida falham fechado;
- o modo seguro da interface converte erro validado em resultado vazio, motivo `INVALID_INPUT_REJECTED` e warning, sem métrica contaminada;
- arrays recebidos não são alterados.

## Sinais e ordem

1. `DADOS_INSUFICIENTES`;
2. `CONCENTRACAO_ELEVADA`;
3. `DEPENDENCIA_DE_UM_FUNDO`;
4. `CONCENTRACAO_POR_SEGMENTO`;
5. `RENDA_EM_QUEDA`;
6. `RENDA_INSTAVEL`;
7. `MES_ATIPICO_NEGATIVO`;
8. `RENDA_EM_ALTA`;
9. `RENDA_ESTAVEL`;
10. `MES_ATIPICO_POSITIVO`.

Alta, queda e estabilidade são mutuamente exclusivos. O código do sinal é deduplicado e a ordenação possui desempate estável.

## Apresentação

O painel “O que merece atenção na sua carteira” mostra no máximo três sinais antes da expansão. Ele usa heading semântico, botão com `aria-expanded`, foco visível, tema claro/escuro e evidências textuais que não dependem somente de cor.

O painel foi incluído nesta entrega por instrução explícita da Sprint PV-2A empilhada, embora o Handoff v10.3.0 originalmente reserve a apresentação mais ampla para PV-2B. Não houve redesign dos cards, gráfico, resumo ou histórico.

## Performance e privacidade

O cálculo ocorre em memória. Ordenações tornam a complexidade `O(m log m + p log p)`, próxima de linear para `m` meses e `p` posições. O teste com 120 meses e 200 posições possui limite conservador de um segundo.

O domínio não registra logs, telemetria, e-mail, token, cookie, identificadores brutos ou valores da carteira. A interface exibe evidências somente ao próprio usuário na página privada.

## Limitações

- a cobertura patrimonial não é estimada quando existe posição sem cotação;
- a renda por fundo usa a estimativa corrente disponível, não atribuição histórica por competência;
- são necessários sete meses válidos para avaliar o primeiro mês atípico, pois seis formam a baseline;
- o núcleo não explica causalidade;
- a camada generativa futura deverá consumir apenas métricas e sinais prontos e não poderá recalcular valores.
