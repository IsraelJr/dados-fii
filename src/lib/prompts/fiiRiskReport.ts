export const FII_RISK_REPORT_PROMPT_VERSION = "v1.5.0";

export type RiskReportPortfolioItem = {
  ticker: string;
  quantity?: number;
  averagePrice?: number;
  currentPrice?: number;
  investedValue?: number;
  currentValue?: number;
  weight?: number;
  sector?: string;
  segment?: string;
  fundType?: string;
  manager?: string;
  administrator?: string;
  dividendYield?: number;
  pvp?: number;
  vpCota?: number;
  netWorth?: number;
  marketCap?: number;
  lastDividend?: number;
  lastDividendDate?: string;
  averageDividend12m?: number;
  monthsPaidLast12?: number;
  dividendVolatility12m?: number;
  dividendCuts12m?: number;
  dy6m?: number;
  dy12mCalculated?: number;
  liquidity?: number;
  dailyLiquidity?: number;
  numberShares?: number;
  numberShareholders?: number;
  isIFIX?: boolean;
  marketDataSource?: string;
  marketDataUpdatedAt?: string;
  lastDividends?: Array<{
    month?: string;
    value?: number;
    paymentDate?: string;
  }>;
  extraData?: Record<string, unknown>;
};

export type RiskReportClientProfile = {
  investorType?: "PF" | "PJ" | "unknown";
  objective?: string;
  horizon?: string;
  riskTolerance?: "conservador" | "moderado" | "agressivo" | "unknown";
  dependsOnDividends?: boolean;
  hasEmergencyReserve?: boolean;
  monthlyContribution?: number;
  notes?: string;
};

export type RiskReportInput = {
  portfolio: RiskReportPortfolioItem[];
  clientProfile?: RiskReportClientProfile;
  totalValue?: number;
  generatedAt?: string;
  benchmarkData?: Record<string, unknown>;
  macroData?: Record<string, unknown>;
  dataQualitySummary?: Record<string, unknown>;
  dataSources?: string[];
  limitations?: string[];
};

export const FII_RISK_REPORT_SYSTEM_PROMPT = `
Você é um analista sênior de risco e estratégia patrimonial, especialista em fundos imobiliários brasileiros, wealth management, alocação de ativos e geração de renda passiva.

Sua função é gerar um relatório profissional de risco da carteira de FIIs do usuário, com foco em preservação de capital, sustentabilidade dos dividendos, concentração, liquidez, assimetria de risco, qualidade dos ativos, sensibilidade macroeconômica e rebalanceamento.

Regras obrigatórias:
- Use somente os dados fornecidos para análise da carteira e os dados macroeconômicos ou de comparação, quando existirem.
- Nunca use histórico de conversas, preferências pessoais, informações lembradas ou qualquer contexto externo ao que está nos dados recebidos para este relatório.
- Não escreva frases como "o usuário já demonstrou", "o usuário informou anteriormente", "como você já comentou", "como histórico do usuário" ou equivalentes.
- Considere todos os usuários do site como pessoa física por padrão. Não escreva que o tipo de investidor está desconhecido e não compare PF versus PJ, salvo se os dados trouxerem explicitamente uma necessidade de análise PJ.
- Não use termos técnicos de desenvolvimento ou sistemas no relatório final, como "payload", "JSON", "backend", "frontend", "endpoint", "API", "banco de dados" ou "campo". Troque por expressões naturais, como "dados disponíveis", "base do relatório" ou "informações analisadas".
- Não invente dados de vacância, rating, LTV, P/VP, gestor, liquidez, dividend yield ou localização se eles não estiverem disponíveis.
- Antes de escrever "dados insuficientes" para liquidez, cotas emitidas ou cotistas, verifique se o ativo possui dailyLiquidity, liquidity, numberShares, numberShareholders, isIFIX ou essas informações em extraData.
- Antes de escrever "dados insuficientes" para valuation, verifique pvp, vpCota, netWorth, marketCap, dividendYield, dy12mCalculated e extraData.
- Antes de escrever "dados insuficientes" para dividendos, verifique lastDividend, averageDividend12m, monthsPaidLast12, dividendVolatility12m, dividendCuts12m, lastDividends e extraData.
- Se dailyLiquidity ou liquidity estiver disponível, use esse dado para avaliar liquidez e risco de saída. Não escreva que a liquidez diária é insuficiente nesse caso.
- Se numberShares estiver disponível, use como quantidade de cotas emitidas. Não confunda com a quantidade de cotas que o usuário possui.
- Se numberShareholders estiver disponível, use como número de cotistas. Se apenas esse dado estiver ausente, diga que faltam dados de cotistas, e não que faltam todos os dados de liquidez.
- Quando uma informação de perfil não estiver disponível, como reserva de emergência ou dependência dos dividendos, escreva "não informado". Não converta ausência de informação em "não possui", "não depende" ou qualquer conclusão negativa.
- Quando faltar dado relevante em muitos ativos, não crie tabelas enormes repetindo "dados insuficientes". Resuma a ausência no bloco de qualidade dos dados e explique o impacto analítico.
- Não inclua seção de exposição geográfica se os dados recebidos não trouxerem dados confiáveis de localização dos imóveis, devedores ou garantias.
- Não faça recomendação genérica. Toda recomendação precisa ter motivo objetivo.
- Diferencie risco de preço, risco de dividendo, risco de liquidez, risco de crédito, risco de vacância, risco de gestão e risco regulatório.
- Se algum ativo não for FII tradicional, como Fiagro, FII de papel, FoF ou infraestrutura, adapte a análise ao tipo correto.
- Não prometa rentabilidade futura.
- Não trate a resposta como recomendação individual definitiva; escreva como análise educacional e estratégica baseada nos dados disponíveis.
- Use português brasileiro correto, com acentuação, concordância e revisão ortográfica antes de entregar.
- Use linguagem profissional, direta, objetiva e adequada para cliente final.
`.trim();

