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
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
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
    const res = await fetchWithTimeout("https://economia.awesomeapi.com.br/json/last/USD-BRL");

    if (!res.ok) {
        throw new Error(`AwesomeAPI HTTP ${res.status}`);
    }

    const data = await res.json();
    const value = Number(data?.USDBRL?.bid);

    if (!Number.isFinite(value) || value <= 0) {
        throw new Error("AwesomeAPI retornou cotação inválida");
    }

    return {
        brl: value,
        source: "AwesomeAPI",
    };
}

async function getFromOpenExchangeRateApi(): Promise<DollarQuote> {
    const res = await fetchWithTimeout("https://open.er-api.com/v6/latest/USD");

    if (!res.ok) {
        throw new Error(`open.er-api.com HTTP ${res.status}`);
    }

    const data = await res.json();
    const value = Number(data?.rates?.BRL);

    if (!Number.isFinite(value) || value <= 0) {
        throw new Error("open.er-api.com retornou cotação inválida");
    }

    return {
        brl: value,
        source: "open.er-api.com",
    };
}

async function getFromFrankfurter(): Promise<DollarQuote> {
    const res = await fetchWithTimeout("https://api.frankfurter.app/latest?from=USD&to=BRL");

    if (!res.ok) {
        throw new Error(`Frankfurter HTTP ${res.status}`);
    }

    const data = await res.json();
    const value = Number(data?.rates?.BRL);

    if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Frankfurter retornou cotação inválida");
    }

    return {
        brl: value,
        source: "Frankfurter",
    };
}

export async function GET() {
    const providers = [
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
                },
                {
                    status: 200,
                    headers: {
                        "Cache-Control": "no-store, no-cache, must-revalidate",
                    },
                }
            );
        } catch (err: any) {
            errors.push(err?.message || "Erro desconhecido");
        }
    }

    return NextResponse.json(
        {
            error: "Não foi possível consultar a cotação do dólar.",
            details: errors,
        },
        { status: 503 }
    );
}
