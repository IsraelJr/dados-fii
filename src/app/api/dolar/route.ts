import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DollarQuote = {
    brl: number;
    source: string;
};

const formatBRL = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
    }).format(value);

async function fetchWithTimeout(url: string, timeoutMs = 7000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            cache: "no-store",
            signal: controller.signal,
            headers: {
                Accept: "application/json",
                "User-Agent": "dados-fii/1.0",
            },
        });
    } finally {
        clearTimeout(timeout);
    }
}

async function getFromAwesomeApi(): Promise<DollarQuote> {
    const res = await fetchWithTimeout(`https://economia.awesomeapi.com.br/json/last/USD-BRL?ts=${Date.now()}`);

    if (!res.ok) throw new Error(`AwesomeAPI HTTP ${res.status}`);

    const data = await res.json();
    const value = Number(data?.USDBRL?.bid);

    if (!Number.isFinite(value) || value <= 0) {
        throw new Error("AwesomeAPI retornou cotação inválida");
    }

    return { brl: value, source: "AwesomeAPI" };
}

async function getFromYahoo(): Promise<DollarQuote> {
    const res = await fetchWithTimeout(`https://query1.finance.yahoo.com/v8/finance/chart/USDBRL=X?interval=1m&range=1d&ts=${Date.now()}`);

    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const metaPrice = Number(result?.meta?.regularMarketPrice);
    const closePrices = Array.isArray(result?.indicators?.quote?.[0]?.close)
        ? result.indicators.quote[0].close.filter((value: unknown) => Number.isFinite(Number(value)))
        : [];
    const lastClose = Number(closePrices[closePrices.length - 1]);
    const value = Number.isFinite(lastClose) && lastClose > 0 ? lastClose : metaPrice;

    if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Yahoo retornou cotação inválida");
    }

    return { brl: value, source: "Yahoo Finance" };
}

async function getFromOpenExchangeRateApi(): Promise<DollarQuote> {
    const res = await fetchWithTimeout(`https://open.er-api.com/v6/latest/USD?ts=${Date.now()}`);

    if (!res.ok) throw new Error(`open.er-api.com HTTP ${res.status}`);

    const data = await res.json();
    const value = Number(data?.rates?.BRL);

    if (!Number.isFinite(value) || value <= 0) {
        throw new Error("open.er-api.com retornou cotação inválida");
    }

    return { brl: value, source: "ExchangeRate-API" };
}

async function getFromFrankfurter(): Promise<DollarQuote> {
    const res = await fetchWithTimeout(`https://api.frankfurter.app/latest?from=USD&to=BRL&ts=${Date.now()}`);

    if (!res.ok) throw new Error(`Frankfurter HTTP ${res.status}`);

    const data = await res.json();
    const value = Number(data?.rates?.BRL);

    if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Frankfurter retornou cotação inválida");
    }

    return { brl: value, source: "Frankfurter" };
}

export async function GET() {
    const providers = [
        getFromYahoo,
        getFromAwesomeApi,
        getFromOpenExchangeRateApi,
        getFromFrankfurter,
    ];

    const errors: string[] = [];

    for (const provider of providers) {
        try {
            const quote = await provider();

            return NextResponse.json(
                {
                    currency: "USD",
                    brl: quote.brl,
                    formatted: formatBRL(quote.brl),
                    source: quote.source,
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
            currency: "USD",
            brl: null,
            formatted: "Indisponível",
            source: null,
            updatedAt: new Date().toISOString(),
            ok: false,
            error: "Não foi possível consultar a cotação do dólar.",
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
