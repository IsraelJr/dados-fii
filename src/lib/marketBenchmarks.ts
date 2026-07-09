import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

const TIME_ZONE = "America/Sao_Paulo";
const COLLECTION = "MarketBenchmarks";
const LATEST_DOC = "latest";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const BCB_BASE_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";

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

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function numberOf(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = String(value || "").trim().replace("%", "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percentReturn(startValue?: number, endValue?: number) {
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

async function fetchBcbSerie(code: number, start: Date, end = new Date()) {
  const url = `${BCB_BASE_URL}.${code}/dados?formato=json&dataInicial=${encodeURIComponent(ddmmyyyy(start))}&dataFinal=${encodeURIComponent(ddmmyyyy(end))}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`BCB SGS ${code} HTTP ${res.status}`);

  const json = await res.json();
  return Array.isArray(json)
    ? json.map((item) => ({ date: String(item?.data || ""), value: numberOf(item?.valor) })).filter((item) => item.date && Number.isFinite(item.value))
    : [];
}

async function fetchSelicTarget() {
  const rows = await fetchBcbSerie(432, addMonths(new Date(), -2));
  const last = rows.at(-1);
  return last ? { rate: last.value, date: last.date } : null;
}

async function fetchCdiReturns() {
  const now = new Date();
  const rows = await fetchBcbSerie(12, addMonths(now, -13), now);
  const monthRows = rows.filter((row) => row.date.slice(3, 10) === ddmmyyyy(now).slice(3, 10));
  const currentYear = ddmmyyyy(now).slice(6, 10);
  const yearRows = rows.filter((row) => row.date.slice(6, 10) === currentYear);

  return {
    monthReturn: compoundDailyPercent(monthRows.map((row) => row.value)),
    yearReturn: compoundDailyPercent(yearRows.map((row) => row.value)),
    twelveMonthsReturn: compoundDailyPercent(rows.map((row) => row.value)),
    lastDailyRate: rows.at(-1)?.value ?? null,
    lastDate: rows.at(-1)?.date || null,
  };
}

async function fetchIpcaReturns() {
  const now = new Date();
  const rows = await fetchBcbSerie(433, addMonths(now, -13), now);
  const currentYear = ddmmyyyy(now).slice(6, 10);
  const yearRows = rows.filter((row) => row.date.slice(6, 10) === currentYear);
  const last = rows.at(-1);

  return {
    monthReturn: last?.value ?? null,
    yearReturn: sumPercent(yearRows.map((row) => row.value)),
    twelveMonthsReturn: sumPercent(rows.slice(-12).map((row) => row.value)),
    lastDate: last?.date || null,
  };
}

async function fetchYahooChart(symbol: string, range = "1y") {
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
    .filter((item) => Number.isFinite(item.close) && Number(item.close) > 0) as Array<{ date: Date; close: number }>;

  return values;
}

async function fetchIfixReturns() {
  const symbols = String(process.env.BENCHMARK_IFIX_SYMBOLS || "^IFIX,IFIX.SA")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const errors: string[] = [];

  for (const symbol of symbols) {
    try {
      const values = await fetchYahooChart(symbol, "1y");
      if (values.length < 2) throw new Error("sem histórico suficiente");

      const now = new Date();
      const latest = values.at(-1)!;
      const monthStart = values.find((item) => item.date >= addDays(new Date(now.getFullYear(), now.getMonth(), 1), -3)) || values[0];
      const yearStart = values.find((item) => item.date >= addDays(new Date(now.getFullYear(), 0, 1), -3)) || values[0];
      const twelveMonthsStart = values[0];

      return {
        symbol,
        close: Number(latest.close.toFixed(2)),
        monthReturn: percentReturn(monthStart.close, latest.close),
        yearReturn: percentReturn(yearStart.close, latest.close),
        twelveMonthsReturn: percentReturn(twelveMonthsStart.close, latest.close),
        lastDate: dateKey(latest.date),
      };
    } catch (err: any) {
      errors.push(`${symbol}: ${err.message || "erro"}`);
    }
  }

  return {
    symbol: symbols[0] || "IFIX",
    close: null,
    monthReturn: null,
    yearReturn: null,
    twelveMonthsReturn: null,
    lastDate: null,
    errors,
  };
}

function generatedMetadata() {
  return {
    date: dateKey(),
    generatedAt: new Date().toISOString(),
    sources: [
      "Banco Central do Brasil - SGS: CDI, IPCA e Selic",
      "Yahoo Finance, quando disponível: IFIX",
    ],
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
    ifix: ifix.status === "fulfilled" ? ifix.value : { close: null, monthReturn: null, yearReturn: null, twelveMonthsReturn: null, error: ifix.reason?.message || "erro" },
    cdi: cdi.status === "fulfilled" ? cdi.value : { monthReturn: null, yearReturn: null, twelveMonthsReturn: null, error: cdi.reason?.message || "erro" },
    ipca: ipca.status === "fulfilled" ? ipca.value : { monthReturn: null, yearReturn: null, twelveMonthsReturn: null, error: ipca.reason?.message || "erro" },
    selic: selic.status === "fulfilled" ? selic.value : { rate: null, error: selic.reason?.message || "erro" },
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