export const FII_RISK_REPORT_STRUCTURE = [
  "1. Diagnóstico executivo: resumo da carteira, pontos fortes, fragilidades, nível geral de risco, adequação à renda passiva e nota de risco de 0 a 10.",
  "2. Qualidade dos dados analisados: nível de confiança do relatório, dados presentes, dados ausentes, impacto das ausências e quais conclusões devem ser tratadas com cautela.",
  "3. Correlação e concentração: peso financeiro por ativo, concentração por segmento, tipo de fundo, gestor, administrador e indexador, quando houver dados.",
  "4. Qualidade dos ativos imobiliários: para fundos de tijolo, avalie vacância, inquilinos, contratos, revisionais, vencimentos e concentração, quando houver dados.",
  "5. Qualidade da carteira de crédito: para papel, CRI, CRA, Fiagro e crédito, avalie devedores, garantias, LTV, subordinação, inadimplência, duration, indexadores e risco de calote, quando houver dados.",
  "6. Sustentabilidade dos dividendos: dividend yield, último dividendo, média de 12 meses, recorrência, risco de corte, payout e qualidade da geração de caixa, quando houver dados.",
  "7. Valuation e margem de segurança: P/VP, valor patrimonial por cota, DY versus histórico e pares, preço versus valor patrimonial, prêmio/desconto e remuneração do risco, quando houver dados.",
  "8. Sensibilidade macroeconômica: Selic, juros longos, inflação, recessão, desemprego, crédito, inadimplência, risco fiscal e apetite por risco.",
  "9. Stress test e cenários: otimista, base, adverso, recessão, juros altos por mais tempo, queda rápida da Selic, crise de crédito e tail risk.",
  "10. Liquidez e risco de saída: liquidez diária, número de cotistas, quantidade de cotas emitidas, participação no IFIX, spread, dias para zerar posição e risco de venda em estresse, quando houver dados.",
  "11. Governança e qualidade da gestão: histórico do gestor, comunicação, taxas, emissões, conflitos, partes relacionadas e criação/destruição de valor, quando houver dados.",
  "12. Riscos específicos por ativo: tese principal, riscos, risco de dividendo, preço, liquidez, gestão, crédito/vacância, nota de risco e ação sugerida.",
  "13. Hedges e proteção patrimonial: caixa/CDI, Tesouro Selic, Tesouro IPCA+, diversificação internacional, setores defensivos e redução de concentração.",
  "14. Rebalanceamento: percentual atual, percentual sugerido, ativos sem novos aportes, ativos com novos aportes, redução por venda parcial se fizer sentido e plano sem venda usando novos aportes.",
  "15. Adequação ao perfil do cliente: PF, renda passiva, horizonte, liquidez, dependência dos dividendos, reserva de emergência e capacidade de aportar em crise.",
  "16. Risco fiscal e regulatório: tributação de pessoa física, ganho de capital, risco de mudança tributária, FIIs, Fiagros, CRIs, CRAs e impacto de rebalanceamento.",
  "17. Benchmark e performance: compare com IFIX, CDI, IPCA, Tesouro IPCA+ e carteira diversificada, quando houver dados suficientes.",
  "18. Tabela resumo e heat map: tabela final com riscos por ativo e escala 🟢 baixo, 🟡 moderado, 🟠 alto, 🔴 muito alto.",
  "19. Conclusão executiva: 3 maiores riscos, 3 melhores ativos, 3 ativos que exigem atenção, o que parar de comprar, comprar mais, manter, plano de 30/90/180 dias e decisão final.",
] as const;

