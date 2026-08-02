const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MIN_AGGREGATE_VALUE = 1_000_000;
const MAX_PVP = 10;
const MIN_PVP = 0.1;
const MIN_VP_COTA = 0.01;
const MAX_VP_COTA = 100_000;

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

function positiveNumberOf(value: unknown) {
  const parsed = numberOf(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function normalizeText(value: unknown) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function round(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function valueAtPath(data: any, path: string) {
  return path.split(".").reduce((current, key) => current?.[key], data);
}

function firstValue(data: any, paths: string[]) {
  for (const path of paths) {
    const value = valueAtPath(data, path);
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return undefined;
}

function firstNumber(data: any, paths: string[]) {
  for (const path of paths) {
    const value = positiveNumberOf(valueAtPath(data, path));
    if (value !== undefined) return value;
  }
  return undefined;
}

function firstPlausibleNumber(data: any, paths: string[], predicate: (value: number) => boolean) {
  for (const path of paths) {
    const value = positiveNumberOf(valueAtPath(data, path));
    if (value !== undefined && predicate(value)) return value;
  }
  return undefined;
}

function parseDateBR(value: unknown) {
  const text = cleanText(value);
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function removeUndefinedFields<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => removeUndefinedFields(item)) as T;

  if (value && typeof value === "object" && !(value instanceof Date)) {
    if (typeof (value as any).isEqual === "function") return value;

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, fieldValue]) => fieldValue !== undefined)
        .map(([key, fieldValue]) => [key, removeUndefinedFields(fieldValue)])
    ) as T;
  }

  return value;
}

function isPlausiblePvp(value?: number) {
  return Boolean(value && value >= MIN_PVP && value <= MAX_PVP);
}

export function plausiblePvpValue(value: unknown) {
  const parsed = positiveNumberOf(value);
  return parsed !== undefined && isPlausiblePvp(parsed) ? parsed : undefined;
}

function isPlausibleVpCota(value?: number) {
  return Boolean(value && value >= MIN_VP_COTA && value <= MAX_VP_COTA);
}

function isPlausibleVpCotaForPrice(value?: number, price?: number) {
  if (!isPlausibleVpCota(value)) return false;
  return !price || isPlausiblePvp(price / value!);
}

function approximatelyEqual(left?: number, right?: number, tolerance = 0.15) {
  if (!left || !right) return false;
  return Math.abs(left - right) / Math.max(Math.abs(left), Math.abs(right)) <= tolerance;
}

export function calculatePremiumDiscountPercent(priceValue: unknown, vpCotaValue: unknown) {
  const price = positiveNumberOf(priceValue);
  const vpCota = positiveNumberOf(vpCotaValue);
  if (!price || !vpCota) return undefined;
  const pvp = price / vpCota;
  if (!isPlausiblePvp(pvp)) return undefined;
  return round((pvp - 1) * 100, 4);
}

function isPlausibleAggregate(value?: number) {
  return Boolean(value && value >= MIN_AGGREGATE_VALUE);
}

function validateAggregateWithShares(value?: number, shares?: number, price?: number) {
  if (!isPlausibleAggregate(value)) return undefined;
  if (!shares) return value;

  const vpCota = value! / shares;
  return isPlausibleVpCotaForPrice(vpCota, price) ? value : undefined;
}

function classifySector(data: any) {
  const segment = normalizeText(firstValue(data, ["segment_new", "segment", "segmento", "objective"]));

  if (!segment) return undefined;
  if (segment.includes("fiagro") || segment.includes("agro")) return "Fiagro";
  if (segment.includes("infra")) return "Infraestrutura";
  if (segment.includes("papel") || segment.includes("receb") || segment.includes("cri") || segment.includes("credito")) return "Papel / Crédito";
  if (segment.includes("fundo de fundos") || segment.includes("fof")) return "Fundo de Fundos";
  if (segment.includes("shopping") || segment.includes("lajes") || segment.includes("logistica") || segment.includes("galpo") || segment.includes("renda urbana") || segment.includes("hospital") || segment.includes("hotel") || segment.includes("varejo") || segment.includes("agencia") || segment.includes("hibrido") || segment.includes("imovel")) return "Tijolo";
  if (segment.includes("desenvolvimento")) return "Desenvolvimento";

  return cleanText(firstValue(data, ["segment_new", "segment", "segmento"]));
}

