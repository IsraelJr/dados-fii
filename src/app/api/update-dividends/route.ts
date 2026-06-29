import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

const FIIS_COLLECTION = "Fiis";
const BACKUP_COLLECTION = "Fiis_Backup";
const PARAMETERS_COLLECTION = "Parameters";
const DIVIDEND_REQUESTS_DOC = "DividendUpdateRequests";
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

type DividendItem = {
    monthName: string;
    date_with: string;
    payment_date: string;
    earnings: string;
    price_date_with?: string;
    source: string;
};

function saoPauloDateParts() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());

    return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function todayKey() {
    const parts = saoPauloDateParts();
    return `${parts.year}-${parts.month}-${parts.day}`;
}

function currentYear() {
    return Number(saoPauloDateParts().year);
}

function currentMonthKey() {
    return MONTHS[Number(saoPauloDateParts().month) - 1];
}

function normalizeTicker(value: string) {
    return String(value || "").trim().toUpperCase();
}

function decodeHtml(value: string) {
    return String(value || "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}

function stripTags(value: string) {
    return decodeHtml(String(value || "").replace(/<[^>]+>/g, " "));
}

function normalizeDate(value: string) {
    return String(value || "").replace(/\./g, "/").trim();
}

function normalizeCurrency(value: string) {
    const text = stripTags(value).replace(/\s+/g, " ").trim();
    if (!text) return "R$ 0,0";
    return text.startsWith("R$") ? text : `R$ ${text.replace("R$", "").trim()}`;
}

function formatCurrency(value: number | string) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "R$ 0,0";
    return `R$ ${number.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 8,
    })}`;
}

function toDateOnly(value: string) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function monthNameFromDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return MONTHS[date.getUTCMonth()];
}

function extractRows(html: string) {
    return [...String(html || "").matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
}

function extractCells(rowHtml: string) {
    return [...String(rowHtml || "").matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)].map((match) => ({
        attrs: match[1] || "",
        html: match[2] || "",
        text: stripTags(match[2] || ""),
    }));
}

function getTitle(attrs: string) {
    const match = String(attrs || "").match(/title=["']([^"']+)["']/i);
    return decodeHtml(match?.[1] || "");
}

function getBrapiToken() {
    return process.env.BRAPI_API_TOKEN || process.env.BRAPI_TOKEN || "";
}

