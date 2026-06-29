import { NextRequest, NextResponse } from "next/server";
import admin, { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIIS_COLLECTION = "Fiis";
const BACKUP_COLLECTION = "Fiis_Backup";
const PARAMETERS_COLLECTION = "Parameters";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Action = "cnpj" | "dividends" | "both";

type DividendItem = {
    monthName: string;
    date_with: string;
    payment_date: string;
    earnings: string;
    source: string;
};

function normalizeTicker(value: unknown) {
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

function stripHtml(value: string) {
    return decodeHtml(
        String(value || "")
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " ")
    );
}

function normalizeCurrency(value: string) {
    const text = String(value || "").trim();
    if (!text) return "R$ 0,0";
    return text.startsWith("R$") ? text : `R$ ${text}`;
}

async function fetchText(url: string) {
    const response = await fetch(url, {
        cache: "no-store",
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; DadosFIIMaintenance/1.0)",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    });

    if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
    return response.text();
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
            if (html.includes("Tipo") || html.includes("Rendimento") || html.includes("CNPJ")) {
                return { html, url };
            }
            errors.push(`${url}: HTML sem dados úteis`);
        } catch (err: any) {
            errors.push(err.message);
        }
    }

    throw new Error(errors.join(" | "));
}

function extractCnpj(html: string) {
    const text = stripHtml(html);
    const cnpjSection = text.match(/CNPJ\s+(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i);
    if (cnpjSection?.[1]) return cnpjSection[1];
    const firstCnpj = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    return firstCnpj?.[0] || "";
}

function parseStatusInvestTextDividends(html: string, year: number): DividendItem[] {
    const text = stripHtml(html);
    const pattern = /Rendimento\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([0-9]+,[0-9]+)/gi;
    const byMonth = new Map<string, DividendItem>();

    for (const match of text.matchAll(pattern)) {
        const dateWith = match[1];
        const paymentDate = match[2];
        const value = match[3];
        const [, month, rowYear] = paymentDate.match(/(\d{2})\/(\d{2})\/(\d{4})/) || [];

        if (!month || Number(rowYear) !== year) continue;

        const monthName = MONTHS[Number(month) - 1];
        if (!monthName) continue;

        byMonth.set(monthName, {
            monthName,
            date_with: dateWith,
            payment_date: paymentDate,
            earnings: normalizeCurrency(value),
            source: "statusinvest-text",
        });
    }

    return [...byMonth.values()].sort((a, b) => MONTHS.indexOf(a.monthName) - MONTHS.indexOf(b.monthName));
}

function isAuthorized(req: NextRequest, body: any) {
    const expected = process.env.ADMIN_UPDATE_SECRET;
    if (!expected) return false;

    const headerSecret = req.headers.get("x-admin-secret");
    const querySecret = new URL(req.url).searchParams.get("secret");
    const bodySecret = body?.secret;

    return [headerSecret, querySecret, bodySecret].some((secret) => secret === expected);
}

async function backupTicker(ticker: string, data: FirebaseFirestore.DocumentData) {
    await adminDb.collection(BACKUP_COLLECTION).doc(ticker).set(
        {
            ...data,
            backup_source_collection: FIIS_COLLECTION,
            backup_date: adminFieldValue.serverTimestamp(),
            backup_reason: "temporary-admin-maintenance",
        },
        { merge: false }
    );

    await adminDb.collection(PARAMETERS_COLLECTION).doc("backup").set(
        {
            lastFiisBackupAt: adminFieldValue.serverTimestamp(),
            lastFiisBackupType: "temporary-admin-single-document",
            lastFiisBackupTicker: ticker,
            lastFiisBackupSource: `${FIIS_COLLECTION}/${ticker}`,
            lastFiisBackupTarget: `${BACKUP_COLLECTION}/${ticker}`,
        },
        { merge: true }
    );
}

async function getBatch(limit: number, cursor?: string) {
    let query = adminDb
        .collection(FIIS_COLLECTION)
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(limit);

    if (cursor) query = query.startAfter(cursor);

    const snapshot = await query.get();
    return snapshot.docs;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));

        if (!isAuthorized(req, body)) {
            return NextResponse.json(
                { error: "Não autorizado. Configure ADMIN_UPDATE_SECRET e envie a senha." },
                { status: 401 }
            );
        }

        const action: Action = ["cnpj", "dividends", "both"].includes(body.action) ? body.action : "both";
        const year = Number(body.year || new Date().getFullYear());
        const limit = Math.min(Math.max(Number(body.limit || 5), 1), 20);
        const cursor = body.cursor ? String(body.cursor) : undefined;
        const docs = await getBatch(limit, cursor);
        const results: any[] = [];

        for (const doc of docs) {
            const ticker = normalizeTicker(doc.id);
            const previous = doc.data() || {};
            const update: Record<string, any> = {};

            try {
                const { html, url } = await fetchStatusInvestHtml(ticker);

                if (action === "cnpj" || action === "both") {
                    const cnpj = extractCnpj(html);
                    if (cnpj) {
                        update.cnpj = cnpj;
                        update.cnpjUpdatedAt = adminFieldValue.serverTimestamp();
                        update.cnpjSource = url;
                    }
                }

                if (action === "dividends" || action === "both") {
                    const dividends = parseStatusInvestTextDividends(html, year);
                    const yearField = `earnings${year}`;
                    const previousYearData = previous?.[yearField] || {};
                    const fetchedEarnings = Object.fromEntries(
                        dividends.map((item) => [
                            item.monthName,
                            {
                                payment_date: item.payment_date,
                                date_with: item.date_with,
                                earnings: item.earnings,
                                price_date_with: previousYearData?.[item.monthName]?.price_date_with || "R$ 0,0",
                            },
                        ])
                    );
                    const mergedEarnings = { ...previousYearData, ...fetchedEarnings };
                    const mergedMonths = Object.keys(mergedEarnings).sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));

                    update[`${yearField}_previousBackup`] = previousYearData;
                    update[yearField] = mergedEarnings;
                    update.dividendsUpdatedAt = adminFieldValue.serverTimestamp();
                    update.dividendsUpdatedBy = "temporary-admin-maintenance";
                    update.dividendsSource = "statusinvest-text";
                    update.dividendsFetchedMonths = Object.keys(fetchedEarnings).sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));
                    update.dividendsMergedMonths = mergedMonths;
                    update.dividendsCurrentMonthIncluded = Boolean(mergedEarnings[MONTHS[new Date().getMonth()]]);
                }

                if (Object.keys(update).length === 0) {
                    throw new Error("Nenhum dado novo encontrado no StatusInvest.");
                }

                await backupTicker(ticker, previous);
                await doc.ref.set({ ...update, modified_in: adminFieldValue.serverTimestamp() }, { merge: true });

                results.push({ ticker, ok: true, updatedFields: Object.keys(update) });
            } catch (err: any) {
                results.push({ ticker, ok: false, error: err.message });
            }
        }

        const nextCursor = docs.length ? docs[docs.length - 1].id : null;
        const hasMore = docs.length === limit;

        await adminDb.collection(PARAMETERS_COLLECTION).doc("temporaryMaintenance").set(
            {
                action,
                year,
                lastCursor: nextCursor,
                lastBatchAt: adminFieldValue.serverTimestamp(),
                lastResults: results,
            },
            { merge: true }
        );

        return NextResponse.json({
            action,
            year,
            limit,
            cursor,
            nextCursor,
            hasMore,
            processed: results.length,
            updated: results.filter((item) => item.ok).length,
            failed: results.filter((item) => !item.ok).length,
            results,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Erro na manutenção temporária." }, { status: 500 });
    }
}
