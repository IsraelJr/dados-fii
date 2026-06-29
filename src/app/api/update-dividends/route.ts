import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { inflateRawSync } from "node:zlib";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

const FIIS_COLLECTION = "Fiis";
const BACKUP_COLLECTION = "Fiis_Backup";
const PARAMETERS_COLLECTION = "Parameters";
const DIVIDEND_REQUESTS_DOC = "DividendUpdateRequests";
const TIME_ZONE = "America/Sao_Paulo";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type DividendItem = { monthName: string; date_with: string; payment_date: string; earnings: string; price_date_with?: string; source: string };

function saoPauloDateParts() {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}
function todayKey() { const parts = saoPauloDateParts(); return `${parts.year}-${parts.month}-${parts.day}`; }
function currentYear() { return Number(saoPauloDateParts().year); }
function currentMonthKey() { return MONTHS[Number(saoPauloDateParts().month) - 1]; }
function normalizeTicker(value: string) { return String(value || "").trim().toUpperCase(); }
function onlyDigits(value: any) { return String(value || "").replace(/\D/g, ""); }
function normalizeText(value: any) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/gi, " ").replace(/\s+/g, " ").trim().toUpperCase(); }
function decodeHtml(value: string) { return String(value || "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim(); }
function stripTags(value: string) { return decodeHtml(String(value || "").replace(/<[^>]+>/g, " ")); }
function normalizeDate(value: string) { return String(value || "").replace(/\./g, "/").trim(); }
function normalizeCurrency(value: string) { const text = stripTags(value).replace(/\s+/g, " ").trim(); if (!text) return "R$ 0,0"; return text.startsWith("R$") ? text : `R$ ${text.replace("R$", "").trim()}`; }
function parseNumberBR(value: any) { const cleaned = String(value ?? "").replace(/R\$/gi, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, ""); const n = Number(cleaned); return Number.isFinite(n) ? n : 0; }
function formatCurrency(value: any) { const number = Number(value); if (!Number.isFinite(number)) return "R$ 0,0"; return `R$ ${number.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`; }
function parseAnyDate(value: any) { const text = String(value || "").trim(); if (!text) return null; const iso = text.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/); if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))); const br = text.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/); if (br) return new Date(Date.UTC(Number(br[3]), Number(br[2]) - 1, Number(br[1]))); const date = new Date(text); return Number.isNaN(date.getTime()) ? null : date; }
function dateLabelFromYearMonth(year: number, monthIndex: number) { return `${String(monthIndex + 1).padStart(2, "0")}/${year}`; }

async function fetchText(url: string) {
    const response = await fetch(url, { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0 (compatible; DadosFIIUpdater/1.4)", Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" } });
    if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
    return response.text();
}
async function fetchBuffer(url: string) {
    const response = await fetch(url, { cache: "no-store", headers: { "User-Agent": "DadosFIIUpdater/1.4", Accept: "application/zip,application/octet-stream,*/*" } });
    if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
}
async function updateBackupParameter(payload: Record<string, any>) {
    await adminDb.collection(PARAMETERS_COLLECTION).doc("backup").set({ lastFiisBackupAt: adminFieldValue.serverTimestamp(), ...payload }, { merge: true });
}

