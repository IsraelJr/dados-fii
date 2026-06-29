import admin from "firebase-admin";
import { inflateRawSync } from "node:zlib";

const FIIS_COLLECTION = "Fiis";
const BACKUP_COLLECTION = "Fiis_Backup";
const PARAMETERS_COLLECTION = "Parameters";
const TIME_ZONE = "America/Sao_Paulo";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function saoPauloDateParts() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}
function currentYear() { return Number(saoPauloDateParts().year); }
function currentMonthKey() { return MONTHS[Number(saoPauloDateParts().month) - 1]; }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function getArg(name) {
  const prefix = `--${name}=`;
  const withEquals = process.argv.find((arg) => arg.startsWith(prefix));
  if (withEquals) return withEquals.replace(prefix, "").trim();
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1]?.trim();
  return "";
}
function hasFlag(name) { return process.argv.includes(`--${name}`); }
function initFirebase() {
  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!rawKey) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY não configurada.");
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(rawKey)) });
  return admin.firestore();
}
function normalizeTicker(value) { return String(value || "").trim().toUpperCase(); }
function onlyDigits(value) { return String(value || "").replace(/\D/g, ""); }
function normalizeText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/gi, " ").replace(/\s+/g, " ").trim().toUpperCase();
}
function decodeHtml(value) {
  return String(value || "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}
function stripTags(value) { return decodeHtml(String(value || "").replace(/<[^>]+>/g, " ")); }
function normalizeDate(value) { return String(value || "").replace(/\./g, "/").trim(); }
function normalizeCurrency(value) {
  const text = stripTags(value).replace(/\s+/g, " ").trim();
  if (!text) return "R$ 0,0";
  return text.startsWith("R$") ? text : `R$ ${text.replace("R$", "").trim()}`;
}
function parseNumberBR(value) {
  const text = String(value ?? "").trim();
  if (!text) return 0;
  const cleaned = text.replace(/R\$/gi, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}
function formatCurrency(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "R$ 0,0";
  return `R$ ${number.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`;
}
function toDateOnly(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}
function monthNameFromDate(value) {
  const date = parseAnyDate(value);
  if (!date) return "";
  return MONTHS[date.getUTCMonth()];
}
function parseAnyDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  const br = text.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (br) return new Date(Date.UTC(Number(br[3]), Number(br[2]) - 1, Number(br[1])));
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}
function dateLabelFromYearMonth(year, monthIndex) { return `${String(monthIndex + 1).padStart(2, "0")}/${year}`; }

async function fetchText(url) {
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; DadosFIIUpdater/1.4)", Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" } });
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return response.text();
}
async function fetchBuffer(url) {
  const response = await fetch(url, { headers: { "User-Agent": "DadosFIIUpdater/1.4", Accept: "application/zip,application/octet-stream,*/*" } });
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
async function updateBackupParameter(db, payload) {
  await db.collection(PARAMETERS_COLLECTION).doc("backup").set({ lastFiisBackupAt: admin.firestore.FieldValue.serverTimestamp(), ...payload }, { merge: true });
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
    batch.set(db.collection(BACKUP_COLLECTION).doc(doc.id), { ...doc.data(), backup_source_collection: FIIS_COLLECTION, backup_id: backupId, backup_date: admin.firestore.FieldValue.serverTimestamp() }, { merge: false });
    batchCount += 1; total += 1;
    if (batchCount >= 450) { await batch.commit(); batch = db.batch(); batchCount = 0; }
  }
  if (batchCount > 0) await batch.commit();
  await updateBackupParameter(db, { lastFiisBackupId: backupId, lastFiisBackupType: "full-collection", lastFiisBackupSource: FIIS_COLLECTION, lastFiisBackupTarget: BACKUP_COLLECTION, lastFiisBackupDocuments: total });
  console.log(`Backup concluído: ${total} documentos copiados.`);
}

