import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BRAPI_BASE_URL = "https://brapi.dev/api/v2";

type IfixQuote = {
    points: number;
    source: string;
    lastDate?: string | null;
    open?: number | null;
    previousClose?: number | null;
    change?: number | null;
    changePercent?: number | null;
};

const formatPoints = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);

const formatPercent = (value?: number | null) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return null;
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2).replace(".", ",")}%`;
};

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 7000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...options,
            cache: "no-store",
            signal: controller.signal,
            headers: {
                Accept: "application/json",
                "User-Agent": "dados-fii/1.0",
                ...(options.headers || {}),
            },
        });
    } finally {
        clearTimeout(timeout);
    }
}

function parseDate(value: unknown) {
    if (typeof value === "number") return new Date(value * 1000).toISOString().slice(0, 10);
    const text = String(value || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function numberOf(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function round(value: number, decimals = 2) {
    return Number(value.toFixed(decimals));
}

function buildChange(points: number, open?: number | null, previousClose?: number | null) {
    const base = previousClose && previousClose > 0 ? previousClose : open && open > 0 ? open : null;
    if (!base || !points || points <= 0) return { change: null, changePercent: null };

    const change = points - base;
    return {
        change: round(change, 2),
        changePercent: round((change / base) * 100, 2),
    };
}

async function getFromYahoo(): Promise<IfixQuote> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/IFIX.SA?interval=1d&range=5d&ts=${Date.now()}`;
    const res = await fetchWithTimeout(url);

    if (!res.ok) throw new Error(`Yahoo IFIX.SA HTTP ${res.status}`);

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const timestamps: number[] = result?.timestamp || [];
    const quote = result?.indicators?.quote?.[0] || {};
    const opens: Array<number | null> = quote?.open || [];
    const closes: Array<number | null> = quote?.close || [];
    const values = timestamps
        .map((timestamp, index) => ({
            timestamp,
            open: numberOf(opens[index]),
            close: numberOf(closes[index]),
        }))
        .filter((item) => item.close > 0);
    const last = values.at(-1);
    const previous = values.length > 1 ? values.at(-2) : null;
    const metaPrice = numberOf(result?.meta?.regularMarketPrice);
    const previousClose = numberOf(result?.meta?.chartPreviousClose) || previous?.close || null;
    const points = last?.close || metaPrice;
    const open = last?.open || numberOf(result?.meta?.regularMarketOpen) || null;

    if (!points) throw new Error("Yahoo IFIX.SA sem fechamento válido");

    const calculatedChange = buildChange(points, open, previousClose);

    return {
        points,
        source: "Yahoo Finance",
        lastDate: last ? new Date(last.timestamp * 1000).toISOString().slice(0, 10) : null,
        open,
        previousClose,
        change: calculatedChange.change,
        changePercent: calculatedChange.changePercent,
    };
}

async function getFromBrapi(): Promise<IfixQuote> {
    const apiKey = process.env.BRAPI_API_TOKEN || process.env.BRAPI_TOKEN || "";
    if (!apiKey) throw new Error("BRAPI_API_TOKEN ausente");

    const symbols = ["IFIX.SA", "IFIX"];
    const errors: string[] = [];

    for (const symbol of symbols) {
        const url = `${BRAPI_BASE_URL}/stocks/historical?symbols=${encodeURIComponent(symbol)}&range=5d&interval=1d&sortOrder=asc`;

        try {
            const res = await fetchWithTimeout(url, {
                headers: { Authorization: ["Bearer", apiKey].join(" ") },
            });

            if (!res.ok) throw new Error(`brapi ${symbol} HTTP ${res.status}`);

            const data = await res.json();
            const result = Array.isArray(data?.results) ? data.results[0] : null;
            const prices = Array.isArray(result?.data?.historicalDataPrice) ? result.data.historicalDataPrice : [];
            const valid = prices
                .map((item: any) => ({
                    date: item?.date,
                    open: numberOf(item?.open),
                    close: numberOf(item?.adjustedClose ?? item?.close),
                }))
                .filter((item: any) => item.close > 0);
            const last = valid.at(-1);
            const previous = valid.length > 1 ? valid.at(-2) : null;
            const points = numberOf(last?.close);

            if (points <= 0) throw new Error(`brapi ${symbol} sem fechamento válido`);

            const open = numberOf(last?.open) || null;
            const previousClose = numberOf(previous?.close) || null;
            const calculatedChange = buildChange(points, open, previousClose);

            return {
                points,
                source: "brapi.dev",
                lastDate: parseDate(last?.date),
                open,
                previousClose,
                change: calculatedChange.change,
                changePercent: calculatedChange.changePercent,
            };
        } catch (err: any) {
            errors.push(err?.message || `Erro ao consultar ${symbol}`);
        }
    }

    throw new Error(errors.join("; ") || "brapi sem IFIX disponível");
}

export async function GET() {
    const providers = [getFromYahoo, getFromBrapi];
    const errors: string[] = [];

    for (const provider of providers) {
        try {
            const quote = await provider();
            const changePercentFormatted = formatPercent(quote.changePercent);

            return NextResponse.json(
                {
                    index: "IFIX",
                    points: quote.points,
                    formatted: `${formatPoints(quote.points)} pts`,
                    open: quote.open ?? null,
                    openFormatted: quote.open ? `${formatPoints(quote.open)} pts` : null,
                    previousClose: quote.previousClose ?? null,
                    previousCloseFormatted: quote.previousClose ? `${formatPoints(quote.previousClose)} pts` : null,
                    change: quote.change ?? null,
                    changeFormatted: quote.change !== null && quote.change !== undefined ? `${quote.change > 0 ? "+" : ""}${formatPoints(quote.change)} pts` : null,
                    changePercent: quote.changePercent ?? null,
                    changePercentFormatted,
                    trend: quote.changePercent && quote.changePercent > 0 ? "up" : quote.changePercent && quote.changePercent < 0 ? "down" : "flat",
                    source: quote.source,
                    lastDate: quote.lastDate || null,
                    updatedAt: new Date().toISOString(),
                    ok: true,
                },
                {
                    status: 200,
                    headers: {
                        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
                        Pragma: "no-cache",
                        Expires: "0",
                    },
                }
            );
        } catch (err: any) {
            errors.push(err?.message || "Erro desconhecido");
        }
    }

    return NextResponse.json(
        {
            index: "IFIX",
            points: null,
            formatted: "Indisponível",
            open: null,
            openFormatted: null,
            previousClose: null,
            previousCloseFormatted: null,
            change: null,
            changeFormatted: null,
            changePercent: null,
            changePercentFormatted: null,
            trend: "flat",
            source: null,
            lastDate: null,
            updatedAt: new Date().toISOString(),
            ok: false,
            error: "Não foi possível consultar o IFIX.",
            details: errors,
        },
        {
            status: 200,
            headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
                Pragma: "no-cache",
                Expires: "0",
            },
        }
    );
}
