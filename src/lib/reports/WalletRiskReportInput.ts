import { getMarketBenchmarks } from "@/lib/marketBenchmarks";
import {
  buildPortfolioSnapshot,
  extractSnapshotWallet,
  saveMonthlyPortfolioSnapshot,
} from "@/lib/portfolioSnapshots";
import type {
  RiskReportClientProfile,
  RiskReportInput,
  RiskReportPortfolioItem,
} from "@/lib/prompts/fiiRiskReport";

const MAX_WALLET_ITEMS = 80;

type BuildInputArgs = {
  userDocId: string;
  email: string;
  userData: Record<string, unknown>;
};

function removeUndefinedFields<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => removeUndefinedFields(item)) as T;

  if (value && typeof value === "object" && !(value instanceof Date)) {
    if (typeof (value as { isEqual?: unknown }).isEqual === "function") return value;

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, fieldValue]) => fieldValue !== undefined)
        .map(([key, fieldValue]) => [key, removeUndefinedFields(fieldValue)]),
    ) as T;
  }

  return value;
}

function hasValue(value: unknown) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return Boolean(value);
}

function percent(value: number, total: number) {
  return total ? Number(((value / total) * 100).toFixed(1)) : 0;
}

function numberOf(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value || "").replace("R$", "").replace("%", "").trim();
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textOf(value: unknown, fallback?: string) {
  const text = typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
  return text || fallback;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeRiskTolerance(value: unknown): RiskReportClientProfile["riskTolerance"] {
  const text = String(value || "").trim().toLowerCase();
  if (text.includes("conserv")) return "conservador";
  if (text.includes("moder")) return "moderado";
  if (text.includes("agress") || text.includes("arroj")) return "agressivo";
  return "unknown";
}

function toRiskPortfolio(snapshot: Record<string, unknown>): RiskReportPortfolioItem[] {
  const assets = Array.isArray(snapshot.assets) ? snapshot.assets : [];

  return assets.map((rawAsset) => {
    const asset = rawAsset as Record<string, unknown>;
    return removeUndefinedFields({
      ticker: String(asset.ticker || ""),
      quantity: numberOf(asset.quantity) || undefined,
      averagePrice: numberOf(asset.averagePrice) || undefined,
      currentPrice: numberOf(asset.currentPrice) || undefined,
      investedValue: numberOf(asset.investedValue) || undefined,
      currentValue: numberOf(asset.currentValue) || undefined,
      weight: numberOf(asset.weight) || undefined,
      sector: String(asset.sector || "").trim() || undefined,
      segment: String(asset.segment || "").trim() || undefined,
      fundType: String(asset.fundType || "").trim() || undefined,
      manager: String(asset.manager || "").trim() || undefined,
      administrator: String(asset.administrator || "").trim() || undefined,
      dividendYield: numberOf(asset.dividendYield) || undefined,
      pvp: numberOf(asset.pvp) || undefined,
      vpCota: numberOf(asset.vpCota) || undefined,
      netWorth: numberOf(asset.netWorth) || undefined,
      marketCap: numberOf(asset.marketCap) || undefined,
      valuationDataQuality: asset.valuationDataQuality as Record<string, unknown> | undefined,
      lastDividend: numberOf(asset.lastDividend) || undefined,
      lastDividendDate: String(asset.lastDividendDate || "").trim() || undefined,
      averageDividend12m: numberOf(asset.averageDividend12m) || undefined,
      monthsPaidLast12: numberOf(asset.monthsPaidLast12) || undefined,
      dividendVolatility12m: numberOf(asset.dividendVolatility12m) || undefined,
      dividendCuts12m: numberOf(asset.dividendCuts12m) || undefined,
      dy6m: numberOf(asset.dy6m) || undefined,
      dy12mCalculated: numberOf(asset.dy12mCalculated) || undefined,
      liquidity: numberOf(asset.dailyLiquidity) || undefined,
      dailyLiquidity: numberOf(asset.dailyLiquidity) || undefined,
      numberShares: numberOf(asset.numberShares) || undefined,
      numberShareholders: numberOf(asset.numberShareholders) || undefined,
      isIFIX: typeof asset.isIFIX === "boolean" ? asset.isIFIX : undefined,
      marketDataSource: String(asset.marketDataSource || "").trim() || undefined,
      marketDataUpdatedAt: String(asset.marketDataUpdatedAt || "").trim() || undefined,
      lastDividends: Array.isArray(asset.dividendsLast12Months)
        ? asset.dividendsLast12Months as RiskReportPortfolioItem["lastDividends"]
        : undefined,
      extraData: removeUndefinedFields({
        unrealizedResult: numberOf(asset.unrealizedResult) || undefined,
        unrealizedReturn: numberOf(asset.unrealizedReturn) || undefined,
        dailyLiquidity: numberOf(asset.dailyLiquidity) || undefined,
        numberShares: numberOf(asset.numberShares) || undefined,
        numberShareholders: numberOf(asset.numberShareholders) || undefined,
        marketCap: numberOf(asset.marketCap) || undefined,
        vpCota: numberOf(asset.vpCota) || undefined,
        netWorth: numberOf(asset.netWorth) || undefined,
        lastDividend: numberOf(asset.lastDividend) || undefined,
        lastDividendDate: String(asset.lastDividendDate || "").trim() || undefined,
        averageDividend12m: numberOf(asset.averageDividend12m) || undefined,
        monthsPaidLast12: numberOf(asset.monthsPaidLast12) || undefined,
        dividendVolatility12m: numberOf(asset.dividendVolatility12m) || undefined,
        dividendCuts12m: numberOf(asset.dividendCuts12m) || undefined,
        dy6m: numberOf(asset.dy6m) || undefined,
        dy12mCalculated: numberOf(asset.dy12mCalculated) || undefined,
        isIFIX: typeof asset.isIFIX === "boolean" ? asset.isIFIX : undefined,
        marketDataSource: String(asset.marketDataSource || "").trim() || undefined,
        marketDataUpdatedAt: String(asset.marketDataUpdatedAt || "").trim() || undefined,
      }),
    } satisfies RiskReportPortfolioItem);
  });
}

export function buildPortfolioDataQuality(portfolio: RiskReportPortfolioItem[]) {
  const fields = [
    { key: "currentPrice", label: "preço atual", impact: "valuation e valor de mercado" },
    { key: "currentValue", label: "valor financeiro da posição", impact: "concentração por ativo e segmento" },
    { key: "segment", label: "segmento", impact: "concentração setorial" },
    { key: "fundType", label: "tipo de fundo", impact: "análise por categoria" },
    { key: "dailyLiquidity", label: "liquidez diária", impact: "risco de saída" },
    { key: "numberShares", label: "cotas emitidas", impact: "tamanho do fundo e liquidez estrutural" },
    { key: "numberShareholders", label: "cotistas", impact: "institucionalização e pulverização" },
    { key: "pvp", label: "P/VP", impact: "valuation e margem de segurança" },
    { key: "vpCota", label: "valor patrimonial por cota", impact: "valuation e prêmio/desconto" },
    { key: "netWorth", label: "patrimônio líquido", impact: "porte do fundo" },
    { key: "marketCap", label: "valor de mercado", impact: "porte em mercado" },
    { key: "dividendYield", label: "DY 12m informado", impact: "renda e comparação" },
    { key: "lastDividend", label: "último dividendo", impact: "renda recente" },
    { key: "averageDividend12m", label: "média de dividendos em 12 meses", impact: "sustentabilidade da renda" },
    { key: "monthsPaidLast12", label: "meses pagos em 12 meses", impact: "recorrência dos dividendos" },
    { key: "manager", label: "gestor", impact: "visibilidade de governança" },
    { key: "administrator", label: "administrador", impact: "estrutura operacional" },
  ] as const;

  const fieldCoverage = fields.map((field) => {
    const present = portfolio.filter((asset) => hasValue(asset[field.key])).length;
    return {
      field: field.label,
      present,
      missing: portfolio.length - present,
      coverage: percent(present, portfolio.length),
      impact: field.impact,
    };
  });

  const criticalFields = [
    "currentPrice",
    "currentValue",
    "segment",
    "fundType",
    "dailyLiquidity",
    "pvp",
    "vpCota",
    "dividendYield",
    "lastDividend",
    "averageDividend12m",
  ] as const;

  const criticalScore = percent(
    criticalFields.reduce(
      (sum, key) => sum + portfolio.filter((asset) => hasValue(asset[key])).length,
      0,
    ),
    Math.max(portfolio.length * criticalFields.length, 1),
  );

  return {
    totalAssets: portfolio.length,
    criticalCoverageScore: criticalScore,
    fieldCoverage,
    mainDataGaps: fieldCoverage
      .filter((field) => field.coverage < 70)
      .sort((a, b) => a.coverage - b.coverage),
    interpretation: criticalScore >= 75
      ? "Base suficiente para relatório de risco, com limitações pontuais."
      : criticalScore >= 55
        ? "Base utilizável para o relatório, mas as conclusões devem destacar limitações relevantes."
        : "Base limitada; o relatório deve reduzir o nível de confiança e priorizar as lacunas de dados.",
  };
}

export async function buildWalletRiskReportInput(args: BuildInputArgs) {
  const wallet = extractSnapshotWallet(args.userData).slice(0, MAX_WALLET_ITEMS);
  if (!wallet.length) {
    throw Object.assign(new Error("Carteira não encontrada para gerar o relatório."), { status: 404 });
  }

  const [benchmarkData, snapshot] = await Promise.all([
    getMarketBenchmarks().catch(() => ({ unavailable: true, error: "Benchmarks indisponíveis" })),
    buildPortfolioSnapshot(args.userDocId, args.email, wallet),
  ]);

  await saveMonthlyPortfolioSnapshot({
    userDocId: args.userDocId,
    email: args.email,
    wallet,
  }).catch(() => undefined);

  const cleanSnapshot = snapshot as unknown as Record<string, unknown>;
  const portfolio = toRiskPortfolio(cleanSnapshot);
  const profile = (args.userData.profile || {}) as Record<string, unknown>;
  const clientProfile: RiskReportClientProfile = {
    investorType: "PF",
    objective: textOf(args.userData.objective ?? profile.objective, "renda passiva com FIIs"),
    horizon: textOf(args.userData.horizon ?? profile.horizon, "longo prazo"),
    riskTolerance: normalizeRiskTolerance(args.userData.riskTolerance ?? profile.riskTolerance),
    dependsOnDividends: optionalBoolean(args.userData.dependsOnDividends ?? profile.dependsOnDividends),
    hasEmergencyReserve: optionalBoolean(args.userData.hasEmergencyReserve ?? profile.hasEmergencyReserve),
    monthlyContribution: numberOf(args.userData.monthlyContribution ?? profile.monthlyContribution) || undefined,
    notes: textOf(args.userData.profileNotes ?? profile.notes),
  };

  const input: RiskReportInput = removeUndefinedFields({
    portfolio,
    totalValue: numberOf(cleanSnapshot.totalValue) || undefined,
    generatedAt: new Date().toISOString(),
    benchmarkData: benchmarkData as unknown as Record<string, unknown>,
    dataQualitySummary: buildPortfolioDataQuality(portfolio),
    clientProfile,
    dataSources: [
      "Carteira salva do usuário no Dados FII",
      "Base de FIIs do Dados FII enriquecida com indicadores derivados",
      "Benchmarks de mercado em cache: IFIX, CDI, IPCA e Selic, quando disponíveis",
    ],
    limitations: [
      "A análise depende dos dados disponíveis e validados no Dados FII.",
      "A análise de performance fica mais precisa conforme o histórico mensal da carteira aumenta.",
      "Quando algum benchmark não estiver disponível, o relatório deve informar a limitação sem inventar comparação.",
      "Dados avançados como vacância, inquilinos, LTV, duration e inadimplência podem estar ausentes para alguns fundos.",
    ],
  });

  return {
    input,
    portfolio,
    snapshot: cleanSnapshot,
    benchmarkData,
    dataQualitySummary: input.dataQualitySummary,
    wallet,
  };
}

export { removeUndefinedFields };