function readZipEntries(buffer) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 70000); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("ZIP CVM inválido: EOCD não encontrado.");
  const entriesCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  for (let i = 0; i < entriesCount; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.slice(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.slice(dataStart, dataStart + compressedSize);
    let content;
    if (method === 0) content = compressed;
    else if (method === 8) content = inflateRawSync(compressed);
    else throw new Error(`Método ZIP não suportado: ${method}`);
    entries.push({ name, content });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') { cell += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === ";" && !inQuotes) {
      row.push(cell); cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => String(v).trim() !== "")) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); if (row.some((v) => String(v).trim() !== "")) rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => String(h || "").trim());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((h, index) => [h, values[index] ?? ""])));
}
function getCvmZipUrl(year) { return `https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_${year}.zip`; }
async function fetchCvmRows(year) {
  const zip = await fetchBuffer(getCvmZipUrl(year));
  const entries = readZipEntries(zip).filter((entry) => entry.name.toLowerCase().endsWith(".csv"));
  const rows = [];
  for (const entry of entries) {
    const text = entry.content.toString("latin1");
    rows.push(...parseCsv(text));
  }
  return rows;
}
function getDocCnpj(docData) {
  const keys = Object.keys(docData || {});
  for (const key of keys) if (normalizeText(key).includes("CNPJ")) {
    const digits = onlyDigits(docData[key]);
    if (digits.length >= 8) return digits;
  }
  return "";
}
function getFundAliases(docData, ticker) {
  const fields = [ticker, docData?.code, docData?.socialReason, docData?.razaoSocial, docData?.denomSocial, docData?.denominacaoSocial, docData?.name, docData?.nome, docData?.fundName];
  return fields.map(normalizeText).filter((v) => v.length >= 4);
}
function rowMatchesFund(row, docData, ticker) {
  const docCnpj = getDocCnpj(docData);
  if (docCnpj) {
    for (const [key, value] of Object.entries(row)) if (normalizeText(key).includes("CNPJ") && onlyDigits(value) === docCnpj) return true;
  }
  const aliases = getFundAliases(docData, ticker).filter((a) => a.length >= 8);
  if (!aliases.length) return false;
  const nameValues = Object.entries(row)
    .filter(([key]) => /DENOM|NOME|FUNDO|CLASSE|SOCIAL/i.test(normalizeText(key)))
    .map(([, value]) => normalizeText(value))
    .filter((value) => value.length >= 8);
  return nameValues.some((name) => aliases.some((alias) => name === alias || name.includes(alias) || alias.includes(name)));
}
function getRowCompetence(row) {
  const candidates = Object.entries(row).filter(([key]) => /DT.*COMPTC|DT.*REFER|DATA.*REFER|COMPET|REFERENCIA/i.test(normalizeText(key)));
  for (const [, value] of candidates) {
    const date = parseAnyDate(value);
    if (date) return date;
  }
  return null;
}
function getCvmDividendValue(row) {
  const candidates = [];
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeText(key);
    const isDividend = (normalizedKey.includes("REND") && (normalizedKey.includes("DISTR") || normalizedKey.includes("PAGO") || normalizedKey.includes("PAG"))) || normalizedKey.includes("VL RENDIMENTO");
    const isBad = normalizedKey.includes("RENTAB") || normalizedKey.includes("DESP") || normalizedKey.includes("TAXA") || normalizedKey.includes("ENCARGO") || normalizedKey.includes("QT") || normalizedKey.includes("COTISTA");
    if (!isDividend || isBad) continue;
    const number = parseNumberBR(value);
    if (number > 0) candidates.push(number);
  }
  if (!candidates.length) return 0;
  return Math.max(...candidates);
}
async function fetchCvmDividendsForFund(docData, ticker, year = currentYear()) {
  const rows = await fetchCvmRows(year);
  const byMonth = new Map();
  for (const row of rows) {
    if (!rowMatchesFund(row, docData, ticker)) continue;
    const competence = getRowCompetence(row);
    if (!competence || competence.getUTCFullYear() !== year) continue;
    const value = getCvmDividendValue(row);
    if (value <= 0) continue;
    const monthIndex = competence.getUTCMonth();
    const monthName = MONTHS[monthIndex];
    const existing = byMonth.get(monthName);
    if (!existing || parseNumberBR(existing.earnings) < value) {
      byMonth.set(monthName, { monthName, date_with: "", payment_date: `CVM ${dateLabelFromYearMonth(year, monthIndex)}`, earnings: formatCurrency(value), source: "cvm" });
    }
  }
  return [...byMonth.values()].sort((a, b) => MONTHS.indexOf(a.monthName) - MONTHS.indexOf(b.monthName));
}

