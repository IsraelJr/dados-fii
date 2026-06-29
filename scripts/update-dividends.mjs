import admin from "firebase-admin";

const FIIS_COLLECTION = "Fiis";
const BACKUP_COLLECTION = "Fiis_Backup";
const PARAMETERS_COLLECTION = "Parameters";
const TIME_ZONE = "America/Sao_Paulo";
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

function saoPauloDateParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function currentYear() {
  return Number(saoPauloDateParts().year);
}

function currentMonthKey() {
  return MONTHS[Number(saoPauloDateParts().month) - 1];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getArg(name) {
  const prefix = `--${name}=`;
  const withEquals = process.argv.find((arg) => arg.startsWith(prefix));
  if (withEquals) return withEquals.replace(prefix, "").trim();

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1]?.trim();

  return "";
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function initFirebase() {
  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!rawKey) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY não configurada.");

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(rawKey)),
    });
  }

  return admin.firestore();
}

function normalizeTicker(value) {
  return String(value || "").trim().toUpperCase();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value) {
  return decodeHtml(String(value || "").replace(/<[^>]+>/g, " "));
}

function normalizeDate(value) {
  return String(value || "").replace(/\./g, "/").trim();
}

function normalizeCurrency(value) {
  const text = stripTags(value).replace(/\s+/g, " ").trim();
  if (!text) return "R$ 0,0";
  return text.startsWith("R$") ? text : `R$ ${text.replace("R$", "").trim()}`;
}

function formatCurrency(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "R$ 0,0";
  return `R$ ${number.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  })}`;
}

function toDateOnly(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function monthNameFromDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return MONTHS[date.getUTCMonth()];
}

function extractRows(html) {
  return [...String(html || "").matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
}

function extractCells(rowHtml) {
  return [...String(rowHtml || "").matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)].map((match) => ({
    attrs: match[1] || "",
    html: match[2] || "",
    text: stripTags(match[2] || ""),
  }));
}

function getTitle(attrs) {
  const match = String(attrs || "").match(/title=["']([^"']+)["']/i);
  return decodeHtml(match?.[1] || "");
}

function getBrapiToken() {
  return process.env.BRAPI_API_TOKEN || process.env.BRAPI_TOKEN || "";
}

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "DadosFIIUpdater/1.3",
      ...headers,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.message || data?.error || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; DadosFIIUpdater/1.3)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return response.text();
}

async function updateBackupParameter(db, payload) {
  await db.collection(PARAMETERS_COLLECTION).doc("backup").set(
    {
      lastFiisBackupAt: admin.firestore.FieldValue.serverTimestamp(),
      ...payload,
    },
    { merge: true }
  );
}

async function backupFiis(db) {
  console.log(`Iniciando backup de /${FIIS_COLLECTION} para /${BACKUP_COLLECTION}...`);

  const snapshot = await db.collection(FIIS_COLLECTION).get();
  if (snapshot.empty) throw new Error(`Coleção /${FIIS_COLLECTION} vazia. Backup abortado.`);

  const backupId = new Date().toISOString();
  let batch = db.batch();
  let batchCount = 0;
  let total = 0;

  for (const doc of snapshot.docs) {
    batch.set(
      db.collection(BACKUP_COLLECTION).doc(doc.id),
      {
        ...doc.data(),
        backup_source_collection: FIIS_COLLECTION,
        backup_id: backupId,
        backup_date: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: false }
    );

    batchCount += 1;
    total += 1;

    if (batchCount >= 450) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) await batch.commit();

  await updateBackupParameter(db, {
    lastFiisBackupId: backupId,
    lastFiisBackupType: "full-collection",
    lastFiisBackupSource: FIIS_COLLECTION,
    lastFiisBackupTarget: BACKUP_COLLECTION,
    lastFiisBackupDocuments: total,
  });

  console.log(`Backup concluído: ${total} documentos copiados.`);
}

async function fetchBrapiDividends(ticker, year = currentYear()) {
  const token = getBrapiToken();
  if (!token) throw new Error("BRAPI_API_TOKEN/BRAPI_TOKEN não configurado.");

  const code = normalizeTicker(ticker);
  const url = new URL("https://brapi.dev/api/v2/fii/dividends");
  url.searchParams.set("symbols", code);
  url.searchParams.set("startDate", `${year}-01-01`);
  url.searchParams.set("endDate", `${year}-12-31`);
  url.searchParams.set("sortOrder", "asc");

  const data = await fetchJson(url.toString(), {
    Authorization: `Bearer ${token}`,
  });

  const rows = Array.isArray(data?.dividends) ? data.dividends : [];

  return rows
    .filter((item) => normalizeTicker(item.symbol) === code)
    .filter((item) => String(item.label || "").toUpperCase().includes("RENDIMENTO"))
    .map((item) => {
      const paymentDate = item.paymentDate || item.payment_date;
      const dateWith = item.lastDatePrior || item.last_date_prior || item.approvedOn;
      const monthName = monthNameFromDate(paymentDate);

      if (!monthName) return null;

      return {
        monthName,
        date_with: toDateOnly(dateWith),
        payment_date: toDateOnly(paymentDate),
        earnings: formatCurrency(item.rate),
        source: "brapi",
      };
    })
    .filter(Boolean);
}