function readZipEntries(buffer: Buffer) {
    let eocd = -1;
    for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 70000); i--) if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("ZIP CVM inválido: EOCD não encontrado.");
    const entriesCount = buffer.readUInt16LE(eocd + 10);
    let offset = buffer.readUInt32LE(eocd + 16);
    const entries: Array<{ name: string; content: Buffer }> = [];
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
        const content = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null;
        if (!content) throw new Error(`Método ZIP não suportado: ${method}`);
        entries.push({ name, content });
        offset += 46 + fileNameLength + extraLength + commentLength;
    }
    return entries;
}
function parseCsv(text: string) {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i], next = text[i + 1];
        if (char === '"') { if (inQuotes && next === '"') { cell += '"'; i++; } else inQuotes = !inQuotes; }
        else if (char === ";" && !inQuotes) { row.push(cell); cell = ""; }
        else if ((char === "\n" || char === "\r") && !inQuotes) { if (char === "\r" && next === "\n") i++; row.push(cell); cell = ""; if (row.some((v) => String(v).trim() !== "")) rows.push(row); row = []; }
        else cell += char;
    }
    if (cell || row.length) { row.push(cell); if (row.some((v) => String(v).trim() !== "")) rows.push(row); }
    if (!rows.length) return [];
    const headers = rows[0].map((h) => String(h || "").trim());
    return rows.slice(1).map((values) => Object.fromEntries(headers.map((h, index) => [h, values[index] ?? ""])));
}
async function fetchCvmRows(year: number) {
    const zip = await fetchBuffer(`https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_${year}.zip`);
    const entries = readZipEntries(zip).filter((entry) => entry.name.toLowerCase().endsWith(".csv"));
    const rows: Record<string, string>[] = [];
    for (const entry of entries) rows.push(...parseCsv(entry.content.toString("latin1")) as Record<string, string>[]);
    return rows;
}
function getDocCnpj(docData: Record<string, any>) { for (const key of Object.keys(docData || {})) if (normalizeText(key).includes("CNPJ")) { const digits = onlyDigits(docData[key]); if (digits.length >= 8) return digits; } return ""; }
function getFundAliases(docData: Record<string, any>, ticker: string) { return [ticker, docData?.code, docData?.socialReason, docData?.razaoSocial, docData?.denomSocial, docData?.denominacaoSocial, docData?.name, docData?.nome, docData?.fundName].map(normalizeText).filter((v) => v.length >= 4); }
function rowMatchesFund(row: Record<string, any>, docData: Record<string, any>, ticker: string) {
    const docCnpj = getDocCnpj(docData);
    if (docCnpj) for (const [key, value] of Object.entries(row)) if (normalizeText(key).includes("CNPJ") && onlyDigits(value) === docCnpj) return true;
    const aliases = getFundAliases(docData, ticker).filter((a) => a.length >= 8);
    if (!aliases.length) return false;
    const nameValues = Object.entries(row).filter(([key]) => /DENOM|NOME|FUNDO|CLASSE|SOCIAL/i.test(normalizeText(key))).map(([, value]) => normalizeText(value)).filter((value) => value.length >= 8);
    return nameValues.some((name) => aliases.some((alias) => name === alias || name.includes(alias) || alias.includes(name)));
}
function getRowCompetence(row: Record<string, any>) { for (const [key, value] of Object.entries(row)) if (/DT.*COMPTC|DT.*REFER|DATA.*REFER|COMPET|REFERENCIA/i.test(normalizeText(key))) { const date = parseAnyDate(value); if (date) return date; } return null; }
function getCvmDividendValue(row: Record<string, any>) {
    const candidates: number[] = [];
    for (const [key, value] of Object.entries(row)) {
        const k = normalizeText(key);
        const isDividend = (k.includes("REND") && (k.includes("DISTR") || k.includes("PAGO") || k.includes("PAG"))) || k.includes("VL RENDIMENTO");
        const isBad = k.includes("RENTAB") || k.includes("DESP") || k.includes("TAXA") || k.includes("ENCARGO") || k.includes("QT") || k.includes("COTISTA");
        if (!isDividend || isBad) continue;
        const number = parseNumberBR(value);
        if (number > 0) candidates.push(number);
    }
    return candidates.length ? Math.max(...candidates) : 0;
}
async function fetchCvmDividendsForFund(docData: Record<string, any>, ticker: string, year = currentYear()): Promise<DividendItem[]> {
    const rows = await fetchCvmRows(year);
    const byMonth = new Map<string, DividendItem>();
    for (const row of rows) {
        if (!rowMatchesFund(row, docData, ticker)) continue;
        const competence = getRowCompetence(row);
        if (!competence || competence.getUTCFullYear() !== year) continue;
        const value = getCvmDividendValue(row);
        if (value <= 0) continue;
        const monthIndex = competence.getUTCMonth();
        const monthName = MONTHS[monthIndex];
        const existing = byMonth.get(monthName);
        if (!existing || parseNumberBR(existing.earnings) < value) byMonth.set(monthName, { monthName, date_with: "", payment_date: `CVM ${dateLabelFromYearMonth(year, monthIndex)}`, earnings: formatCurrency(value), source: "cvm" });
    }
    return [...byMonth.values()].sort((a, b) => MONTHS.indexOf(a.monthName) - MONTHS.indexOf(b.monthName));
}
function extractRows(html: string) { return [...String(html || "").matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((match) => match[0]); }
function extractCells(rowHtml: string) { return [...String(rowHtml || "").matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)].map((match) => ({ attrs: match[1] || "", html: match[2] || "", text: stripTags(match[2] || "") })); }
function getTitle(attrs: string) { const match = String(attrs || "").match(/title=["']([^"']+)["']/i); return decodeHtml(match?.[1] || ""); }
function parseStatusInvestDividends(html: string, year = currentYear()): DividendItem[] {
    const dividends: DividendItem[] = [];
    for (const row of extractRows(html)) {
        const cells = extractCells(row); if (cells.length < 4) continue;
        const type = getTitle(cells[0].attrs).toLowerCase(); if (type && type !== "rendimento") continue;
        const dateWith = normalizeDate(cells[1].text), payDate = normalizeDate(cells[2].text), value = normalizeCurrency(cells[3].html);
        const [, month, rowYear] = payDate.match(/(\d{2})\/(\d{2})\/(\d{4})/) || [];
        if (!month || Number(rowYear) !== year) continue;
        const monthName = MONTHS[Number(month) - 1]; if (monthName) dividends.push({ monthName, date_with: dateWith, payment_date: payDate, earnings: value, source: "statusinvest" });
    }
    return dividends;
}
async function fetchStatusInvestHtml(ticker: string) {
    const code = normalizeTicker(ticker); const paths = [`fundos-imobiliarios/${code}`, `fiagros/${code}`, `fiinfras/${code}`]; const errors: string[] = [];
    for (const path of paths) { const url = `https://statusinvest.com.br/${path}`; try { const html = await fetchText(url); if (extractRows(html).length > 0) return html; errors.push(`${url}: sem linhas úteis`); } catch (err: any) { errors.push(err.message); } }
    throw new Error(`Não consegui ler StatusInvest para ${code}. ${errors.join(" | ")}`);
}
function extractFiisDividendBlocks(html: string) { return [...String(html || "").matchAll(/<[^>]+class=["'][^"']*yieldChart__table__bloco[^"']*["'][^>]*>[\s\S]*?(?=<[^>]+class=["'][^"']*yieldChart__table__bloco|<\/body>|$)/gi)].map((match) => match[0]); }
function parseFiisDividends(html: string, year = currentYear()): DividendItem[] {
    const dividends: DividendItem[] = [];
    for (const block of extractFiisDividendBlocks(html)) {
        const lines = [...block.matchAll(/<[^>]+class=["'][^"']*table__linha[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi)].map((match) => stripTags(match[1]));
        if (lines.length < 5) continue;
        const dateWith = normalizeDate(lines[0]), payDate = normalizeDate(lines[1]), priceDateWith = normalizeCurrency(lines[2]), earnings = normalizeCurrency(lines[4]);
        const [, month, rowYear] = payDate.match(/(\d{2})\/(\d{2})\/(\d{4})/) || [];
        if (!month || Number(rowYear) !== year) continue;
        const monthName = MONTHS[Number(month) - 1]; if (monthName) dividends.push({ monthName, date_with: dateWith, payment_date: payDate, earnings, price_date_with: priceDateWith, source: "fiis.com.br" });
    }
    return dividends;
}
function parseFiisPriceByPaymentDate(html: string) { const map = new Map<string, string>(); for (const block of extractFiisDividendBlocks(html)) { const lines = [...block.matchAll(/<[^>]+class=["'][^"']*table__linha[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi)].map((match) => stripTags(match[1])); if (lines.length >= 3) { const paymentDate = normalizeDate(lines[1]); const price = normalizeCurrency(lines[2]); if (paymentDate) map.set(paymentDate, price); } } return map; }
async function fetchFiisHtml(ticker: string) { return fetchText(`https://fiis.com.br/${normalizeTicker(ticker)}/`); }
function toEarningsObject(dividends: DividendItem[], priceByPaymentDate: Map<string, string>) { const output: Record<string, any> = {}; dividends.forEach((item) => { output[item.monthName] = { payment_date: item.payment_date, date_with: item.date_with, earnings: item.earnings, price_date_with: item.price_date_with || priceByPaymentDate.get(item.payment_date) || "R$ 0,0" }; }); return output; }
function mergeDividendsByMonth(cvmDividends: DividendItem[], fiisDividends: DividendItem[], statusDividends: DividendItem[]) { const byMonth = new Map<string, DividendItem>(); statusDividends.forEach((item) => byMonth.set(item.monthName, item)); fiisDividends.forEach((item) => byMonth.set(item.monthName, { ...byMonth.get(item.monthName), ...item })); cvmDividends.forEach((item) => byMonth.set(item.monthName, { ...byMonth.get(item.monthName), ...item })); return [...byMonth.values()].sort((a, b) => MONTHS.indexOf(a.monthName) - MONTHS.indexOf(b.monthName)); }
async function backupTicker(code: string) {
    const docRef = adminDb.collection(FIIS_COLLECTION).doc(code); const doc = await docRef.get(); if (!doc.exists) throw new Error(`Ticker ${code} não encontrado em /${FIIS_COLLECTION}.`);
    await adminDb.collection(BACKUP_COLLECTION).doc(code).set({ ...doc.data(), backup_source_collection: FIIS_COLLECTION, backup_date: adminFieldValue.serverTimestamp(), backup_reason: "before-user-dividend-update" }, { merge: false });
    await updateBackupParameter({ lastFiisBackupType: "single-document", lastFiisBackupSource: `${FIIS_COLLECTION}/${code}`, lastFiisBackupTarget: `${BACKUP_COLLECTION}/${code}`, lastFiisBackupTicker: code });
    return doc;
}
async function updateTickerDividends(code: string, year = currentYear()) {
    const doc = await backupTicker(code); const docData = doc.data() || {}; const yearField = `earnings${year}`; const previousYearData = docData?.[yearField] || {};
    let cvmDividends: DividendItem[] = [], statusDividends: DividendItem[] = [], fiisDividends: DividendItem[] = []; let priceByPaymentDate = new Map<string, string>(); const sourceErrors: string[] = [];
    try { cvmDividends = await fetchCvmDividendsForFund(docData, code, year); } catch (err: any) { sourceErrors.push(`cvm: ${err.message}`); }
    try { const html = await fetchStatusInvestHtml(code); statusDividends = parseStatusInvestDividends(html, year); } catch (err: any) { sourceErrors.push(`statusinvest: ${err.message}`); }
    try { const fiisHtml = await fetchFiisHtml(code); fiisDividends = parseFiisDividends(fiisHtml, year); priceByPaymentDate = parseFiisPriceByPaymentDate(fiisHtml); } catch (err: any) { sourceErrors.push(`fiis.com.br: ${err.message}`); }
    const dividends = mergeDividendsByMonth(cvmDividends, fiisDividends, statusDividends);
    if (!dividends.length) throw new Error(`Nenhum rendimento de ${year} encontrado para ${code}. ${sourceErrors.join(" | ")}`);
    const fetchedEarnings = toEarningsObject(dividends, priceByPaymentDate); const mergedEarnings = { ...previousYearData, ...fetchedEarnings };
    const fetchedMonths = Object.keys(fetchedEarnings).sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b)); const mergedMonths = Object.keys(mergedEarnings).sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b)); const monthKey = currentMonthKey(); const currentMonthIncluded = Boolean(mergedEarnings[monthKey]);
    await doc.ref.set({ [`${yearField}_previousBackup`]: previousYearData, [yearField]: mergedEarnings, dividendsUpdatedAt: adminFieldValue.serverTimestamp(), dividendsUpdatedBy: "user-button", dividendsSource: "cvm+statusinvest+fiis.com.br", dividendsFetchedMonths: fetchedMonths, dividendsMergedMonths: mergedMonths, dividendsSourceMonths: { cvm: cvmDividends.map((i) => i.monthName), statusinvest: statusDividends.map((i) => i.monthName), fiisComBr: fiisDividends.map((i) => i.monthName) }, dividendsSourceErrors: sourceErrors, dividendsCurrentMonthIncluded: currentMonthIncluded, modified_in: adminFieldValue.serverTimestamp() }, { merge: true });
    return { ticker: code, year, fetchedMonths, mergedMonths, sourceMonths: { cvm: cvmDividends.map((i) => i.monthName), statusinvest: statusDividends.map((i) => i.monthName), fiisComBr: fiisDividends.map((i) => i.monthName) }, sourceErrors, count: mergedMonths.length, currentMonth: monthKey, currentMonthIncluded };
}
function requestDocumentRef(anonId: string, ticker: string) { const key = `${todayKey()}_${anonId}_${ticker}`; return adminDb.collection(PARAMETERS_COLLECTION).doc(DIVIDEND_REQUESTS_DOC).collection("requests").doc(key); }
async function reserveDailyRequest(anonId: string, ticker: string) {
    const ref = requestDocumentRef(anonId, ticker);
    await adminDb.runTransaction(async (transaction) => {
        const doc = await transaction.get(ref); const data = doc.data() || {}; const status = data.status; const confirmedCurrentMonth = data?.result?.currentMonthIncluded === true;
        if (doc.exists && status === "success" && confirmedCurrentMonth) throw new Error("Você já solicitou atualização deste FII hoje.");
        if (doc.exists && status === "reserved") throw new Error("Já existe uma atualização em andamento para este FII.");
        transaction.set(ref, { anonId, ticker, requestDate: todayKey(), attempts: Number(data.attempts || 0) + 1, createdAt: data.createdAt || adminFieldValue.serverTimestamp(), updatedAt: adminFieldValue.serverTimestamp(), status: "reserved" }, { merge: true });
    });
    return ref;
}
export async function POST(req: NextRequest) {
    try {
        const { ticker } = await req.json(); const code = normalizeTicker(ticker); if (!code) return NextResponse.json({ error: "Ticker inválido." }, { status: 400 });
        const cookieStore = await cookies(); const anonId = cookieStore.get("anonId")?.value;
        if (!anonId) return NextResponse.json({ error: "Cookie não encontrado. Aceite os cookies antes de solicitar atualização." }, { status: 400 });
        const requestRef = await reserveDailyRequest(anonId, code);
        try {
            const result = await updateTickerDividends(code, currentYear()); const status = result.currentMonthIncluded ? "success" : "partial";
            await requestRef.set({ status, result, finishedAt: adminFieldValue.serverTimestamp() }, { merge: true });
            if (!result.currentMonthIncluded) return NextResponse.json({ success: false, message: `Atualizei os meses encontrados (${result.mergedMonths.join(", ")}), mas ${result.currentMonth} ainda não foi localizado nas fontes gratuitas. Você poderá tentar novamente hoje.`, result }, { status: 202 });
            return NextResponse.json({ success: true, result });
        } catch (err: any) {
            await requestRef.set({ status: "error", error: err.message, finishedAt: adminFieldValue.serverTimestamp() }, { merge: true });
            throw err;
        }
    } catch (err: any) {
        const message = err.message || "Erro ao atualizar dividendos."; const status = message.includes("já solicitou") || message.includes("em andamento") ? 429 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
