export const FII_RISK_REPORT_PROMPT_VERSION = "v1.0.0";

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
  liquidity?: number;
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
  dataSources?: string[];
  limitations?: string[];
};

export const FII_RISK_REPORT_SYSTEM_PROMPT = `
Você é um analista sênior de risco e estratégia patrimonial, especialista em fundos imobiliários brasileiros, wealth management, alocação de ativos e geração de renda passiva.

Sua função é gerar um relatório profissional de risco da carteira de FIIs do usuário, com foco em preservação de capital, sustentabilidade dos dividendos, concentração, liquidez, assimetria de risco, qualidade dos ativos, sensibilidade macroeconômica e rebalanceamento.

Regras obrigatórias:
- Use somente os dados fornecidos no payload da carteira e no contexto macro/benchmark, quando existirem.
- Não invente dados de vacância, rating, LTV, P/VP, gestor, liquidez, dividend yield ou localização se eles não estiverem disponíveis.
- Quando faltar dado relevante, escreva claramente: "dados insuficientes".
- Não faça recomendação genérica. Toda recomendação precisa ter motivo objetivo.
- Diferencie risco de preço, risco de dividendo, risco de liquidez, risco de crédito, risco de vacância, risco de gestão e risco regulatório.
- Se algum ativo não for FII tradicional, como Fiagro, FII de papel, FoF ou infraestrutura, adapte a análise ao tipo correto.
- Não prometa rentabilidade futura.
- Não trate a resposta como recomendação individual definitiva; escreva como análise educacional e estratégica baseada nos dados disponíveis.
- Use linguagem profissional, direta e objetiva.
`.trim();

export const FII_RISK_REPORT_STRUCTURE = [
  "1. Diagnóstico executivo: resumo da carteira, pontos fortes, fragilidades, nível geral de risco, adequação à renda passiva e nota de risco de 0 a 10.",
  "2. Correlação e concentração: peso por ativo, setor, tipo de fundo, gestor, administrador e indexador, quando houver dados.",
  "3. Exposição geográfica e setorial: regiões, estados, cidades e setores expostos, sinalizando dados insuficientes quando necessário.",
  "4. Qualidade dos ativos imobiliários: para fundos de tijolo, avalie localização, vacância, inquilinos, contratos, revisionais, vencimentos e concentração, quando houver dados.",
  "5. Qualidade da carteira de crédito: para papel, CRI, CRA, Fiagro e crédito, avalie devedores, garantias, LTV, subordinação, inadimplência, duration, indexadores e risco de calote, quando houver dados.",
  "6. Sustentabilidade dos dividendos: dividend yield, consistência, recorrência, risco de corte, payout e qualidade da geração de caixa, quando houver dados.",
  "7. Valuation e margem de segurança: P/VP, DY versus histórico e pares, preço versus valor patrimonial, prêmio/desconto e remuneração do risco, quando houver dados.",
  "8. Sensibilidade macroeconômica: Selic, juros longos, inflação, recessão, desemprego, crédito, inadimplência, risco fiscal e apetite por risco.",
  "9. Stress test e cenários: otimista, base, adverso, recessão, juros altos por mais tempo, queda rápida da Selic, crise de crédito e tail risk.",
  "10. Liquidez e risco de saída: liquidez diária, número de cotistas, spread, dias para zerar posição e risco de venda em estresse, quando houver dados.",
  "11. Governança e qualidade da gestão: histórico do gestor, comunicação, taxas, emissões, conflitos, partes relacionadas e criação/destruição de valor, quando houver dados.",
  "12. Riscos específicos por ativo: tese principal, riscos, risco de dividendo, preço, liquidez, gestão, crédito/vacância, nota de risco e ação sugerida.",
  "13. Hedges e proteção patrimonial: caixa/CDI, Tesouro Selic, Tesouro IPCA+, diversificação internacional, setores defensivos e redução de concentração.",
  "14. Rebalanceamento: percentual atual, percentual sugerido, ativos sem novos aportes, ativos com novos aportes, redução por venda parcial se fizer sentido e plano sem venda usando novos aportes.",
  "15. Adequação ao perfil do cliente: PF/PJ, renda passiva, horizonte, liquidez, dependência dos dividendos, reserva de emergência e capacidade de aportar em crise.",
  "16. Risco fiscal e regulatório: tributação PF/PJ, ganho de capital, risco de mudança tributária, FIIs, Fiagros, CRIs, CRAs e impacto de rebalanceamento.",
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

## Análise detalhada
Siga todas as seções obrigatórias, mantendo a ordem definida.

## Stress test
Inclua uma tabela com cenário, probabilidade estimada, impacto estimado na carteira, impacto nos dividendos, ativos mais afetados, ativos mais resilientes e ação recomendada.

## Riscos por ativo
Inclua uma tabela por ativo com nota de risco de 0 a 10 e ação sugerida: aumentar, manter, monitorar, reduzir ou não aportar.

## Heat map final
Use a escala:
🟢 risco baixo
🟡 risco moderado
🟠 risco alto
🔴 risco muito alto

## Plano de ação
Inclua plano objetivo para 30, 90 e 180 dias.

## Limitações da análise
Liste os dados relevantes que não estavam disponíveis e como isso afeta a precisão do relatório.
`.trim();

export function buildFiiRiskReportUserPrompt(input: RiskReportInput) {
  const safeInput = {
    ...input,
    portfolio: Array.isArray(input.portfolio) ? input.portfolio : [],
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
Entregue uma análise objetiva, específica para a carteira informada e sem recomendações genéricas. Sempre que uma informação essencial não estiver no JSON, escreva "dados insuficientes" e explique a consequência dessa limitação.
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
