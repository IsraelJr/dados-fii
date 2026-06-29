import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

const FIIS_COLLECTION = "Fiis";
const BACKUP_COLLECTION = "Fiis_Backup";
const REQUEST_COLLECTION = "DividendUpdateRequests";
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

async function fetchText(url: string) {
    const response = await fetch(url, {
        cache: "no-store",
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; DadosFIIUpdater/1.1)",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    });

    if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
    return response.text();
}

function parseStatusInvestDividends(html: string, year = currentYear()) {
    const rows = extractRows(html);
    const dividends: Array<{
        monthName: string;
        date_with: string;
        payment_date: string;
        earnings: string;
    }> = [];

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

function parseFiisPriceByPaymentDate(html: string) {
    const blocks = [...String(html || "").matchAll(/<[^>]+class=["'][^"']*yieldChart__table__bloco[^"']*["'][^>]*>[\s\S]*?(?=<[^>]+class=["'][^"']*yieldChart__table__bloco|<\/body>|$)/gi)]
        .map((match) => match[0]);

    const map = new Map<string, string>();

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

async function fetchPriceDateWithMap(ticker: string) {
    try {
        const html = await fetchText(`https://fiis.com.br/${normalizeTicker(ticker)}/`);
        return parseFiisPriceByPaymentDate(html);
    } catch (err: any) {
        console.warn(`Não consegui buscar preço-base no fiis.com.br para ${ticker}: ${err.message}`);
        return new Map<string, string>();
    }
}

function toEarningsObject(
    dividends: Array<{ monthName: string; date_with: string; payment_date: string; earnings: string }>,
    priceByPaymentDate: Map<string, string>
) {
    const output: Record<string, any> = {};

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

    return doc;
}

async function updateTickerDividends(code: string, year = currentYear()) {
    const doc = await backupTicker(code);
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
    const monthKey = currentMonthKey();
    const currentMonthIncluded = Boolean(mergedEarnings[monthKey]);

    await doc.ref.set(
        {
            [`${yearField}_previousBackup`]: previousYearData,
            [yearField]: mergedEarnings,
            dividendsUpdatedAt: adminFieldValue.serverTimestamp(),
            dividendsUpdatedBy: "user-button",
            dividendsSource: "statusinvest+fiis.com.br",
            dividendsFetchedMonths: fetchedMonths,
            dividendsMergedMonths: mergedMonths,
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
        count: mergedMonths.length,
        currentMonth: monthKey,
        currentMonthIncluded,
    };
}

async function reserveDailyRequest(anonId: string, ticker: string) {
    const key = `${todayKey()}_${anonId}_${ticker}`;
    const ref = adminDb.collection(REQUEST_COLLECTION).doc(key);

    await adminDb.runTransaction(async (transaction) => {
        const doc = await transaction.get(ref);
        const data = doc.data() || {};
        const status = data.status;

        if (doc.exists && status === "success") {
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
                        message: `Atualizei os meses encontrados (${result.mergedMonths.join(", ")}), mas ${result.currentMonth} ainda não foi localizado na fonte automática. Você poderá tentar novamente hoje.`,
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
