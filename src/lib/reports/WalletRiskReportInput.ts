import { deriveFiiRiskData } from "@/lib/fiiDerivedData";
import { getMarketBenchmarks } from "@/lib/marketBenchmarks";
import { extractSnapshotWallet } from "@/lib/portfolioSnapshots";
import type {
  RiskReportClientProfile,
  RiskReportInput,
  RiskReportPortfolioItem,
} from "@/lib/prompts/fiiRiskReport";

const MAX_WALLET_ITEMS = 80;
const SHEET_RANGE = "A1:F400";
const TIME_ZONE = "America/Sao_Paulo";

export type WalletRiskFundLoader = (
  ticker: string,
) => Promise<Record<string, unknown> | null | undefined>;

type BuildInputArgs = {
  userDocId: string;
  email: string;
  userData: Record<string, unknown>;
  fundLoader: WalletRiskFundLoader;
  asOf?: Date;
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
  const numeric = raw.replace(/[^0-9.,-]/g, "");
  const normalized = numeric.includes(",")
    ? numeric.replace(/\./g, "").replace(",", ".")
    : numeric.replace(/\.(?=\d{3}(\D|$))/g, "");
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

function valueAtPath(data: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, data);
}

function firstNumber(data: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = numberOf(valueAtPath(data, path));
    if (Number.isFinite(value) && value > 0) return value;
  }
  return undefined;
}

function firstText(data: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = textOf(valueAtPath(data, path));
    if (value) return value;
  }
  return undefined;
}

function normalizeRiskTolerance(value: unknown): RiskReportClientProfile["riskTolerance"] {
  const text = String(value || "").trim().toLowerCase();
  if (text.includes("conserv")) return "conservador";
  if (text.includes("moder")) return "moderado";
  if (text.includes("agress") || text.includes("arroj")) return "agressivo";
  return "unknown";
}

function dateParts(date: Date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date).map((part) => [part.type, part.value]),
  );
}

