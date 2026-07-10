import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DollarQuote = {
    brl: number;
    source: string;
    open?: number | null;
    previousClose?: number | null;
    change?: number | null;
    changePercent?: number | null;
};

const formatBRL = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
    }).format(value);

const formatPercent = (value?: number | null) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return null;
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2).replace(".", ",")}%`;
};

function numberOf(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function signedNumberOf(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, decimals = 4) {
    return Number(value.toFixed(decimals));
}

function buildChange(current: number, open?: number | null, previousClose?: number | null) {
    const base = previousClose && previousClose > 0 ? previousClose : open && open > 0 ? open : null;
    if (!base || !current || current <= 0) return { change: null, changePercent: null };

    const change = current - base;
    return {
        change: round(change, 4),
        changePercent: round((change / base) * 100, 2),
    };
}

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

async function getFromYahoo(): Promise<DollarQuote> {
    const res = await fetchWithTimeout(`https://query1.finance.yahoo.com/v8/finance/chart/USDBRL=X?interval=1m&range=1d&ts=${Date.now()}`);

    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0] || {};
    const openPrices = Array.isArray(quote?.open)
        ? quote.open.filter((value: unknown) => Number.isFinite(Number(value)) && Number(value) > 0)
        : [];
    const closePrices = Array.isArray(quote?.close)
        ? quote.close.filter((value: unknown) => Number.isFinite(Number(value)) && Number(value) > 0)
        : [];
    const lastClose = Number(closePrices[closePrices.length - 1]);
    const metaPrice = Number(result?.meta?.regularMarketPrice);
    const value = Number.isFinite(lastClose) && lastClose > 0 ? lastClose : metaPrice;
    const open = numberOf(openPrices[0]) || numberOf(result?.meta?.regularMarketOpen) || null;
    const previousClose = numberOf(result?.meta?.chartPreviousClose) || null;

    if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Yahoo retornou cotação inválida");
    }

    const calculatedChange = buildChange(value, open, previousClose);

    return {
        brl: value,
        source: "Yahoo Finance",
        open,
        previousClose,
        change: calculatedChange.change,
        changePercent: calculatedChange.changePercent,
    };
}

async function getFromAwesomeApi(): Promise<DollarQuote> {
    const res = await fetchWithTimeout(`https://economia.awesomeapi.com.br/json/last/USD-BRL?ts=${Date.now()}`);

    if (!res.ok) throw new Error(`AwesomeAPI HTTP ${res.status}`);

    const data = await res.json();
    const item = data?.USDBRL || {};
    const value = Number(item?.bid);
    const change = signedNumberOf(item?.varBid);
    const changePercent = signedNumberOf(item?.pctChange);
    const previousClose = change !== null && Number.isFinite(value) ? value - change : null;

    if (!Number.isFinite(value) || value <= 0) {
        throw new Error("AwesomeAPI retornou cotação inválida");
    }

    return {
        brl: value,
        source: "AwesomeAPI",
        previousClose,
        change: change !== null ? round(change, 4) : null,
        changePercent: changePercent !== null ? round(changePercent, 2) : null,
    };
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
            const changePercentFormatted = formatPercent(quote.changePercent);

            return NextResponse.json(
                {
                    currency: "USD",
                    brl: quote.brl,
                    formatted: formatBRL(quote.brl),
                    open: quote.open ?? null,
                    openFormatted: quote.open ? formatBRL(quote.open) : null,
                    previousClose: quote.previousClose ?? null,
                    previousCloseFormatted: quote.previousClose ? formatBRL(quote.previousClose) : null,
                    change: quote.change ?? null,
                    changeFormatted: quote.change !== null && quote.change !== undefined ? `${quote.change > 0 ? "+" : ""}${formatBRL(quote.change)}` : null,
                    changePercent: quote.changePercent ?? null,
                    changePercentFormatted,
                    trend: quote.changePercent && quote.changePercent > 0 ? "up" : quote.changePercent && quote.changePercent < 0 ? "down" : "flat",
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