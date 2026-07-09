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
        .filter(([, fieldValue]) => fieldValue !== undefined && fieldValue !== null)
        .map(([key, fieldValue]) => [key, removeUndefinedFields(fieldValue)])
    ) as T;
  }

  return value;
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
  const entries: Array<{ year: number; month: string; value: number; paymentDate?: string; paymentKey?: string; dateWith?: string }> = [];

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

function buildDividendSummary(data: any, price?: number) {
  const entries = getEarningsEntries(data);
  const now = new Date();
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
    })),
  });
}

function buildValuation(data: any, price?: number) {
  const netWorth = firstNumber(data, ["netWorth", "equityValue", "patrimonioLiquido", "patrimony", "equity", "patrimonio", "valuation.netWorth"]);
  const numberShares = firstNumber(data, ["numberShares", "sharesOutstanding", "numberOfShares", "quotasIssued", "issuedQuotas", "cotasEmitidas", "numeroCotas", "marketData.numberShares"]);
  const directVpCota = firstNumber(data, ["valorPatrimonialPorCota", "vpCota", "vpa", "bookValuePerShare", "valuation.vpCota"]);
  const directPvp = firstNumber(data, ["pvp", "p_vp", "pvpa", "priceToBook", "valuation.pvp"]);

  const vpCota = directVpCota || (netWorth && numberShares ? netWorth / numberShares : undefined) || (price && directPvp ? price / directPvp : undefined);
  const pvp = directPvp || (price && vpCota ? price / vpCota : undefined);
  const marketCap = price && numberShares ? price * numberShares : undefined;

  return removeUndefinedFields({
    netWorth,
    numberShares,
    vpCota: vpCota && vpCota > 0 ? round(vpCota, 4) : undefined,
    pvp: pvp && pvp > 0 ? round(pvp, 4) : undefined,
    marketCap: marketCap && marketCap > 0 ? round(marketCap, 2) : undefined,
  });
}

export function deriveFiiRiskData(data: any) {
  const price = firstNumber(data, ["price", "currentPrice", "cotacao", "marketData.price"]);
  const dividendYield = firstNumber(data, ["dividendYield", "dy", "DY", "dy12m", "dividendYield12m", "valuation.dy12m"]);
  const valuation = buildValuation(data, price);
  const dividendSummary = buildDividendSummary(data, price);
  const sector = cleanText(firstValue(data, ["sector", "setor"])) || classifySector(data);
  const fundType = cleanText(firstValue(data, ["fundType", "type", "tipo", "tipoFundo"])) || classifyFundType(data);

  return removeUndefinedFields({
    sector,
    fundType,
    marketCap: valuation.marketCap,
    vpCota: valuation.vpCota,
    pvp: valuation.pvp,
    netWorth: valuation.netWorth,
    lastDividend: dividendSummary.lastDividend,
    lastDividendDate: dividendSummary.lastDividendDate,
    averageDividend12m: dividendSummary.averageDividend12m,
    monthsPaidLast12: dividendSummary.monthsPaidLast12,
    dividendVolatility12m: dividendSummary.dividendVolatility12m,
    dividendCuts12m: dividendSummary.dividendCuts12m,
    dy6m: dividendSummary.dy6mAnnualized,
    dy12mCalculated: dividendSummary.dy12mCalculated,
    valuation: {
      netWorth: valuation.netWorth,
      vpCota: valuation.vpCota,
      pvp: valuation.pvp,
      marketCap: valuation.marketCap,
      dy12m: dividendYield || dividendSummary.dy12mCalculated,
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