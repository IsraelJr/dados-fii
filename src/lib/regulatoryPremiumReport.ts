import type { RegulatoryInsight, RegulatoryInsightSnapshot } from "@/lib/regulatoryInsights";

export type PremiumReportInput = {
  ticker: string;
  fund: {
    name?: string | null;
    sector?: string | null;
    segment?: string | null;
    price?: number | null;
    lastDividend?: number | null;
    lastDividendDate?: string | null;
    regulatoryData?: {
      source?: string | null;
      monthlyHistory?: RegulatoryInsightSnapshot[];
      documents?: Array<Record<string, any>>;
      quality?: Record<string, any>;
    } | null;
  };
  deterministicAnalysis: {
    facts: Record<string, any>;
    scores: Record<string, number>;
    insights: RegulatoryInsight[];
    generatedBy?: string;
  };
};

function number(value: unknown, digits = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "não disponível";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(numeric);
}

function currency(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "não disponível";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(numeric);
}

function percent(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "não disponível";
  return `${numeric > 0 ? "+" : ""}${numeric.toFixed(2).replace(".", ",")}%`;
}

function severityLabel(value: RegulatoryInsight["severity"]) {
  if (value === "risk") return "Risco";
  if (value === "attention") return "Atenção";
  if (value === "positive") return "Positivo";
  return "Neutro";
}

function documentLabel(document: Record<string, any>, index: number) {
  return String(
    document.title
      || document.documentType
      || document.category
      || document.fileName
      || `Documento oficial ${index + 1}`
  );
}

