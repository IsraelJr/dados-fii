import admin from "firebase-admin";

const FIIS_COLLECTION = "Fiis";
const PARAMETERS_COLLECTION = "Parameters";

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

function stripTags(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; DadosFIICnpjUpdater/1.0)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return response.text();
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
      if (html.includes("CNPJ")) return { html, url };
      errors.push(`${url}: CNPJ não encontrado no HTML`);
    } catch (err) {
      errors.push(err.message);
    }
  }

  throw new Error(errors.join(" | "));
}

function extractFundCnpjFromStatusInvest(html) {
  const text = stripTags(html);
  const cnpjSection = text.match(/CNPJ\s+(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i);
  if (cnpjSection?.[1]) return cnpjSection[1];

  const firstCnpj = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
  return firstCnpj?.[0] || "";
}

async function getTickersToUpdate(db) {
  const rawTickers = getArg("tickers");
  if (rawTickers) return rawTickers.split(",").map(normalizeTicker).filter(Boolean);

  const ticker = normalizeTicker(getArg("ticker"));
  if (ticker) return [ticker];

  if (!hasFlag("all")) return [];

  const snapshot = await db.collection(FIIS_COLLECTION).get();
  return snapshot.docs.map((doc) => normalizeTicker(doc.id)).filter(Boolean);
}

async function enrichTicker(db, ticker) {
  const code = normalizeTicker(ticker);
  const docRef = db.collection(FIIS_COLLECTION).doc(code);
  const doc = await docRef.get();

  if (!doc.exists) throw new Error(`${code} não encontrado em /${FIIS_COLLECTION}.`);

  const { html, url } = await fetchStatusInvestHtml(code);
  const cnpj = extractFundCnpjFromStatusInvest(html);

  if (!cnpj) throw new Error(`CNPJ não encontrado para ${code}.`);

  await docRef.set(
    {
      cnpj,
      modified_in: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { ticker: code, cnpj, source: url };
}

async function main() {
  const db = initFirebase();
  const year = new Date().getFullYear();
  const limit = Number(getArg("limit") || 0);
  const delay = Number(getArg("delay") || 750);
  const tickers = await getTickersToUpdate(db);

  if (!tickers.length) {
    console.error("Uso: node scripts/enrich-fii-cnpj.mjs --ticker TGAR11");
    console.error("Ou:  node scripts/enrich-fii-cnpj.mjs --tickers TGAR11,MXRF11");
    console.error("Ou:  node scripts/enrich-fii-cnpj.mjs --all --limit 50 --delay 750");
    process.exit(1);
  }

  const selectedTickers = limit > 0 ? tickers.slice(0, limit) : tickers;
  const summary = { year, requested: selectedTickers.length, updated: 0, failed: 0, details: [] };

  for (const ticker of selectedTickers) {
    try {
      console.log(`Buscando CNPJ de ${ticker}...`);
      const result = await enrichTicker(db, ticker);
      summary.updated += 1;
      summary.details.push({ ok: true, ...result });
      console.log(`OK ${ticker}: ${result.cnpj}`);
    } catch (err) {
      summary.failed += 1;
      summary.details.push({ ok: false, ticker, error: err.message });
      console.error(`ERRO ${ticker}: ${err.message}`);
    }

    if (delay > 0) await sleep(delay);
  }

  await db.collection(PARAMETERS_COLLECTION).doc("cnpjEnrichment").set(
    {
      ...summary,
      details: summary.details.slice(-100),
      finishedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log("Resumo do enriquecimento de CNPJ:");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error("Falha ao enriquecer CNPJs:", err);
  process.exit(1);
});
