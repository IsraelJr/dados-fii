import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BRAPI_BASE_URL = "https://brapi.dev/api/v2";

type IfixQuote = {
    points: number;
    source: string;
    lastDate?: string | null;
};

const formatPoints = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);

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

async function getFromBrapi(): Promise<IfixQuote> {
    const apiKey = process.env.BRAPI_API_TOKEN || process.env.BRAPI_TOKEN || "";
    if (!apiKey) throw new Error("BRAPI_API_TOKEN ausente");

    const symbols = ["IFIX.SA", "IFIX"];
    const errors: string[] = [];

    for (const symbol of symbols) {
        const url = `${BRAPI_BASE_URL}/stocks/historical?symbols=${encodeURIComponent(symbol)}&range=3mo&interval=1d&sortOrder=asc`;

        try {
            const res = await fetchWithTimeout(url, {
                headers: { Authorization: ["Bearer", apiKey].join(" ") },
            });

            if (!res.ok) throw new Error(`brapi ${symbol} HTTP ${res.status}`);

            const data = await res.json();
            const result = Array.isArray(data?.results) ? data.results[0] : null;
            const prices = Array.isArray(result?.data?.historicalDataPrice) ? result.data.historicalDataPrice : [];
            const last = [...prices].reverse().find((item: any) => numberOf(item?.adjustedClose ?? item?.close) > 0);
            const points = numberOf(last?.adjustedClose ?? last?.close);

            if (points <= 0) throw new Error(`brapi ${symbol} sem fechamento válido`);

            return {
                points,
                source: "brapi.dev",
                lastDate: parseDate(last?.date),
            };
        } catch (err: any) {
            errors.push(err?.message || `Erro ao consultar ${symbol}`);
        }
    }

    throw new Error(errors.join("; ") || "brapi sem IFIX disponível");
}

async function getFromYahoo(): Promise<IfixQuote> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/IFIX.SA?interval=1d&range=5d&ts=${Date.now()}`;
    const res = await fetchWithTimeout(url);

    if (!res.ok) throw new Error(`Yahoo IFIX.SA HTTP ${res.status}`);

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const timestamps: number[] = result?.timestamp || [];
    const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close || [];
    const values = timestamps
        .map((timestamp, index) => ({ timestamp, close: numberOf(closes[index]) }))
        .filter((item) => item.close > 0);
    const last = values.at(-1);

    if (!last) throw new Error("Yahoo IFIX.SA sem fechamento válido");

    return {
        points: last.close,
        source: "Yahoo Finance",
        lastDate: new Date(last.timestamp * 1000).toISOString().slice(0, 10),
    };
}

export async function GET() {
    const providers = [getFromBrapi, getFromYahoo];
    const errors: string[] = [];

    for (const provider of providers) {
        try {
            const quote = await provider();

            return NextResponse.json(
                {
                    index: "IFIX",
                    points: quote.points,
                    formatted: `${formatPoints(quote.points)} pts`,
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