function extractRows(html) { return [...String(html || "").matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((match) => match[0]); }
function extractCells(rowHtml) {
  return [...String(rowHtml || "").matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)].map((match) => ({ attrs: match[1] || "", html: match[2] || "", text: stripTags(match[2] || "") }));
}
function getTitle(attrs) { const match = String(attrs || "").match(/title=["']([^"']+)["']/i); return decodeHtml(match?.[1] || ""); }
function parseStatusInvestDividends(html, year = currentYear()) {
  const dividends = [];
  for (const row of extractRows(html)) {
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
    if (monthName) dividends.push({ monthName, date_with: dateWith, payment_date: payDate, earnings: value, source: "statusinvest" });
  }
  return dividends;
}
async function fetchStatusInvestHtml(ticker) {
  const code = normalizeTicker(ticker);
  const paths = [`fundos-imobiliarios/${code}`, `fiagros/${code}`, `fiinfras/${code}`];
  const errors = [];
  for (const path of paths) {
    const url = `https://statusinvest.com.br/${path}`;
    try { const html = await fetchText(url); if (extractRows(html).length > 0) return html; errors.push(`${url}: sem linhas úteis`); }
    catch (err) { errors.push(err.message); }
  }
  throw new Error(`Não consegui ler StatusInvest para ${code}. ${errors.join(" | ")}`);
}
function extractFiisDividendBlocks(html) {
  return [...String(html || "").matchAll(/<[^>]+class=["'][^"']*yieldChart__table__bloco[^"']*["'][^>]*>[\s\S]*?(?=<[^>]+class=["'][^"']*yieldChart__table__bloco|<\/body>|$)/gi)].map((match) => match[0]);
}
function parseFiisDividends(html, year = currentYear()) {
  const dividends = [];
  for (const block of extractFiisDividendBlocks(html)) {
    const lines = [...block.matchAll(/<[^>]+class=["'][^"']*table__linha[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi)].map((match) => stripTags(match[1]));
    if (lines.length < 5) continue;
    const dateWith = normalizeDate(lines[0]);
    const payDate = normalizeDate(lines[1]);
    const priceDateWith = normalizeCurrency(lines[2]);
    const earnings = normalizeCurrency(lines[4]);
    const [, month, rowYear] = payDate.match(/(\d{2})\/(\d{2})\/(\d{4})/) || [];
    if (!month || Number(rowYear) !== year) continue;
    const monthName = MONTHS[Number(month) - 1];
    if (monthName) dividends.push({ monthName, date_with: dateWith, payment_date: payDate, earnings, price_date_with: priceDateWith, source: "fiis.com.br" });
  }
  return dividends;
}
function parseFiisPriceByPaymentDate(html) {
  const map = new Map();
  for (const block of extractFiisDividendBlocks(html)) {
    const lines = [...block.matchAll(/<[^>]+class=["'][^"']*table__linha[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi)].map((match) => stripTags(match[1]));
    if (lines.length >= 3) { const paymentDate = normalizeDate(lines[1]); const price = normalizeCurrency(lines[2]); if (paymentDate) map.set(paymentDate, price); }
  }
  return map;
}
async function fetchFiisHtml(ticker) { return fetchText(`https://fiis.com.br/${normalizeTicker(ticker)}/`); }
function toEarningsObject(dividends, priceByPaymentDate) {
  const output = {};
  dividends.forEach((item) => { output[item.monthName] = { payment_date: item.payment_date, date_with: item.date_with, earnings: item.earnings, price_date_with: item.price_date_with || priceByPaymentDate.get(item.payment_date) || "R$ 0,0" }; });
  return output;
}
function mergeDividendsByMonth(cvmDividends, fiisDividends, statusDividends) {
  const byMonth = new Map();
  statusDividends.forEach((item) => byMonth.set(item.monthName, item));
  fiisDividends.forEach((item) => byMonth.set(item.monthName, { ...byMonth.get(item.monthName), ...item }));
  cvmDividends.forEach((item) => byMonth.set(item.monthName, { ...byMonth.get(item.monthName), ...item }));
  return [...byMonth.values()].sort((a, b) => MONTHS.indexOf(a.monthName) - MONTHS.indexOf(b.monthName));
}

async function updateTickerDividends(db, ticker, year = currentYear()) {
  const code = normalizeTicker(ticker);
  if (!code) throw new Error("Informe --ticker TICKER11");
  const docRef = db.collection(FIIS_COLLECTION).doc(code);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error(`Ticker ${code} não encontrado em /${FIIS_COLLECTION}.`);
  const docData = doc.data() || {};
  const yearField = `earnings${year}`;
  const previousYearData = docData?.[yearField] || {};
  let cvmDividends = [], statusDividends = [], fiisDividends = [];
  let priceByPaymentDate = new Map();
  const sourceErrors = [];
  try { cvmDividends = await fetchCvmDividendsForFund(docData, code, year); } catch (err) { sourceErrors.push(`cvm: ${err.message}`); }
  try { const html = await fetchStatusInvestHtml(code); statusDividends = parseStatusInvestDividends(html, year); } catch (err) { sourceErrors.push(`statusinvest: ${err.message}`); }
  try { const fiisHtml = await fetchFiisHtml(code); fiisDividends = parseFiisDividends(fiisHtml, year); priceByPaymentDate = parseFiisPriceByPaymentDate(fiisHtml); } catch (err) { sourceErrors.push(`fiis.com.br: ${err.message}`); }
  const dividends = mergeDividendsByMonth(cvmDividends, fiisDividends, statusDividends);
  if (!dividends.length) throw new Error(`Nenhum rendimento de ${year} encontrado para ${code}. ${sourceErrors.join(" | ")}`);
  const fetchedEarnings = toEarningsObject(dividends, priceByPaymentDate);
  const mergedEarnings = { ...previousYearData, ...fetchedEarnings };
  const fetchedMonths = Object.keys(fetchedEarnings).sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));
  const mergedMonths = Object.keys(mergedEarnings).sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));
  const currentMonthIncluded = Boolean(mergedEarnings[currentMonthKey()]);
  await docRef.set({ [`${yearField}_previousBackup`]: previousYearData, [yearField]: mergedEarnings, dividendsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(), dividendsUpdatedBy: "manual-script", dividendsSource: "cvm+statusinvest+fiis.com.br", dividendsFetchedMonths: fetchedMonths, dividendsMergedMonths: mergedMonths, dividendsSourceMonths: { cvm: cvmDividends.map((i) => i.monthName), statusinvest: statusDividends.map((i) => i.monthName), fiisComBr: fiisDividends.map((i) => i.monthName) }, dividendsSourceErrors: sourceErrors, dividendsCurrentMonthIncluded: currentMonthIncluded, modified_in: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return { ticker: code, year, fetchedMonths, mergedMonths, sourceMonths: { cvm: cvmDividends.map((i) => i.monthName), statusinvest: statusDividends.map((i) => i.monthName), fiisComBr: fiisDividends.map((i) => i.monthName) }, sourceErrors, count: mergedMonths.length, currentMonth: currentMonthKey(), currentMonthIncluded };
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
async function main() {
  const year = Number(getArg("year") || currentYear());
  const limit = Number(getArg("limit") || 0);
  const delay = Number(getArg("delay") || 750);
  const db = initFirebase();
  const tickers = await getTickersToUpdate(db);
  if (!tickers.length) {
    console.error("Uso: node scripts/update-dividends.mjs --ticker TGAR11 [--year 2026]");
    console.error("Ou:  node scripts/update-dividends.mjs --tickers TGAR11,MXRF11 [--year 2026]");
    console.error("Ou:  node scripts/update-dividends.mjs --all [--limit 50] [--delay 750]");
    process.exit(1);
  }
  const selectedTickers = limit > 0 ? tickers.slice(0, limit) : tickers;
  await backupFiis(db);
  const summary = { year, requested: selectedTickers.length, updated: 0, failed: 0, details: [] };
  for (const code of selectedTickers) {
    try { console.log(`Atualizando ${code}...`); const result = await updateTickerDividends(db, code, year); summary.updated += 1; summary.details.push({ ticker: code, ok: true, result }); console.log(`OK ${code}: ${result.mergedMonths.join(", ")}`); }
    catch (err) { summary.failed += 1; summary.details.push({ ticker: code, ok: false, error: err.message }); console.error(`ERRO ${code}: ${err.message}`); }
    if (delay > 0) await sleep(delay);
  }
  await db.collection(PARAMETERS_COLLECTION).doc("dividendsMassUpdate").set({ ...summary, details: summary.details.slice(-100), finishedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  console.log("Resumo da atualização:");
  console.log(JSON.stringify(summary, null, 2));
}
main().catch((err) => { console.error("Falha na atualização de dividendos:", err); process.exit(1); });
