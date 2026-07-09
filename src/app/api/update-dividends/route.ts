import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const TIME_ZONE = "America/Sao_Paulo";

function tickerOf(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function saoPauloParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function todayKey() {
  const p = saoPauloParts();
  return `${p.year}-${p.month}-${p.day}`;
}

function currentYear() {
  return Number(saoPauloParts().year);
}

function currentMonthKey() {
  return MONTHS[Number(saoPauloParts().month) - 1];
}

function clean(html: string) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function noAccent(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function numberOf(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value || "").replace("R$", "").replace("%", "").trim();
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compactNumberOf(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const raw = String(value || "")
    .replace("R$", "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();

  if (!raw) return 0;

  let multiplier = 1;
  let cleanValue = raw;

  if (/BI$|B$/.test(cleanValue)) {
    multiplier = 1_000_000_000;
    cleanValue = cleanValue.replace(/BI$|B$/, "");
  } else if (/MI$|M$/.test(cleanValue)) {
    multiplier = 1_000_000;
    cleanValue = cleanValue.replace(/MI$|M$/, "");
  } else if (/MIL$|K$/.test(cleanValue)) {
    multiplier = 1_000;
    cleanValue = cleanValue.replace(/MIL$|K$/, "");
  }

  const parsed = numberOf(cleanValue);
  return parsed ? parsed * multiplier : 0;
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

async function getFiiDoc(ticker: string) {
  const direct = await adminDb.collection("Fiis").doc(ticker).get();
  if (direct.exists) return direct;

  const byCode = await adminDb.collection("Fiis").where("code", "==", ticker).limit(1).get();
  if (!byCode.empty) return byCode.docs[0];

  throw new Error(`Ticker ${ticker} não encontrado.`);
}

async function getStatusInvestPage(ticker: string) {
  const code = ticker.toLowerCase();
  const urls = [
    `https://statusinvest.com.br/fundos-imobiliarios/${code}`,
    `https://statusinvest.com.br/fiagros/${code}`,
    `https://statusinvest.com.br/fiinfras/${code}`,
  ];
  const ignored: string[] = [];

  for (const url of urls) {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
    });

    if (!res.ok) {
      ignored.push(`${url} HTTP ${res.status}`);
      continue;
    }

    const html = await res.text();
    const text = clean(html);
    const upperText = text.toUpperCase();
    const normalized = noAccent(upperText);

    if (normalized.includes("OPS") && normalized.includes("NAO ENCONTRAMOS")) {
      ignored.push(`${url} não encontrado`);
      continue;
    }

    if (!upperText.includes(ticker)) {
      ignored.push(`${url} sem ticker`);
      continue;
    }

    if (!upperText.includes("TIPO DATA COM") && !upperText.includes("DIVIDENDOS DO")) {
      ignored.push(`${url} sem dividendos`);
      continue;
    }

    return { text, url };
  }

  throw new Error(`Nenhuma página válida encontrada. ${ignored.join(" | ")}`);
}

function parseDividends(text: string, year: number) {
  const output: Record<string, any> = {};
  const parts = text.split("Rendimento ").slice(1);

  for (const part of parts) {
    const tokens = part.trim().split(" ");
    const dateWith = tokens[0];
    const paymentDate = tokens[1];
    const value = tokens[2];

    if (!dateWith || !paymentDate || !value) continue;
    if (!paymentDate.includes(`/${year}`)) continue;

    const [, month] = paymentDate.match(/\d{2}\/(\d{2})\/\d{4}/) || [];
    const monthName = MONTHS[Number(month) - 1];
    if (!monthName) continue;

    output[monthName] = {
      payment_date: paymentDate,
      date_with: dateWith,
      earnings: value.startsWith("R$") ? value : `R$ ${value}`,
      price_date_with: "R$ 0,0",
    };
  }

  return output;
}

function findMetric(text: string, labels: string[]) {
  const normalizedText = noAccent(text.toUpperCase());

  for (const label of labels) {
    const normalizedLabel = noAccent(label.toUpperCase());
    const index = normalizedText.indexOf(normalizedLabel);
    if (index < 0) continue;

    const slice = normalizedText.slice(index + normalizedLabel.length, index + normalizedLabel.length + 180);
    const match = slice.match(/R?\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]+)?|[0-9]+(?:,[0-9]+)?)(?:\s*(BI|MI|MIL|B|M|K))?/i);
    if (!match) continue;

    const value = compactNumberOf(`${match[1]}${match[2] || ""}`);
    if (value > 0) return value;
  }

  return undefined;
}