export function buildPremiumRegulatoryReport(input: PremiumReportInput) {
  const ticker = String(input.ticker || "").trim().toUpperCase();
  if (!ticker) throw new Error("Ticker obrigatório para o relatório Premium.");

  const facts = input.deterministicAnalysis?.facts || {};
  const scores = input.deterministicAnalysis?.scores || {};
  const insights = Array.isArray(input.deterministicAnalysis?.insights)
    ? input.deterministicAnalysis.insights
    : [];
  const regulatoryData = input.fund?.regulatoryData || null;
  const history = Array.isArray(regulatoryData?.monthlyHistory)
    ? regulatoryData.monthlyHistory
    : [];
  const documents = Array.isArray(regulatoryData?.documents)
    ? regulatoryData.documents
    : [];
  const attention = insights.filter((item) => item.severity === "attention" || item.severity === "risk");
  const positives = insights.filter((item) => item.severity === "positive");

  const sections = {
    executiveSummary: [
      `${ticker}${input.fund?.name ? ` — ${input.fund.name}` : ""}.`,
      `Foram analisadas ${number(facts.monthsAnalyzed)} competências regulatórias, de ${facts.firstReferenceDate || "data não disponível"} até ${facts.latestReferenceDate || "data não disponível"}.`,
      `O score geral é ${number(scores.overall)}, com qualidade dos dados em ${number(scores.dataQuality)}, estabilidade em ${number(scores.stability)} e risco observado em ${number(scores.risk)}.`,
    ].join(" "),
    patrimonialTrend: {
      latestNetWorth: facts.latestNetWorth ?? null,
      netWorthChangePct: facts.netWorthChangePct ?? null,
      latestVpCota: facts.latestVpCota ?? null,
      vpCotaChangePct: facts.vpCotaChangePct ?? null,
      latestSharesOutstanding: facts.latestSharesOutstanding ?? null,
      sharesChangePct: facts.sharesChangePct ?? null,
      interpretation: `O patrimônio líquido mais recente é ${currency(facts.latestNetWorth)}, com variação de ${percent(facts.netWorthChangePct)} no período. O VP por cota está em ${currency(facts.latestVpCota)}, com variação de ${percent(facts.vpCotaChangePct)}.`,
    },
    investorBase: {
      latestShareholders: facts.latestShareholders ?? null,
      shareholdersChangePct: facts.shareholdersChangePct ?? null,
      interpretation: `A base mais recente informa ${number(facts.latestShareholders)} cotistas e variação de ${percent(facts.shareholdersChangePct)} no período analisado.`,
    },
    riskSignals: attention,
    positiveSignals: positives,
    officialDocuments: documents.slice(0, 12).map((document, index) => ({
      title: documentLabel(document, index),
      referenceDate: document.deliveryDate || document.referenceDate || null,
      category: document.documentType || document.category || null,
      sourceUrl: document.sourceUrl || document.url || null,
    })),
    bullCase: positives.length
      ? positives.map((item) => item.detail)
      : ["Não há evidências regulatórias suficientes para construir um caso otimista específico sem inferências adicionais."],
    bearCase: attention.length
      ? attention.map((item) => item.detail)
      : ["Os dados regulatórios analisados não apontam alerta material, mas isso não elimina riscos de mercado, crédito, liquidez ou gestão."],
    monitoringPoints: [
      "Acompanhar a próxima competência regulatória e comparar patrimônio, cotas e VP por cota.",
      "Confrontar mudanças relevantes na quantidade de cotas com emissões, amortizações ou reorganizações divulgadas.",
      "Ler os documentos oficiais recentes antes de qualquer decisão de investimento.",
      "Separar mudanças patrimoniais de oscilações de preço de mercado e dividendos.",
    ],
  };

  const markdown = `# Relatório regulatório Premium — ${ticker}\n\n` +
    `## Resumo executivo\n${sections.executiveSummary}\n\n` +
    `## Tendência patrimonial\n${sections.patrimonialTrend.interpretation}\n\n` +
    `- Patrimônio líquido: ${currency(facts.latestNetWorth)}\n` +
    `- Variação do patrimônio: ${percent(facts.netWorthChangePct)}\n` +
    `- VP por cota: ${currency(facts.latestVpCota)}\n` +
    `- Variação do VP por cota: ${percent(facts.vpCotaChangePct)}\n` +
    `- Cotas emitidas: ${number(facts.latestSharesOutstanding)}\n` +
    `- Variação das cotas: ${percent(facts.sharesChangePct)}\n\n` +
    `## Base de investidores\n${sections.investorBase.interpretation}\n\n` +
    `## Sinais de risco e atenção\n${attention.length ? attention.map((item) => `- **${severityLabel(item.severity)} — ${item.title}:** ${item.detail}`).join("\n") : "- Nenhum alerta regulatório material foi identificado no período analisado."}\n\n` +
    `## Sinais positivos\n${positives.length ? positives.map((item) => `- **${item.title}:** ${item.detail}`).join("\n") : "- Não há sinal positivo específico suficiente para destacar."}\n\n` +
    `## Cenário favorável\n${sections.bullCase.map((item) => `- ${item}`).join("\n")}\n\n` +
    `## Cenário adverso\n${sections.bearCase.map((item) => `- ${item}`).join("\n")}\n\n` +
    `## Pontos de monitoramento\n${sections.monitoringPoints.map((item) => `- ${item}`).join("\n")}\n\n` +
    `## Documentos oficiais vinculados\n${sections.officialDocuments.length ? sections.officialDocuments.map((item) => `- ${item.title}${item.referenceDate ? ` — ${item.referenceDate}` : ""}`).join("\n") : "- Nenhum documento oficial vinculado foi publicado na base revisada."}\n\n` +
    `---\nFonte: ${regulatoryData?.source || "base regulatória oficial revisada"}. Relatório determinístico; não constitui recomendação de investimento.`;

  return {
    ticker,
    version: "premium-regulatory-report-v1",
    generatedBy: "deterministic-regulatory-engine",
    generatedAt: new Date().toISOString(),
    source: regulatoryData?.source || null,
    facts,
    scores,
    sections,
    markdown,
    aiEnrichment: {
      status: "not_requested",
      allowedSources: ["published_regulatory_data", "official_documents"],
      mayInventMissingData: false,
    },
  };
}
