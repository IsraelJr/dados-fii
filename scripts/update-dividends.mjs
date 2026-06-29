import admin from "firebase-admin";

const FIIS_COLLECTION = "Fiis";
const BACKUP_COLLECTION = "Fiis_Backup";
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

function getArg(name) {
  const prefix = `--${name}=`;
  const withEquals = process.argv.find((arg) => arg.startsWith(prefix));
  if (withEquals) return withEquals.replace(prefix, "").trim();

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1]?.trim();

  return "";
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

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; DadosFIIUpdater/1.1)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return response.text();
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
  console.log(`Backup concluído: ${total} documentos copiados.`);
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

function parseFiisPriceByPaymentDate(html) {
  const blocks = [...String(html || "").matchAll(/<[^>]+class=["'][^"']*yieldChart__table__bloco[^"']*["'][^>]*>[\s\S]*?(?=<[^>]+class=["'][^"']*yieldChart__table__bloco|<\/body>|$)/gi)]
    .map((match) => match[0]);

  const map = new Map();

  for (const block of blocks) {
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

async function fetchPriceDateWithMap(ticker) {
  try {
    const html = await fetchText(`https://fiis.com.br/${normalizeTicker(ticker)}/`);
    return parseFiisPriceByPaymentDate(html);
  } catch (err) {
    console.warn(`Não consegui buscar preço-base no fiis.com.br para ${ticker}: ${err.message}`);
    return new Map();
  }
}

function toEarningsObject(dividends, priceByPaymentDate) {
  const output = {};

  dividends.forEach((item) => {
    output[item.monthName] = {
      payment_date: item.payment_date,
      date_with: item.date_with,
      earnings: item.earnings,
      price_date_with: priceByPaymentDate.get(item.payment_date) || "R$ 0,0",
    };
  });

  return output;
}

async function updateTickerDividends(db, ticker, year = currentYear()) {
  const code = normalizeTicker(ticker);
  if (!code) throw new Error("Informe --ticker TICKER11");

  const docRef = db.collection(FIIS_COLLECTION).doc(code);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error(`Ticker ${code} não encontrado em /${FIIS_COLLECTION}.`);

  const yearField = `earnings${year}`;
  const previousYearData = doc.data()?.[yearField] || {};

  const html = await fetchStatusInvestHtml(code);
  const dividends = parseStatusInvestDividends(html, year);
  if (dividends.length === 0) throw new Error(`Nenhum rendimento de ${year} encontrado para ${code}.`);

  const priceByPaymentDate = await fetchPriceDateWithMap(code);
  const fetchedEarnings = toEarningsObject(dividends, priceByPaymentDate);
  const mergedEarnings = {
    ...previousYearData,
    ...fetchedEarnings,
  };

  const fetchedMonths = Object.keys(fetchedEarnings);
  const mergedMonths = Object.keys(mergedEarnings).sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));
  const currentMonthIncluded = Boolean(mergedEarnings[currentMonthKey()]);

  await docRef.set(
    {
      [`${yearField}_previousBackup`]: previousYearData,
      [yearField]: mergedEarnings,
      dividendsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      dividendsUpdatedBy: "manual-script",
      dividendsSource: "statusinvest+fiis.com.br",
      dividendsFetchedMonths: fetchedMonths,
      dividendsMergedMonths: mergedMonths,
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
    count: mergedMonths.length,
    currentMonth: currentMonthKey(),
    currentMonthIncluded,
  };
}

async function main() {
  const ticker = normalizeTicker(getArg("ticker"));
  const year = Number(getArg("year") || currentYear());

  if (!ticker) {
    console.error("Uso: node scripts/update-dividends.mjs --ticker TGAR11 [--year 2026]");
    process.exit(1);
  }

  const db = initFirebase();

  await backupFiis(db);
  const result = await updateTickerDividends(db, ticker, year);

  console.log("Atualização concluída:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Falha na atualização de dividendos:", err);
  process.exit(1);
});