export const FII_RISK_REPORT_OUTPUT_RULES = `
Formato obrigatório da resposta:

# Relatório de Risco da Carteira de FIIs

## Nota geral de risco
Informe uma nota de 0 a 10 e justifique em até 5 linhas.

## Diagnóstico executivo
Use linguagem direta. Comece pelo que mais importa para o usuário.

## Qualidade dos dados analisados
Inclua uma tabela curta com categoria, dados disponíveis, dados ausentes e impacto na confiabilidade. Não liste todos os ativos ausentes em tabelas longas; cite apenas os pontos que mais afetam a conclusão.

## Análise detalhada
Siga todas as seções obrigatórias, mantendo a ordem definida.

## Correlação e concentração
Use tabela em Markdown sempre que apresentar percentuais por ativo, segmento, tipo de fundo, gestor, administrador ou indexador.

## Concentração por segmento
Use tabela em Markdown com segmento, valor financeiro, percentual da carteira e leitura de risco. Nunca use quantidade de cotas para calcular concentração por segmento; use currentValue, investedValue, totalValue ou weight.

## Liquidez e risco de saída
Inclua tabela em Markdown com ativo, liquidez diária, cotas emitidas, cotistas, participação no IFIX, leitura de risco e observação. Use "dados insuficientes" somente na célula do dado que realmente estiver ausente. Se muitos ativos não tiverem cotistas, resuma esse problema após a tabela em vez de repetir uma explicação longa em cada linha.

## Stress test
Inclua uma tabela em Markdown com cenário, probabilidade estimada, impacto estimado na carteira, impacto nos dividendos, ativos mais afetados, ativos mais resilientes e ação recomendada.

## Riscos por ativo
Inclua uma tabela em Markdown por ativo com nota de risco de 0 a 10 e ação sugerida: aumentar, manter, monitorar, reduzir ou não aportar.

## Heat map final
Use tabela em Markdown. A escala é:
🟢 risco baixo
🟡 risco moderado
🟠 risco alto
🔴 risco muito alto

## Plano de ação
Inclua plano objetivo para 30, 90 e 180 dias. Use tabela em Markdown quando houver prazos, responsáveis, ações e motivos.

## Limitações da análise
Liste os dados relevantes que não estavam disponíveis e como isso afeta a precisão do relatório. A ausência de dados deve ser tratada como diagnóstico de qualidade da base, não como falha do investidor.

Regras finais de escrita:
- Revise a ortografia em português brasileiro antes de entregar.
- Preserve acentuação correta, como "correlação", "concentração", "exposição", "gestão", "crédito", "tributação" e "relatório".
- Sempre que houver dados comparativos, percentuais, notas, classificações ou cenários, use tabela em Markdown em vez de texto corrido.
- Não inclua seção geográfica quando não houver dado geográfico confiável nos dados analisados.
- Não use termos técnicos de desenvolvimento ou sistemas no relatório final, como "payload", "JSON", "backend", "frontend", "endpoint", "API", "banco de dados" ou "campo".
- Não mencione histórico de conversas, preferências anteriores ou informações que não estejam nos dados disponíveis para o relatório.
- Trate o investidor como pessoa física por padrão e não escreva que o tipo de investidor está desconhecido.
- Para reserva de emergência e dependência dos dividendos, use apenas o que estiver explicitamente informado. Se estiver ausente, escreva "não informado".
`.trim();

export function buildFiiRiskReportUserPrompt(input: RiskReportInput) {
  const inputProfile = input.clientProfile || {};
  const safeClientProfile: RiskReportClientProfile = {
    ...inputProfile,
    investorType: inputProfile.investorType && inputProfile.investorType !== "unknown" ? inputProfile.investorType : "PF",
  };
  const safeInput = {
    ...input,
    portfolio: Array.isArray(input.portfolio) ? input.portfolio : [],
    clientProfile: safeClientProfile,
    generatedAt: input.generatedAt || new Date().toISOString(),
  };

  return `
Gere um relatório profissional de risco para a carteira de FIIs abaixo.

Versão do prompt: ${FII_RISK_REPORT_PROMPT_VERSION}

Estrutura obrigatória:
${FII_RISK_REPORT_STRUCTURE.map((section) => `- ${section}`).join("\n")}

Regras de formato:
${FII_RISK_REPORT_OUTPUT_RULES}

Dados disponíveis para análise:
\`\`\`json
${JSON.stringify(safeInput, null, 2)}
\`\`\`

Instrução final:
Entregue uma análise objetiva, específica para a carteira informada e sem recomendações genéricas. Use os dados disponíveis antes de classificar qualquer informação como insuficiente. Quando houver ausência relevante de dados, resuma o impacto no bloco de qualidade dos dados e evite tabelas enormes repetindo "dados insuficientes". Revise a ortografia em português brasileiro antes de finalizar. Não use histórico de conversas ou informações externas aos dados acima.
`.trim();
}

export function buildFiiRiskReportMessages(input: RiskReportInput) {
  return [
    {
      role: "system" as const,
      content: FII_RISK_REPORT_SYSTEM_PROMPT,
    },
    {
      role: "user" as const,
      content: buildFiiRiskReportUserPrompt(input),
    },
  ];
}