function classifyFundType(data: any) {
  const segment = normalizeText(firstValue(data, ["segment_new", "segment", "segmento", "objective"]));

  if (!segment) return undefined;
  if (segment.includes("fiagro") || segment.includes("agro")) return "Fiagro";
  if (segment.includes("infra")) return "FI-Infra";
  if (segment.includes("papel") || segment.includes("receb") || segment.includes("cri") || segment.includes("credito")) return "FII de Papel";
  if (segment.includes("fundo de fundos") || segment.includes("fof")) return "FoF";
  if (segment.includes("desenvolvimento")) return "Desenvolvimento";
  return "FII de Tijolo";
}

function getEarningsEntries(data: any) {
  const entries: Array<{
    year: number;
    month: string;
    value: number;
    paymentDate?: string;
    paymentKey?: string;
    dateWith?: string;
    priceDateWith?: number;
  }> = [];

  Object.entries(data || {}).forEach(([key, yearData]) => {
    const yearMatch = key.match(/^earnings(\d{4})$/);
    if (!yearMatch || !yearData || typeof yearData !== "object") return;

    const year = Number(yearMatch[1]);
    Object.entries(yearData as Record<string, any>).forEach(([month, info]) => {
      const value = positiveNumberOf(info?.earnings);
      const paymentDate = cleanText(info?.payment_date);
      const date = parseDateBR(paymentDate);

      if (!value) return;
      entries.push({
        year,
        month,
        value,
        paymentDate: paymentDate || undefined,
        paymentKey: date ? toDateKey(date) : undefined,
        dateWith: cleanText(info?.date_with) || undefined,
        priceDateWith: positiveNumberOf(info?.price_date_with),
      });
    });
  });

  return entries.sort((a, b) => String(a.paymentKey || `${a.year}-${MONTHS.indexOf(a.month) + 1}`).localeCompare(String(b.paymentKey || `${b.year}-${MONTHS.indexOf(b.month) + 1}`)));
}