async function fetchJson(url: string, headers: Record<string, string> = {}) {
    const response = await fetch(url, {
        cache: "no-store",
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

async function fetchText(url: string) {
    const response = await fetch(url, {
        cache: "no-store",
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; DadosFIIUpdater/1.3)",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    });

    if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
    return response.text();
}

async function updateBackupParameter(payload: Record<string, any>) {
    await adminDb.collection(PARAMETERS_COLLECTION).doc("backup").set(
        {
            lastFiisBackupAt: adminFieldValue.serverTimestamp(),
            ...payload,
        },
        { merge: true }
    );
}

async function fetchBrapiDividends(ticker: string, year = currentYear()): Promise<DividendItem[]> {
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
        .filter((item: any) => normalizeTicker(item.symbol) === code)
        .filter((item: any) => String(item.label || "").toUpperCase().includes("RENDIMENTO"))
        .map((item: any) => {
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
        .filter(Boolean) as DividendItem[];
}

function parseStatusInvestDividends(html: string, year = currentYear()): DividendItem[] {
    const rows = extractRows(html);
    const dividends: DividendItem[] = [];

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

async function fetchStatusInvestHtml(ticker: string) {
    const code = normalizeTicker(ticker);
    const paths = [
        `fundos-imobiliarios/${code}`,
        `fiagros/${code}`,
        `fiinfras/${code}`,
    ];

    const errors: string[] = [];

    for (const path of paths) {
        const url = `https://statusinvest.com.br/${path}`;
        try {
            const html = await fetchText(url);
            if (extractRows(html).length > 0) return html;
            errors.push(`${url}: sem linhas úteis`);
        } catch (err: any) {
            errors.push(err.message);
        }
    }

    throw new Error(`Não consegui ler StatusInvest para ${code}. ${errors.join(" | ")}`);
}

function extractFiisDividendBlocks(html: string) {
    return [...String(html || "").matchAll(/<[^>]+class=["'][^"']*yieldChart__table__bloco[^"']*["'][^>]*>[\s\S]*?(?=<[^>]+class=["'][^"']*yieldChart__table__bloco|<\/body>|$)/gi)]
        .map((match) => match[0]);
}

function parseFiisDividends(html: string, year = currentYear()): DividendItem[] {
    const dividends: DividendItem[] = [];

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

function parseFiisPriceByPaymentDate(html: string) {
    const map = new Map<string, string>();

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

async function fetchFiisHtml(ticker: string) {
    return fetchText(`https://fiis.com.br/${normalizeTicker(ticker)}/`);
}

function toEarningsObject(dividends: DividendItem[], priceByPaymentDate: Map<string, string>) {
    const output: Record<string, any> = {};

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

function mergeDividendsByMonth(brapiDividends: DividendItem[], fiisDividends: DividendItem[], statusDividends: DividendItem[]) {
    const byMonth = new Map<string, DividendItem>();

    statusDividends.forEach((item) => byMonth.set(item.monthName, item));
    fiisDividends.forEach((item) => byMonth.set(item.monthName, { ...byMonth.get(item.monthName), ...item }));
    brapiDividends.forEach((item) => byMonth.set(item.monthName, { ...byMonth.get(item.monthName), ...item }));

    return [...byMonth.values()].sort((a, b) => MONTHS.indexOf(a.monthName) - MONTHS.indexOf(b.monthName));
}

async function backupTicker(code: string) {
    const docRef = adminDb.collection(FIIS_COLLECTION).doc(code);
    const doc = await docRef.get();

    if (!doc.exists) throw new Error(`Ticker ${code} não encontrado em /${FIIS_COLLECTION}.`);

    await adminDb.collection(BACKUP_COLLECTION).doc(code).set(
        {
            ...doc.data(),
            backup_source_collection: FIIS_COLLECTION,
            backup_date: adminFieldValue.serverTimestamp(),
            backup_reason: "before-user-dividend-update",
        },
        { merge: false }
    );

    await updateBackupParameter({
        lastFiisBackupType: "single-document",
        lastFiisBackupSource: `${FIIS_COLLECTION}/${code}`,
        lastFiisBackupTarget: `${BACKUP_COLLECTION}/${code}`,
        lastFiisBackupTicker: code,
    });

    return doc;
}

async function updateTickerDividends(code: string, year = currentYear()) {
    const doc = await backupTicker(code);
    const yearField = `earnings${year}`;
    const previousYearData = doc.data()?.[yearField] || {};

    let brapiDividends: DividendItem[] = [];
    let statusDividends: DividendItem[] = [];
    let fiisDividends: DividendItem[] = [];
    let priceByPaymentDate = new Map<string, string>();
    const sourceErrors: string[] = [];

    try {
        brapiDividends = await fetchBrapiDividends(code, year);
    } catch (err: any) {
        sourceErrors.push(`brapi: ${err.message}`);
    }

    try {
        const html = await fetchStatusInvestHtml(code);
        statusDividends = parseStatusInvestDividends(html, year);
    } catch (err: any) {
        sourceErrors.push(`statusinvest: ${err.message}`);
    }

    try {
        const fiisHtml = await fetchFiisHtml(code);
        fiisDividends = parseFiisDividends(fiisHtml, year);
        priceByPaymentDate = parseFiisPriceByPaymentDate(fiisHtml);
    } catch (err: any) {
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
    const monthKey = currentMonthKey();
    const currentMonthIncluded = Boolean(mergedEarnings[monthKey]);

    await doc.ref.set(
        {
            [`${yearField}_previousBackup`]: previousYearData,
            [yearField]: mergedEarnings,
            dividendsUpdatedAt: adminFieldValue.serverTimestamp(),
            dividendsUpdatedBy: "user-button",
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
            modified_in: adminFieldValue.serverTimestamp(),
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
        currentMonth: monthKey,
        currentMonthIncluded,
    };
}

function requestDocumentRef(anonId: string, ticker: string) {
    const key = `${todayKey()}_${anonId}_${ticker}`;
    return adminDb
        .collection(PARAMETERS_COLLECTION)
        .doc(DIVIDEND_REQUESTS_DOC)
        .collection("requests")
        .doc(key);
}

async function reserveDailyRequest(anonId: string, ticker: string) {
    const ref = requestDocumentRef(anonId, ticker);

    await adminDb.runTransaction(async (transaction) => {
        const doc = await transaction.get(ref);
        const data = doc.data() || {};
        const status = data.status;
        const confirmedCurrentMonth = data?.result?.currentMonthIncluded === true;

        if (doc.exists && status === "success" && confirmedCurrentMonth) {
            throw new Error("Você já solicitou atualização deste FII hoje.");
        }

        if (doc.exists && status === "reserved") {
            throw new Error("Já existe uma atualização em andamento para este FII.");
        }

        transaction.set(
            ref,
            {
                anonId,
                ticker,
                requestDate: todayKey(),
                attempts: Number(data.attempts || 0) + 1,
                createdAt: data.createdAt || adminFieldValue.serverTimestamp(),
                updatedAt: adminFieldValue.serverTimestamp(),
                status: "reserved",
            },
            { merge: true }
        );
    });

    return ref;
}

export async function POST(req: NextRequest) {
    try {
        const { ticker } = await req.json();
        const code = normalizeTicker(ticker);

        if (!code) return NextResponse.json({ error: "Ticker inválido." }, { status: 400 });

        const cookieStore = await cookies();
        const anonId = cookieStore.get("anonId")?.value;

        if (!anonId) {
            return NextResponse.json(
                { error: "Cookie não encontrado. Aceite os cookies antes de solicitar atualização." },
                { status: 400 }
            );
        }

        const requestRef = await reserveDailyRequest(anonId, code);

        try {
            const result = await updateTickerDividends(code, currentYear());
            const status = result.currentMonthIncluded ? "success" : "partial";

            await requestRef.set(
                {
                    status,
                    result,
                    finishedAt: adminFieldValue.serverTimestamp(),
                },
                { merge: true }
            );

            if (!result.currentMonthIncluded) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `Atualizei os meses encontrados (${result.mergedMonths.join(", ")}), mas ${result.currentMonth} ainda não foi localizado nas fontes automáticas. Você poderá tentar novamente hoje.`,
                        result,
                    },
                    { status: 202 }
                );
            }

            return NextResponse.json({ success: true, result });
        } catch (err: any) {
            await requestRef.set(
                {
                    status: "error",
                    error: err.message,
                    finishedAt: adminFieldValue.serverTimestamp(),
                },
                { merge: true }
            );
            throw err;
        }
    } catch (err: any) {
        const message = err.message || "Erro ao atualizar dividendos.";
        const status = message.includes("já solicitou") || message.includes("em andamento") ? 429 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
