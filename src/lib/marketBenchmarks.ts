import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

const TIME_ZONE = "America/Sao_Paulo";
const COLLECTION = "MarketBenchmarks";
const LATEST_DOC = "latest";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const BCB_BASE_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";
const BRAPI_BASE_URL = "https://brapi.dev/api/v2";

type PricePoint = { date: Date; isoDate: string; close: number };
type BenchmarkAttempt = {
  provider: string;
  symbol: string;
  status: string;
  range?: string;
  url?: string;
  observations?: number;
  firstDate?: string | null;
  lastDate?: string | null;
  error?: string;
};

function dateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function dateKey(date = new Date()) {
  const parts = dateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function ddmmyyyy(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function parseBcbDate(value: string) {
  const match = String(value || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseIsoDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function startOfMonth(date = new Date()) {
  const parts = dateParts(date);
  return new Date(Number(parts.year), Number(parts.month) - 1, 1, 12, 0, 0);
}

function startOfYear(date = new Date()) {
  const parts = dateParts(date);
  return new Date(Number(parts.year), 0, 1, 12, 0, 0);
}

function numberOf(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = String(value || "")
    .trim()
    .replace("%", "")
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percentReturn(startValue?: number | null, endValue?: number | null) {
  if (!startValue || !endValue || startValue <= 0 || endValue <= 0) return null;
  return Number((((endValue / startValue) - 1) * 100).toFixed(2));
}

function compoundDailyPercent(values: number[]) {
  if (!values.length) return null;
  const factor = values.reduce((acc, dailyPercent) => acc * (1 + dailyPercent / 100), 1);
  return Number(((factor - 1) * 100).toFixed(2));
}

function sumPercent(values: number[]) {
  if (!values.length) return null;
  return Number(values.reduce((sum, value) => sum + value, 0).toFixed(2));
}

function cleanBenchmarkData(data: any) {
  if (!data || typeof data !== "object") return data;
  const { updatedAt, createdAt, ...clean } = data;
  return clean;
}

function recentEnough(isoDate?: string | null, maxCalendarDays = 7) {
  if (!isoDate) return false;
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() <= maxCalendarDays * 24 * 60 * 60 * 1000;
}

function envList(name: string, fallback: string) {
  return String(process.env[name] || fallback)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function mergePricePoints(...groups: PricePoint[][]) {
  const byDate = new Map<string, PricePoint>();
  groups.flat().forEach((point) => {
    if (point?.isoDate && point.close > 0) byDate.set(point.isoDate, point);
  });
  return Array.from(byDate.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
}

async function fetchStoredIfixHistory() {
  try {
    const snapshot = await adminDb.collection(COLLECTION).orderBy("date", "desc").limit(450).get();
    const points: PricePoint[] = [];

    snapshot.docs.forEach((doc) => {
      if (doc.id === LATEST_DOC) return;
      const data = doc.data() || {};
      const close = numberOf(data?.ifix?.close);
      const rawDate = String(data?.ifix?.lastDate || data?.date || doc.id || "").slice(0, 10);
      const date = parseIsoDate(rawDate);
      if (!date || close <= 0) return;
      points.push({ date, isoDate: dateKey(date), close });
    });

    return points.sort((a, b) => a.date.getTime() - b.date.getTime());
  } catch {
    return [];
  }
}

async function fetchBcbSerie(code: number, start: Date, end = new Date()) {
  const url = `${BCB_BASE_URL}.${code}/dados?formato=json&dataInicial=${encodeURIComponent(ddmmyyyy(start))}&dataFinal=${encodeURIComponent(ddmmyyyy(end))}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`BCB SGS ${code} HTTP ${res.status}`);

  const json = await res.json();
  return Array.isArray(json)
    ? json
        .map((item) => {
          const date = String(item?.data || "");
          const parsedDate = parseBcbDate(date);
          return {
            date,
            isoDate: parsedDate ? dateKey(parsedDate) : null,
            timestamp: parsedDate ? parsedDate.getTime() : 0,
            value: numberOf(item?.valor),
          };
        })
        .filter((item) => item.date && item.timestamp && Number.isFinite(item.value))
        .sort((a, b) => a.timestamp - b.timestamp)
    : [];
}

async function fetchSelicTarget() {
  const rows = await fetchBcbSerie(432, addMonths(new Date(), -6));
  const last = rows.at(-1);
  return last ? {
    rate: last.value,
    date: last.date,
    isoDate: last.isoDate,
    source: "Banco Central do Brasil - SGS 432",
    comparisonReady: Boolean(last.value),
  } : {
    rate: null,
    date: null,
    isoDate: null,
    source: "Banco Central do Brasil - SGS 432",
    comparisonReady: false,
    error: "sem dados recentes",
  };
}

async function fetchCdiReturns() {
  const now = new Date();
  const twelveMonthsStart = addMonths(now, -12);
  const rows = await fetchBcbSerie(12, addMonths(now, -13), now);
  const monthStart = startOfMonth(now).getTime();
  const yearStart = startOfYear(now).getTime();
  const twelveStart = twelveMonthsStart.getTime();
  const monthRows = rows.filter((row) => row.timestamp >= monthStart);
  const yearRows = rows.filter((row) => row.timestamp >= yearStart);
  const twelveMonthRows = rows.filter((row) => row.timestamp >= twelveStart);
  const last = rows.at(-1);
  const monthReturn = compoundDailyPercent(monthRows.map((row) => row.value));
  const yearReturn = compoundDailyPercent(yearRows.map((row) => row.value));
  const twelveMonthsReturn = compoundDailyPercent(twelveMonthRows.map((row) => row.value));
  const comparisonReady = Boolean(
    last?.isoDate
    && recentEnough(last.isoDate, 7)
    && monthReturn !== null
    && yearReturn !== null
    && twelveMonthsReturn !== null
  );

  return {
    source: "Banco Central do Brasil - SGS 12",
    method: "CDI acumulado por composição geométrica das taxas diárias da série SGS 12.",
    unit: "percent",
    monthReturn,
    yearReturn,
    twelveMonthsReturn,
    lastDailyRate: last?.value ?? null,
    lastDate: last?.date || null,
    lastIsoDate: last?.isoDate || null,
    observations: {
      month: monthRows.length,
      year: yearRows.length,
      twelveMonths: twelveMonthRows.length,
    },
    comparisonReady,
    quality: comparisonReady ? "official_calculated" : "incomplete",
  };
}

async function fetchIpcaReturns() {
  const now = new Date();
  const rows = await fetchBcbSerie(433, addMonths(now, -14), now);
  const yearStart = startOfYear(now).getTime();
  const yearRows = rows.filter((row) => row.timestamp >= yearStart);
  const last12Rows = rows.slice(-12);
  const last = rows.at(-1);

  return {
    source: "Banco Central do Brasil - SGS 433",
    method: "IPCA acumulado por soma das variações mensais da série SGS 433.",
    unit: "percent",
    monthReturn: last?.value ?? null,
    yearReturn: sumPercent(yearRows.map((row) => row.value)),
    twelveMonthsReturn: sumPercent(last12Rows.map((row) => row.value)),
    lastDate: last?.date || null,
    lastIsoDate: last?.isoDate || null,
    observations: {
      year: yearRows.length,
      twelveMonths: last12Rows.length,
    },
    comparisonReady: Boolean(last && last12Rows.length >= 12),
  };
}

async function fetchYahooChart(symbol: string, range = "2y") {
  const encoded = encodeURIComponent(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=${range}&interval=1d`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) throw new Error(`Yahoo ${symbol} HTTP ${res.status}`);

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp || [];
  const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close || [];
  const values = timestamps
    .map((timestamp, index) => ({ date: new Date(timestamp * 1000), close: closes[index] }))
    .filter((item) => Number.isFinite(item.close) && Number(item.close) > 0)
    .map((item) => ({ date: item.date, isoDate: dateKey(item.date), close: Number(item.close) }));

  return { url, values };
}

async function fetchBrapiHistorical(symbol: string, range = "3mo") {
  const apiKey = process.env.BRAPI_API_TOKEN || process.env.BRAPI_TOKEN || "";
  const url = `${BRAPI_BASE_URL}/stocks/historical?symbols=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}&interval=1d&sortOrder=asc`;

  if (!apiKey) {
    throw new Error("BRAPI_API_TOKEN ausente");
  }

  const authValue = ["Bearer", apiKey].join(" ");
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Authorization: authValue,
      "User-Agent": "dados-fii/1.0",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const detail = body ? ` - ${body.slice(0, 500)}` : "";
    throw new Error(`brapi ${symbol} ${range} HTTP ${res.status}${detail}`);
  }

  const json = await res.json();
  const result = Array.isArray(json?.results) ? json.results[0] : null;
  const usedRange = result?.data?.usedRange || range;
  const prices = result?.data?.historicalDataPrice;
  const values: PricePoint[] = Array.isArray(prices)
    ? prices
        .map((item: any) => {
          const rawDate = item?.date;
          const date = typeof rawDate === "number"
            ? new Date(rawDate * 1000)
            : new Date(`${String(rawDate || "").slice(0, 10)}T12:00:00`);
          const close = numberOf(item?.adjustedClose ?? item?.close);
          return { date, isoDate: dateKey(date), close };
        })
        .filter((item) => !Number.isNaN(item.date.getTime()) && item.close > 0)
        .sort((a, b) => a.date.getTime() - b.date.getTime())
    : [];

  return { url, values, usedRange };
}

function firstOnOrAfter(values: PricePoint[], target: Date) {
  return values.find((item) => item.date.getTime() >= target.getTime()) || null;
}

function hasCoverage(values: PricePoint[], target: Date) {
  const first = values[0];
  return Boolean(first && first.date.getTime() <= target.getTime());
}

function anchorFor(values: PricePoint[], target: Date) {
  return hasCoverage(values, target) ? firstOnOrAfter(values, target) : null;
}

function buildIndexReturnResult(params: {
  provider: string;
  source: string;
  sourceType: string;
  symbol: string;
  range?: string;
  values: PricePoint[];
  attempts: BenchmarkAttempt[];
  note: string;
}) {
  const { provider, source, sourceType, symbol, range, values, attempts, note } = params;
  if (!values.length) throw new Error("sem fechamento disponível");

  const now = new Date();
  const latest = values.at(-1)!;
  const monthAnchor = anchorFor(values, startOfMonth(now));
  const yearAnchor = anchorFor(values, startOfYear(now));
  const twelveMonthsAnchor = anchorFor(values, addMonths(latest.date, -12));
  const monthReturn = percentReturn(monthAnchor?.close, latest.close);
  const yearReturn = percentReturn(yearAnchor?.close, latest.close);
  const twelveMonthsReturn = percentReturn(twelveMonthsAnchor?.close, latest.close);
  const currentReady = Boolean(recentEnough(latest.isoDate, 10) && latest.close > 0);
  const partialComparisonReady = Boolean(currentReady && monthReturn !== null);
  const comparisonReady = Boolean(partialComparisonReady && yearReturn !== null && twelveMonthsReturn !== null);

  return {
    symbol,
    provider,
    source,
    sourceType,
    method: "Retorno calculado pela variação do fechamento do IFIX entre as datas-base e o último fechamento disponível.",
    unit: "percent",
    range: range || null,
    close: Number(latest.close.toFixed(2)),
    monthReturn,
    yearReturn,
    twelveMonthsReturn,
    lastDate: latest.isoDate,
    anchors: {
      monthStart: monthAnchor ? { date: monthAnchor.isoDate, close: Number(monthAnchor.close.toFixed(2)) } : null,
      yearStart: yearAnchor ? { date: yearAnchor.isoDate, close: Number(yearAnchor.close.toFixed(2)) } : null,
      twelveMonthsStart: twelveMonthsAnchor ? { date: twelveMonthsAnchor.isoDate, close: Number(twelveMonthsAnchor.close.toFixed(2)) } : null,
    },
    observations: values.length,
    currentReady,
    comparisonReady,
    partialComparisonReady,
    quality: comparisonReady
      ? "secondary_calculated"
      : partialComparisonReady
        ? "partial_secondary_calculated"
        : currentReady
          ? "latest_close_only"
          : "incomplete",
    attempts,
    note,
  };
}

async function fetchIfixReturns() {
  const attempts: BenchmarkAttempt[] = [];
  const errors: string[] = [];
  const storedValues = await fetchStoredIfixHistory();
  const brapiSymbols = envList("BENCHMARK_IFIX_BRAPI_SYMBOLS", "IFIX.SA,^IFIX,IFIX");
  const brapiRanges = envList("BENCHMARK_IFIX_BRAPI_RANGES", "3mo,1mo");
  const yahooSymbols = envList("BENCHMARK_IFIX_SYMBOLS", "IFIX.SA,^IFIX");

  for (const range of brapiRanges) {
    for (const symbol of brapiSymbols) {
      try {
        const { url, values, usedRange } = await fetchBrapiHistorical(symbol, range);
        const mergedValues = mergePricePoints(storedValues, values);
        attempts.push({
          provider: "brapi",
          symbol,
          range: usedRange,
          status: "fetched",
          url,
          observations: values.length,
          firstDate: values[0]?.isoDate || null,
          lastDate: values.at(-1)?.isoDate || null,
        });

        return buildIndexReturnResult({
          provider: "brapi",
          source: "brapi.dev",
          sourceType: "secondary_market_data_provider",
          symbol,
          range: usedRange,
          values: mergedValues,
          attempts,
          note: "Fonte secundária via brapi.dev. O sistema preserva o fechamento atual e usa o histórico próprio salvo diariamente para calcular retornos quando houver janela suficiente.",
        });
      } catch (err: any) {
        const message = err.message || "erro";
        errors.push(`brapi ${symbol} ${range}: ${message}`);
        attempts.push({ provider: "brapi", symbol, range, status: "error", error: message });
      }
    }
  }

  for (const symbol of yahooSymbols) {
    try {
      const { url, values } = await fetchYahooChart(symbol, "2y");
      const mergedValues = mergePricePoints(storedValues, values);
      attempts.push({
        provider: "yahoo",
        symbol,
        range: "2y",
        status: "fetched",
        url,
        observations: values.length,
        firstDate: values[0]?.isoDate || null,
        lastDate: values.at(-1)?.isoDate || null,
      });

      return buildIndexReturnResult({
        provider: "yahoo",
        source: "Yahoo Finance",
        sourceType: "secondary_market_data_provider",
        symbol,
        range: "2y",
        values: mergedValues,
        attempts,
        note: "Fonte secundária. O sistema preserva o fechamento atual e usa o histórico próprio salvo diariamente para calcular retornos quando houver janela suficiente.",
      });
    } catch (err: any) {
      const message = err.message || "erro";
      errors.push(`Yahoo ${symbol}: ${message}`);
      attempts.push({ provider: "yahoo", symbol, range: "2y", status: "error", error: message });
    }
  }

  return {
    symbol: brapiSymbols[0] || yahooSymbols[0] || "IFIX",
    source: "brapi.dev / Yahoo Finance",
    sourceType: "secondary_market_data_provider",
    close: null,
    monthReturn: null,
    yearReturn: null,
    twelveMonthsReturn: null,
    lastDate: null,
    currentReady: false,
    comparisonReady: false,
    partialComparisonReady: false,
    quality: "unavailable",
    attempts,
    errors,
  };
}

function generatedMetadata() {
  return {
    date: dateKey(),
    generatedAt: new Date().toISOString(),
    sources: [
      "Banco Central do Brasil - SGS 12: CDI diário",
      "Banco Central do Brasil - SGS 433: IPCA mensal",
      "Banco Central do Brasil - SGS 432: Selic meta",
      "brapi.dev ou Yahoo Finance, quando disponível: IFIX",
    ],
    methodology: {
      cdi: "Retornos acumulados calculados por composição geométrica das taxas diárias oficiais da série SGS 12.",
      ipca: "Retornos acumulados calculados pela soma das variações mensais oficiais da série SGS 433.",
      ifix: "Fechamento do IFIX obtido por fonte secundária. Retornos são calculados quando houver histórico próprio suficiente salvo na base.",
    },
  };
}

async function fetchFreshBenchmarks() {
  const [selic, cdi, ipca, ifix] = await Promise.allSettled([
    fetchSelicTarget(),
    fetchCdiReturns(),
    fetchIpcaReturns(),
    fetchIfixReturns(),
  ]);

  const benchmarkData = {
    ...generatedMetadata(),
    ifix: ifix.status === "fulfilled" ? ifix.value : { close: null, monthReturn: null, yearReturn: null, twelveMonthsReturn: null, currentReady: false, comparisonReady: false, partialComparisonReady: false, error: ifix.reason?.message || "erro" },
    cdi: cdi.status === "fulfilled" ? cdi.value : { monthReturn: null, yearReturn: null, twelveMonthsReturn: null, comparisonReady: false, error: cdi.reason?.message || "erro" },
    ipca: ipca.status === "fulfilled" ? ipca.value : { monthReturn: null, yearReturn: null, twelveMonthsReturn: null, comparisonReady: false, error: ipca.reason?.message || "erro" },
    selic: selic.status === "fulfilled" ? selic.value : { rate: null, comparisonReady: false, error: selic.reason?.message || "erro" },
  };

  await adminDb.collection(COLLECTION).doc(LATEST_DOC).set({
    ...benchmarkData,
    updatedAt: adminFieldValue.serverTimestamp(),
  }, { merge: true });

  await adminDb.collection(COLLECTION).doc(benchmarkData.date).set({
    ...benchmarkData,
    updatedAt: adminFieldValue.serverTimestamp(),
  }, { merge: true });

  return benchmarkData;
}

function isFresh(data: any) {
  const updatedAt = data?.updatedAt;
  const date = typeof updatedAt?.toDate === "function" ? updatedAt.toDate() : updatedAt ? new Date(updatedAt) : null;
  return Boolean(date && !Number.isNaN(date.getTime()) && Date.now() - date.getTime() < CACHE_TTL_MS);
}

function summarizeBenchmarks(data: any) {
  return {
    generatedAt: data?.generatedAt || null,
    date: data?.date || null,
    ifix: {
      ok: Boolean(data?.ifix?.comparisonReady || data?.ifix?.partialComparisonReady || data?.ifix?.currentReady),
      fullOk: Boolean(data?.ifix?.comparisonReady),
      partialOk: Boolean(data?.ifix?.partialComparisonReady),
      currentOk: Boolean(data?.ifix?.currentReady),
      provider: data?.ifix?.provider || null,
      symbol: data?.ifix?.symbol || null,
      range: data?.ifix?.range || null,
      close: data?.ifix?.close ?? null,
      monthReturn: data?.ifix?.monthReturn ?? null,
      yearReturn: data?.ifix?.yearReturn ?? null,
      twelveMonthsReturn: data?.ifix?.twelveMonthsReturn ?? null,
      lastDate: data?.ifix?.lastDate || null,
      quality: data?.ifix?.quality || null,
      observations: data?.ifix?.observations ?? null,
      attempts: data?.ifix?.attempts || [],
      errors: data?.ifix?.errors || [],
    },
    cdi: {
      ok: Boolean(data?.cdi?.comparisonReady),
      monthReturn: data?.cdi?.monthReturn ?? null,
      yearReturn: data?.cdi?.yearReturn ?? null,
      twelveMonthsReturn: data?.cdi?.twelveMonthsReturn ?? null,
      lastDate: data?.cdi?.lastDate || null,
      observations: data?.cdi?.observations || null,
      quality: data?.cdi?.quality || null,
    },
    ipca: {
      ok: Boolean(data?.ipca?.comparisonReady),
      monthReturn: data?.ipca?.monthReturn ?? null,
      yearReturn: data?.ipca?.yearReturn ?? null,
      twelveMonthsReturn: data?.ipca?.twelveMonthsReturn ?? null,
      lastDate: data?.ipca?.lastDate || null,
    },
    selic: {
      ok: Boolean(data?.selic?.comparisonReady),
      rate: data?.selic?.rate ?? null,
      date: data?.selic?.date || null,
    },
  };
}

export async function diagnoseMarketBenchmarks() {
  const latestBefore = await adminDb.collection(COLLECTION).doc(LATEST_DOC).get();
  const cachedBefore = latestBefore.exists ? cleanBenchmarkData(latestBefore.data()) : null;
  let fresh: any = null;
  let error: string | null = null;

  try {
    fresh = await fetchFreshBenchmarks();
  } catch (err: any) {
    error = err.message || "Erro ao atualizar benchmarks.";
  }

  const latestAfter = await adminDb.collection(COLLECTION).doc(LATEST_DOC).get();
  const cachedAfter = latestAfter.exists ? cleanBenchmarkData(latestAfter.data()) : null;
  const current = fresh || cachedAfter || cachedBefore;

  return {
    ok: Boolean(fresh),
    error,
    summary: summarizeBenchmarks(current),
    fresh,
    cachedBefore,
    cachedAfter,
  };
}

export async function getMarketBenchmarks(options?: { forceRefresh?: boolean }) {
  if (!options?.forceRefresh) {
    const latest = await adminDb.collection(COLLECTION).doc(LATEST_DOC).get();
    const data = latest.data();
    if (latest.exists && data && isFresh(data)) return cleanBenchmarkData(data);
  }

  try {
    return await fetchFreshBenchmarks();
  } catch (err) {
    const latest = await adminDb.collection(COLLECTION).doc(LATEST_DOC).get();
    const data = latest.data();
    if (latest.exists && data) return { ...cleanBenchmarkData(data), stale: true };
    throw err;
  }
}