async function getSheetPrices() {
  const sheetId = process.env.SHEET_ID;
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  const prices = new Map<string, number>();
  if (!sheetId || !apiKey) return prices;

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_RANGE}?key=${apiKey}&t=${Date.now()}`;
    const response = await fetch(url, { cache: "no-store" });
    const payload = await response.json();
    const [, ...rows] = Array.isArray(payload?.values) ? payload.values : [];
    for (const row of rows) {
      const ticker = String(row?.[0] || "").trim().toUpperCase();
      const price = numberOf(row?.[1]);
      if (ticker && price > 0) prices.set(ticker, price);
    }
  } catch (error) {
    console.error("Wallet risk report price sheet error:", error);
  }

  return prices;
}

function calculatedMarketCap(currentPrice?: number, numberShares?: number) {
  if (!currentPrice || !numberShares || currentPrice <= 0 || numberShares <= 0) return undefined;
  return Number((currentPrice * numberShares).toFixed(2));
}

function marketMetrics(data: Record<string, unknown>) {
  return removeUndefinedFields({
    dailyLiquidity: firstNumber(data, [
      "dailyLiquidity", "liquidity", "averageDailyLiquidity", "avgDailyLiquidity",
      "volumeMedioDiario", "liquidezDiaria", "marketData.dailyLiquidity", "marketData.liquidity",
    ]),
    numberShares: firstNumber(data, [
      "numberShares", "sharesOutstanding", "numberOfShares", "quotasIssued",
      "issuedQuotas", "cotasEmitidas", "numeroCotas", "marketData.numberShares",
    ]),
    numberShareholders: firstNumber(data, [
      "numberCotistas", "numberShareholders", "shareholders", "shareholdersCount",
      "cotistas", "numeroCotistas", "investorsCount", "marketData.numberCotistas",
    ]),
    isIFIX: Boolean(data.isIFIX || data.ifix || valueAtPath(data, "marketData.isIFIX")) || undefined,
    marketDataSource: firstText(data, ["marketDataSource", "marketData.source", "source"]),
    marketDataUpdatedAt: firstText(data, ["marketDataUpdatedAt", "marketData.updatedAt"]),
  });
}

async function buildSnapshot(args: BuildInputArgs, calculationAsOf: Date) {
  const wallet = extractSnapshotWallet(args.userData).slice(0, MAX_WALLET_ITEMS);
  if (!wallet.length) {
    throw Object.assign(new Error("Carteira não encontrada para gerar o relatório."), { status: 404 });
  }

  const sheetPrices = await getSheetPrices();
  const assets = await Promise.all(wallet.map(async (item) => {
    const data = (await args.fundLoader(item.ticker)) || {};
    const derived = deriveFiiRiskData(data as never, { asOf: calculationAsOf }) as Record<string, any>;
    const metrics = marketMetrics(data);
    const currentPrice = sheetPrices.get(item.ticker)
      || firstNumber(data, ["price", "currentPrice", "cotacao", "marketData.price"]);
    const averagePrice = item.averagePrice && item.averagePrice > 0 ? item.averagePrice : undefined;
    const currentValue = currentPrice ? currentPrice * item.quotas : undefined;
    const investedValue = averagePrice ? averagePrice * item.quotas : undefined;
    const marketCap = calculatedMarketCap(currentPrice, metrics.numberShares)
      || numberOf(derived.valuation?.marketCap || derived.marketCap)
      || undefined;

    return removeUndefinedFields({
      ticker: item.ticker,
      quantity: item.quotas,
      averagePrice,
      currentPrice,
      investedValue,
      currentValue,
      unrealizedResult: investedValue && currentValue
        ? Number((currentValue - investedValue).toFixed(2))
        : undefined,
      unrealizedReturn: investedValue && currentValue
        ? Number((((currentValue / investedValue) - 1) * 100).toFixed(2))
        : undefined,
      sector: firstText(data, ["sector", "setor"]) || textOf(derived.sector),
      segment: firstText(data, ["segment_new", "segment", "segmento"]),
      fundType: firstText(data, ["fundType", "type", "tipo", "tipoFundo"]) || textOf(derived.fundType),
      manager: firstText(data, ["manager", "gestor", "management"]),
      administrator: firstText(data, ["administrator", "administrador"]),
      dividendYield: firstNumber(data, ["dividendYield", "dy", "DY", "dy12m", "dividendYield12m", "valuation.dy12m"])
        || numberOf(derived.valuation?.dy12m)
        || undefined,
      pvp: numberOf(derived.valuation?.pvp) || undefined,
      vpCota: numberOf(derived.valuation?.vpCota) || undefined,
      netWorth: numberOf(derived.valuation?.netWorth) || undefined,
      marketCap,
      valuationDataQuality: derived.valuation?.dataQuality,
      lastDividend: firstNumber(data, ["lastDividend", "ultimoRendimento", "dividends.lastDividend"])
        || numberOf(derived.lastDividend)
        || undefined,
      lastDividendDate: firstText(data, ["lastDividendDate", "ultimaDataPagamento", "dividends.lastDividendDate"])
        || textOf(derived.lastDividendDate),
      averageDividend12m: firstNumber(data, ["averageDividend12m", "mediaDividendos12m", "dividends.average12m"])
        || numberOf(derived.averageDividend12m)
        || undefined,
      monthsPaidLast12: firstNumber(data, ["monthsPaidLast12", "mesesPagos12m", "dividends.monthsPaidLast12"])
        || numberOf(derived.monthsPaidLast12)
        || undefined,
      dividendVolatility12m: firstNumber(data, ["dividendVolatility12m", "volatilidadeDividendos12m", "dividends.volatility12m"])
        || numberOf(derived.dividendVolatility12m)
        || undefined,
      dividendCuts12m: firstNumber(data, ["dividendCuts12m", "cortesDividendos12m", "dividends.cuts12m"])
        || numberOf(derived.dividendCuts12m)
        || undefined,
      dy6m: firstNumber(data, ["dy6m", "dividendYield6m", "valuation.dy6m", "valuation.dy6mAnnualized"])
        || numberOf(derived.dy6m)
        || undefined,
      dy12mCalculated: numberOf(derived.dy12mCalculated) || undefined,
      dividendsLast12Months: Array.isArray(derived.dividends?.dividendsLast12Months)
        ? derived.dividends.dividendsLast12Months
        : undefined,
      ...metrics,
    });
  }));

  const totalValue = assets.reduce((sum, asset) => sum + numberOf(asset.currentValue), 0);
  const investedValue = assets.reduce((sum, asset) => sum + numberOf(asset.investedValue), 0);
  const bySegment = new Map<string, number>();
  const byAsset = new Map<string, number>();

  for (const asset of assets) {
    const value = numberOf(asset.currentValue);
    if (!value) continue;
    const segment = textOf(asset.segment || asset.sector, "Sem segmento") as string;
    bySegment.set(segment, (bySegment.get(segment) || 0) + value);
    byAsset.set(asset.ticker, value);
  }

  const parts = dateParts(calculationAsOf);
  const snapshot = removeUndefinedFields({
    userDocId: args.userDocId,
    email: args.email,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    month: `${parts.year}-${parts.month}`,
    cadence: "on_demand_risk_report",
    totalValue: Number(totalValue.toFixed(2)),
    investedValue: investedValue ? Number(investedValue.toFixed(2)) : undefined,
    unrealizedResult: investedValue && totalValue
      ? Number((totalValue - investedValue).toFixed(2))
      : undefined,
    unrealizedReturn: investedValue && totalValue
      ? Number((((totalValue / investedValue) - 1) * 100).toFixed(2))
      : undefined,
    assetCount: assets.length,
    assets: assets.map((asset) => ({
      ...asset,
      weight: totalValue > 0 && asset.currentValue
        ? Number(((numberOf(asset.currentValue) / totalValue) * 100).toFixed(2))
        : undefined,
    })),
    allocation: {
      bySegment: [...bySegment.entries()].map(([segment, value]) => ({
        segment,
        value: Number(value.toFixed(2)),
        weight: percent(value, totalValue),
      })).sort((a, b) => b.weight - a.weight),
      byAsset: [...byAsset.entries()].map(([ticker, value]) => ({
        ticker,
        value: Number(value.toFixed(2)),
        weight: percent(value, totalValue),
      })).sort((a, b) => b.weight - a.weight),
    },
  });

  return { wallet, snapshot };
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
      sector: textOf(asset.sector),
      segment: textOf(asset.segment),
      fundType: textOf(asset.fundType),
      manager: textOf(asset.manager),
      administrator: textOf(asset.administrator),
      dividendYield: numberOf(asset.dividendYield) || undefined,
      pvp: numberOf(asset.pvp) || undefined,
      vpCota: numberOf(asset.vpCota) || undefined,
      netWorth: numberOf(asset.netWorth) || undefined,
      marketCap: numberOf(asset.marketCap) || undefined,
      valuationDataQuality: asset.valuationDataQuality as Record<string, unknown> | undefined,
      lastDividend: numberOf(asset.lastDividend) || undefined,
      lastDividendDate: textOf(asset.lastDividendDate),
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
      marketDataSource: textOf(asset.marketDataSource),
      marketDataUpdatedAt: textOf(asset.marketDataUpdatedAt),
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
        isIFIX: typeof asset.isIFIX === "boolean" ? asset.isIFIX : undefined,
        marketDataSource: textOf(asset.marketDataSource),
        marketDataUpdatedAt: textOf(asset.marketDataUpdatedAt),
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
    "currentPrice", "currentValue", "segment", "fundType", "dailyLiquidity",
    "pvp", "vpCota", "dividendYield", "lastDividend", "averageDividend12m",
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
  const calculationAsOf = args.asOf ? new Date(args.asOf.getTime()) : new Date();
  const [{ unavailable: benchmarkUnavailable, ...benchmarkData }, built] = await Promise.all([
    getMarketBenchmarks()
      .then((data) => ({ unavailable: false, ...data }))
      .catch(() => ({ unavailable: true, error: "Benchmarks indisponíveis" })),
    buildSnapshot(args, calculationAsOf),
  ]);

  const cleanSnapshot = built.snapshot as Record<string, unknown>;
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
  const benchmarkPayload = benchmarkUnavailable
    ? { unavailable: true, ...benchmarkData }
    : benchmarkData;

  const input: RiskReportInput = removeUndefinedFields({
    portfolio,
    totalValue: numberOf(cleanSnapshot.totalValue) || undefined,
    generatedAt: calculationAsOf.toISOString(),
    benchmarkData: benchmarkPayload as Record<string, unknown>,
    dataQualitySummary: buildPortfolioDataQuality(portfolio),
    clientProfile,
    dataSources: [
      "Carteira salva do usuário no Dados FII",
      "RegulatoryDataService e indicadores determinísticos do Dados FII",
      "Planilha de cotações configurada, quando disponível",
      "Benchmarks em cache: IFIX, CDI, IPCA e Selic, quando disponíveis",
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
    benchmarkData: benchmarkPayload,
    dataQualitySummary: input.dataQualitySummary,
    wallet: built.wallet,
  };
}

export { removeUndefinedFields };