function parseStatusInvestDividends(html, year = currentYear()) {
  const rows = extractRows(html);
  const dividends = [];

  for (const row of rows) {
    const cells = extractCells(row);
    if (cells.length < 4) continue;

    const type = getTitle(cells[0].attrs).toLowerCase();
    if (type && type !== "rendimento") continue;

    const dateWith = normalizeDate(cells[1].text);
    const payDate = normalizeDate(cells[2].text);
    const value = normalizeCurrency(cells[3].html);
    const [, month, rowYear] = payDate.match(/(\d{2})\/(\d{2})\/(\d{4})/) || [];

    if (!month || Number(rowYear) !== year) continue;

    const monthName = MONTHS[Number(month) - 1];
    if (!monthName) continue;

    dividends.push({
      monthName,
      date_with: dateWith,
      payment_date: payDate,
      earnings: value,
      source: "statusinvest",
    });
  }

  return dividends;
}

async function fetchStatusInvestHtml(ticker) {
  const code = normalizeTicker(ticker);
  const paths = [
    `fundos-imobiliarios/${code}`,
    `fiagros/${code}`,
    `fiinfras/${code}`,
  ];

  const errors = [];

  for (const path of paths) {
    const url = `https://statusinvest.com.br/${path}`;
    try {
      const html = await fetchText(url);
      if (extractRows(html).length > 0) return html;
      errors.push(`${url}: sem linhas úteis`);
    } catch (err) {
      errors.push(err.message);
    }
  }

  throw new Error(`Não consegui ler StatusInvest para ${code}. ${errors.join(" | ")}`);
}

function extractFiisDividendBlocks(html) {
  return [...String(html || "").matchAll(/<[^>]+class=["'][^"']*yieldChart__table__bloco[^"']*["'][^>]*>[\s\S]*?(?=<[^>]+class=["'][^"']*yieldChart__table__bloco|<\/body>|$)/gi)]
    .map((match) => match[0]);
}