function stddev(values: number[]) {
  if (values.length < 2) return undefined;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function buildDividendSummary(data: any, price?: number, asOf = new Date()) {
  const entries = getEarningsEntries(data);
  const now = new Date(asOf.getTime());
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(now.getMonth() - 6);

  const paidEntries = entries.filter((entry) => {
    if (!entry.paymentKey) return true;
    return new Date(entry.paymentKey) <= now;
  });
  const last = paidEntries.at(-1) || entries.at(-1);
  const last12 = entries.filter((entry) => entry.paymentKey && new Date(entry.paymentKey) >= oneYearAgo && new Date(entry.paymentKey) <= now);
  const last6 = entries.filter((entry) => entry.paymentKey && new Date(entry.paymentKey) >= sixMonthsAgo && new Date(entry.paymentKey) <= now);
  const last12Values = last12.map((entry) => entry.value);
  const last6Values = last6.map((entry) => entry.value);
  const sum12 = last12Values.reduce((sum, value) => sum + value, 0);
  const sum6 = last6Values.reduce((sum, value) => sum + value, 0);
  const average12 = last12Values.length ? sum12 / last12Values.length : undefined;
  const volatility = stddev(last12Values);
  let cuts = 0;

  last12Values.forEach((value, index) => {
    if (index > 0 && value < last12Values[index - 1] * 0.85) cuts += 1;
  });

  return removeUndefinedFields({
    lastDividend: last?.value ? round(last.value, 6) : undefined,
    lastDividendDate: last?.paymentDate,
    lastDividendMonth: last?.month,
    averageDividend12m: average12 ? round(average12, 6) : undefined,
    totalDividend12m: sum12 ? round(sum12, 6) : undefined,
    totalDividend6m: sum6 ? round(sum6, 6) : undefined,
    monthsPaidLast12: last12.length || undefined,
    dividendVolatility12m: volatility ? round(volatility, 6) : undefined,
    dividendCuts12m: cuts || undefined,
    dy12mCalculated: price && sum12 ? round((sum12 / price) * 100, 2) : undefined,
    dy6mAnnualized: price && sum6 ? round(((sum6 * 2) / price) * 100, 2) : undefined,
    dividendsLast12Months: last12.map((entry) => removeUndefinedFields({
      month: entry.month,
      year: entry.year,
      value: round(entry.value, 6),
      paymentDate: entry.paymentDate,
      dateWith: entry.dateWith,
      priceDateWith: entry.priceDateWith,
    })),
    lastDividendPriceDateWith: last?.priceDateWith,
    last12AsOf: last12.at(-1)?.paymentKey,
  });
}

function buildValuation(data: any, price?: number) {
  const netWorthPaths = ["netWorth", "equityValue", "patrimonioLiquido", "patrimony", "equity", "patrimonio", "valuation.netWorth"];
  const vpCotaPaths = ["valorPatrimonialPorCota", "vpCota", "vpa", "bookValuePerShare", "valuation.vpCota"];
  const pvpPaths = ["pvp", "p_vp", "pvpa", "priceToBook", "valuation.pvp"];
  const marketCapPaths = ["marketCap", "valorMercado", "marketData.marketCap", "valuation.marketCap"];
  const rawNetWorth = firstNumber(data, netWorthPaths);
  const numberShares = firstNumber(data, ["numberShares", "sharesOutstanding", "numberOfShares", "quotasIssued", "issuedQuotas", "cotasEmitidas", "numeroCotas", "marketData.numberShares"]);
  const directVpCota = firstNumber(data, vpCotaPaths);
  const directPvp = firstNumber(data, pvpPaths);
  const directMarketCap = firstNumber(data, marketCapPaths);

  const notes: string[] = [];
  const pvpInput = firstPlausibleNumber(data, pvpPaths, isPlausiblePvp);
  const vpCotaInput = firstPlausibleNumber(data, vpCotaPaths, (value) => isPlausibleVpCotaForPrice(value, price));
  const validatedNetWorth = firstPlausibleNumber(data, netWorthPaths, (value) => Boolean(validateAggregateWithShares(value, numberShares, price)));
  const calculatedVpCota = validatedNetWorth && numberShares ? validatedNetWorth / numberShares : undefined;
  const impliedVpCota = price && pvpInput ? price / pvpInput : undefined;
  const vpCota = vpCotaInput || calculatedVpCota || (isPlausibleVpCotaForPrice(impliedVpCota, price) ? impliedVpCota : undefined);
  const calculatedPvp = price && vpCota ? price / vpCota : undefined;
  const pvpInputConsistent = !calculatedPvp || approximatelyEqual(pvpInput, calculatedPvp);
  const pvp = price
    ? calculatedPvp && isPlausiblePvp(calculatedPvp)
      ? calculatedPvp
      : pvpInputConsistent ? pvpInput : undefined
    : undefined;
  const calculatedMarketCap = price && numberShares ? price * numberShares : undefined;
  const validatedDirectMarketCap = firstPlausibleNumber(data, marketCapPaths, (value) => Boolean(validateAggregateWithShares(value, numberShares)));
  const marketCap = calculatedMarketCap || validatedDirectMarketCap;
  const impliedNetWorth = vpCota && numberShares ? vpCota * numberShares : undefined;
  const netWorth = validatedNetWorth || (isPlausibleAggregate(impliedNetWorth) ? impliedNetWorth : undefined);

  if (rawNetWorth && !validatedNetWorth) {
    notes.push("Patrimônio líquido bruto ignorado por unidade ausente ou incompatível com cotas emitidas.");
  }
  if (directMarketCap && !validatedDirectMarketCap && !calculatedMarketCap) {
    notes.push("Valor de mercado bruto ignorado por unidade ausente ou incompatível com cotas emitidas.");
  }
  if (directPvp && !pvpInput) {
    notes.push("P/VP bruto ignorado por faixa incompatível.");
  }
  if (pvpInput && calculatedPvp && !pvpInputConsistent) {
    notes.push("P/VP informado ignorado por incompatibilidade com preço e VP por cota.");
  }
  if (directVpCota && !vpCotaInput) {
    notes.push("VP por cota bruto ignorado por faixa incompatível.");
  }

  return removeUndefinedFields({
    netWorth: netWorth && netWorth > 0 ? round(netWorth, 2) : undefined,
    numberShares,
    vpCota: vpCota && isPlausibleVpCota(vpCota) ? round(vpCota, 4) : undefined,
    pvp: pvp && isPlausiblePvp(pvp) ? round(pvp, 4) : undefined,
    marketCap: marketCap && marketCap > 0 ? round(marketCap, 2) : undefined,
    dataQuality: {
      marketCapSource: calculatedMarketCap ? "calculado por preço atual x cotas emitidas" : validatedDirectMarketCap ? "informado e validado" : undefined,
      netWorthSource: validatedNetWorth ? "informado e validado" : impliedNetWorth && isPlausibleAggregate(impliedNetWorth) ? "estimado a partir de VP/cota ou P/VP" : undefined,
      vpCotaSource: vpCotaInput ? "informado" : validatedNetWorth && numberShares ? "calculado por patrimônio líquido / cotas emitidas" : impliedVpCota && isPlausibleVpCotaForPrice(impliedVpCota, price) ? "estimado por preço / P/VP" : undefined,
      pvpSource: calculatedPvp && isPlausiblePvp(calculatedPvp) ? "calculado por preço / VP por cota" : pvpInputConsistent && pvpInput ? "informado" : undefined,
      notes: notes.length ? notes : undefined,
    },
  });
}

export function deriveFiiRiskData(data: any, options: { asOf?: Date } = {}) {
  const price = firstNumber(data, ["price", "currentPrice", "cotacao", "marketData.price"]);
  const legacyDividendYield = firstNumber(data, ["dividendYield", "dy", "DY", "dy12m", "dividendYield12m", "valuation.dy12m"]);
  const valuation = buildValuation(data, price);
  const dividendSummary = buildDividendSummary(data, price, options.asOf);
  const sector = cleanText(firstValue(data, ["sector", "setor"])) || classifySector(data);
  const fundType = cleanText(firstValue(data, ["fundType", "type", "tipo", "tipoFundo"])) || classifyFundType(data);
  const total12m = dividendSummary.totalDividend12m || null;
  const latestDividend = dividendSummary.lastDividend || null;
  const priceAtDateWith = dividendSummary.lastDividendPriceDateWith || null;
  const navPerShare = valuation.vpCota || null;
  const dy12mCurrentPrice = price && total12m ? round((total12m / price) * 100, 2) : null;
  const lastDividendYieldAtBaseDate = latestDividend && priceAtDateWith
    ? round((latestDividend / priceAtDateWith) * 100, 2)
    : null;
  const distributionOnNav12m = total12m && navPerShare
    ? round((total12m / navPerShare) * 100, 2)
    : null;
  const difference = legacyDividendYield && dy12mCurrentPrice !== null
    ? round(Math.abs(legacyDividendYield - dy12mCurrentPrice), 4)
    : null;
  const metric = (
    value: number | null,
    numeratorField: string,
    numerator: number | null,
    denominatorField: string,
    denominator: number | null,
    asOf: string | null,
    source: string,
    reason?: string,
  ) => ({
    value,
    unit: "percent" as const,
    numerator: { field: numeratorField, value: numerator, unit: "BRL_per_share" as const },
    denominator: { field: denominatorField, value: denominator, unit: "BRL_per_share" as const, asOf },
    formulaVersion: "dividend-metrics-v2.0.0",
    source,
    asOf,
    ...(reason ? { reason } : {}),
  });
  const canonicalDividendMetrics = {
    dy12mCurrentPrice: metric(
      dy12mCurrentPrice,
      "dividends.total12m",
      total12m,
      "price",
      price || null,
      dividendSummary.last12AsOf || null,
      "Cálculo Dados FII: dividendos pagos em 12 meses / cotação atual",
      !total12m ? "missing_dividend_history" : !price ? "missing_current_price" : undefined,
    ),
    lastDividendYieldAtBaseDate: metric(
      lastDividendYieldAtBaseDate,
      "dividends.lastDividend",
      latestDividend,
      "dividends.lastDividendPriceDateWith",
      priceAtDateWith,
      dividendSummary.lastDividendDate || null,
      "Cálculo Dados FII: último rendimento / cotação na data-com",
      !latestDividend ? "missing_last_dividend" : !priceAtDateWith ? "missing_base_date_price" : undefined,
    ),
    distributionOnNav12m: metric(
      distributionOnNav12m,
      "dividends.total12m",
      total12m,
      "valuation.vpCota",
      navPerShare,
      dividendSummary.last12AsOf || null,
      "Cálculo Dados FII: dividendos pagos em 12 meses / VP por cota",
      !total12m ? "missing_dividend_history" : !navPerShare ? "missing_nav_per_share" : undefined,
    ),
    legacyConflict: {
      detected: difference !== null && difference > 0.5,
      legacyValue: legacyDividendYield || null,
      canonicalValue: dy12mCurrentPrice,
      absoluteDifferencePercentagePoints: difference,
    },
  };

  return removeUndefinedFields({
    sector,
    fundType,
    marketCap: valuation.marketCap,
    vpCota: valuation.vpCota,
    pvp: valuation.pvp,
    netWorth: valuation.netWorth,
    valuationDataQuality: valuation.dataQuality,
    lastDividend: dividendSummary.lastDividend,
    lastDividendDate: dividendSummary.lastDividendDate,
    averageDividend12m: dividendSummary.averageDividend12m,
    monthsPaidLast12: dividendSummary.monthsPaidLast12,
    dividendVolatility12m: dividendSummary.dividendVolatility12m,
    dividendCuts12m: dividendSummary.dividendCuts12m,
    dy6m: dividendSummary.dy6mAnnualized,
    dy12mCalculated: dividendSummary.dy12mCalculated,
    dividendYield: dy12mCurrentPrice,
    dividendYield12m: dy12mCurrentPrice,
    dy12m: dy12mCurrentPrice,
    legacyDividendYield: legacyDividendYield || null,
    canonicalDividendMetrics,
    valuation: {
      netWorth: valuation.netWorth,
      vpCota: valuation.vpCota,
      pvp: valuation.pvp,
      marketCap: valuation.marketCap,
      dataQuality: valuation.dataQuality,
      dy12m: dy12mCurrentPrice,
      dy12mCalculated: dividendSummary.dy12mCalculated,
      dy6mAnnualized: dividendSummary.dy6mAnnualized,
    },
    dividends: {
      lastDividend: dividendSummary.lastDividend,
      lastDividendDate: dividendSummary.lastDividendDate,
      lastDividendMonth: dividendSummary.lastDividendMonth,
      average12m: dividendSummary.averageDividend12m,
      total12m: dividendSummary.totalDividend12m,
      total6m: dividendSummary.totalDividend6m,
      monthsPaidLast12: dividendSummary.monthsPaidLast12,
      volatility12m: dividendSummary.dividendVolatility12m,
      cuts12m: dividendSummary.dividendCuts12m,
      dividendsLast12Months: dividendSummary.dividendsLast12Months,
    },
  });
}