function parseMarketIndicators(text: string, sourceUrl: string) {
  const dailyLiquidity = findMetric(text, [
    "Liquidez Diária",
    "Liquidez média diária",
    "Volume médio diário",
    "Volume diário médio",
  ]);
  const numberShares = findMetric(text, [
    "Cotas emitidas",
    "Número de cotas",
    "Nº de cotas",
    "Total de cotas",
  ]);
  const numberShareholders = findMetric(text, [
    "Número de cotistas",
    "Nº de cotistas",
    "Cotistas",
  ]);

  const payload = removeUndefinedFields({
    dailyLiquidity,
    liquidity: dailyLiquidity,
    numberShares,
    numberCotistas: numberShareholders,
    numberShareholders,
    marketData: {
      dailyLiquidity,
      numberShares,
      numberCotistas: numberShareholders,
      numberShareholders,
      source: "StatusInvest",
      sourceUrl,
      updatedAt: todayKey(),
    },
    marketDataSource: "StatusInvest",
    marketDataUpdatedAt: todayKey(),
  });

  return Object.keys(payload).length ? payload : {};
}

async function reserveDailyRequest(anonId: string, ticker: string) {
  const ref = adminDb
    .collection("Parameters")
    .doc("DividendUpdateRequests")
    .collection("requests")
    .doc(`${todayKey()}_${anonId}_${ticker}`);

  await adminDb.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    const data = doc.data() || {};

    if (doc.exists) {
      throw new Error("Você já solicitou atualização deste FII hoje.");
    }

    transaction.set(ref, {
      anonId,
      ticker,
      requestDate: todayKey(),
      attempts: Number(data.attempts || 0) + 1,
      createdAt: data.createdAt || adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
      status: "reserved",
    }, { merge: true });
  });

  return ref;
}

async function updateTickerDividends(ticker: string) {
  const year = currentYear();
  const doc = await getFiiDoc(ticker);
  const previous = doc.data() || {};
  const page = await getStatusInvestPage(ticker);
  const fetched = parseDividends(page.text, year);
  const fetchedMonths = Object.keys(fetched).sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));
  const marketIndicators = parseMarketIndicators(page.text, page.url);

  if (!fetchedMonths.length) throw new Error(`Nenhum dividendo de ${year} encontrado no StatusInvest.`);

  const field = `earnings${year}`;
  const previousYear = previous[field] || {};
  const merged = { ...previousYear, ...fetched };

  await adminDb.collection("Fiis_Backup").doc(ticker).set({
    ...previous,
    backup_date: adminFieldValue.serverTimestamp(),
    backup_reason: "on-demand-dividend-update",
  }, { merge: false });

  await doc.ref.set({
    [field]: merged,
    ...marketIndicators,
    modified_in: adminFieldValue.serverTimestamp(),
  }, { merge: true });

  return {
    ticker,
    year,
    fetchedMonths,
    currentMonth: currentMonthKey(),
    currentMonthIncluded: Boolean(merged[currentMonthKey()]),
    indicatorsUpdated: Object.keys(marketIndicators).length > 0,
    indicators: marketIndicators,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { ticker } = await req.json();
    const code = tickerOf(ticker);
    if (!code) return NextResponse.json({ error: "Ticker inválido." }, { status: 400 });

    const cookieStore = await cookies();
    const anonId = cookieStore.get("anonId")?.value;
    if (!anonId) return NextResponse.json({ error: "Cookie não encontrado. Aceite os cookies antes de solicitar atualização." }, { status: 400 });

    const requestRef = await reserveDailyRequest(anonId, code);

    try {
      const result = await updateTickerDividends(code);
      const status = result.currentMonthIncluded ? "success" : "partial";
      await requestRef.set({ status, result, finishedAt: adminFieldValue.serverTimestamp() }, { merge: true });

      if (!result.currentMonthIncluded) {
        return NextResponse.json({ success: false, result }, { status: 202 });
      }

      return NextResponse.json({ success: true, result });
    } catch (err: any) {
      await requestRef.set({ status: "error", error: err.message, finishedAt: adminFieldValue.serverTimestamp() }, { merge: true });
      throw err;
    }
  } catch (err: any) {
    const message = err.message || "Erro ao atualizar dividendos.";
    const status = message.includes("já solicitou") || message.includes("em andamento") ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