function parseFiisDividends(html, year = currentYear()) {
  const dividends = [];

  for (const block of extractFiisDividendBlocks(html)) {
    const lines = [...block.matchAll(/<[^>]+class=["'][^"']*table__linha[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi)]
      .map((match) => stripTags(match[1]));

    if (lines.length < 5) continue;

    const dateWith = normalizeDate(lines[0]);
    const payDate = normalizeDate(lines[1]);
    const priceDateWith = normalizeCurrency(lines[2]);
    const earnings = normalizeCurrency(lines[4]);
    const [, month, rowYear] = payDate.match(/(\d{2})\/(\d{2})\/(\d{4})/) || [];

    if (!month || Number(rowYear) !== year) continue;

    const monthName = MONTHS[Number(month) - 1];
    if (!monthName) continue;

    dividends.push({
      monthName,
      date_with: dateWith,
      payment_date: payDate,
      earnings,
      price_date_with: priceDateWith,
      source: "fiis.com.br",
    });
  }

  return dividends;
}

function parseFiisPriceByPaymentDate(html) {
  const map = new Map();

  for (const block of extractFiisDividendBlocks(html)) {
    const lines = [...block.matchAll(/<[^>]+class=["'][^"']*table__linha[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi)]
      .map((match) => stripTags(match[1]));

    if (lines.length >= 3) {
      const paymentDate = normalizeDate(lines[1]);
      const price = normalizeCurrency(lines[2]);
      if (paymentDate) map.set(paymentDate, price);
    }
  }

  return map;
}

async function fetchFiisHtml(ticker) {
  return fetchText(`https://fiis.com.br/${normalizeTicker(ticker)}/`);
}

function toEarningsObject(dividends, priceByPaymentDate) {
  const output = {};

  dividends.forEach((item) => {
    output[item.monthName] = {
      payment_date: item.payment_date,
      date_with: item.date_with,
      earnings: item.earnings,
      price_date_with: item.price_date_with || priceByPaymentDate.get(item.payment_date) || "R$ 0,0",
    };
  });

  return output;
}

function mergeDividendsByMonth(brapiDividends, fiisDividends, statusDividends) {
  const byMonth = new Map();

  statusDividends.forEach((item) => byMonth.set(item.monthName, item));
  fiisDividends.forEach((item) => byMonth.set(item.monthName, { ...byMonth.get(item.monthName), ...item }));
  brapiDividends.forEach((item) => byMonth.set(item.monthName, { ...byMonth.get(item.monthName), ...item }));

  return [...byMonth.values()].sort((a, b) => MONTHS.indexOf(a.monthName) - MONTHS.indexOf(b.monthName));
}

async function updateTickerDividends(db, ticker, year = currentYear()) {
  const code = normalizeTicker(ticker);
  if (!code) throw new Error("Informe --ticker TICKER11");

  const docRef = db.collection(FIIS_COLLECTION).doc(code);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error(`Ticker ${code} não encontrado em /${FIIS_COLLECTION}.`);

  const yearField = `earnings${year}`;
  const previousYearData = doc.data()?.[yearField] || {};

  let brapiDividends = [];
  let statusDividends = [];
  let fiisDividends = [];
  let priceByPaymentDate = new Map();
  const sourceErrors = [];

  try {
    brapiDividends = await fetchBrapiDividends(code, year);
  } catch (err) {
    sourceErrors.push(`brapi: ${err.message}`);
  }

  try {
    const html = await fetchStatusInvestHtml(code);
    statusDividends = parseStatusInvestDividends(html, year);
  } catch (err) {
    sourceErrors.push(`statusinvest: ${err.message}`);
  }

  try {
    const fiisHtml = await fetchFiisHtml(code);
    fiisDividends = parseFiisDividends(fiisHtml, year);
    priceByPaymentDate = parseFiisPriceByPaymentDate(fiisHtml);
  } catch (err) {
    sourceErrors.push(`fiis.com.br: ${err.message}`);
  }

  const dividends = mergeDividendsByMonth(brapiDividends, fiisDividends, statusDividends);
  if (dividends.length === 0) {
    throw new Error(`Nenhum rendimento de ${year} encontrado para ${code}. ${sourceErrors.join(" | ")}`);
  }

  const fetchedEarnings = toEarningsObject(dividends, priceByPaymentDate);
  const mergedEarnings = {
    ...previousYearData,
    ...fetchedEarnings,
  };

  const fetchedMonths = Object.keys(fetchedEarnings).sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));
  const mergedMonths = Object.keys(mergedEarnings).sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));
  const currentMonthIncluded = Boolean(mergedEarnings[currentMonthKey()]);

  await docRef.set(
    {
      [`${yearField}_previousBackup`]: previousYearData,
      [yearField]: mergedEarnings,
      dividendsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      dividendsUpdatedBy: "manual-script",
      dividendsSource: "brapi+statusinvest+fiis.com.br",
      dividendsFetchedMonths: fetchedMonths,
      dividendsMergedMonths: mergedMonths,
      dividendsSourceMonths: {
        brapi: brapiDividends.map((item) => item.monthName),
        statusinvest: statusDividends.map((item) => item.monthName),
        fiisComBr: fiisDividends.map((item) => item.monthName),
      },
      dividendsSourceErrors: sourceErrors,
      dividendsCurrentMonthIncluded: currentMonthIncluded,
      modified_in: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    ticker: code,
    year,
    fetchedMonths,
    mergedMonths,
    sourceMonths: {
      brapi: brapiDividends.map((item) => item.monthName),
      statusinvest: statusDividends.map((item) => item.monthName),
      fiisComBr: fiisDividends.map((item) => item.monthName),
    },
    sourceErrors,
    count: mergedMonths.length,
    currentMonth: currentMonthKey(),
    currentMonthIncluded,
  };
}

async function getTickersToUpdate(db) {
  const rawTickers = getArg("tickers");
  if (rawTickers) {
    return rawTickers.split(",").map(normalizeTicker).filter(Boolean);
  }

  const ticker = normalizeTicker(getArg("ticker"));
  if (ticker) return [ticker];

  if (!hasFlag("all")) return [];

  const snapshot = await db.collection(FIIS_COLLECTION).get();
  return snapshot.docs.map((doc) => normalizeTicker(doc.id)).filter(Boolean);
}

async function main() {
  const year = Number(getArg("year") || currentYear());
  const limit = Number(getArg("limit") || 0);
  const delay = Number(getArg("delay") || 750);
  const db = initFirebase();
  const tickers = await getTickersToUpdate(db);

  if (tickers.length === 0) {
    console.error("Uso: node scripts/update-dividends.mjs --ticker TGAR11 [--year 2026]");
    console.error("Ou:  node scripts/update-dividends.mjs --tickers TGAR11,MXRF11 [--year 2026]");
    console.error("Ou:  node scripts/update-dividends.mjs --all [--limit 50] [--delay 750]");
    process.exit(1);
  }

  const selectedTickers = limit > 0 ? tickers.slice(0, limit) : tickers;

  await backupFiis(db);

  const summary = {
    year,
    requested: selectedTickers.length,
    updated: 0,
    failed: 0,
    details: [],
  };

  for (const code of selectedTickers) {
    try {
      console.log(`Atualizando ${code}...`);
      const result = await updateTickerDividends(db, code, year);
      summary.updated += 1;
      summary.details.push({ ticker: code, ok: true, result });
      console.log(`OK ${code}: ${result.mergedMonths.join(", ")}`);
    } catch (err) {
      summary.failed += 1;
      summary.details.push({ ticker: code, ok: false, error: err.message });
      console.error(`ERRO ${code}: ${err.message}`);
    }

    if (delay > 0) await sleep(delay);
  }

  await db.collection(PARAMETERS_COLLECTION).doc("dividendsMassUpdate").set(
    {
      ...summary,
      details: summary.details.slice(-100),
      finishedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log("Resumo da atualização:");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error("Falha na atualização de dividendos:", err);
  process.exit(1);
});
