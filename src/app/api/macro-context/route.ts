import { NextResponse } from "next/server";
import { getMarketBenchmarks } from "@/lib/marketBenchmarks";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function numberOf(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function formatPercent(value: unknown, suffix = "%") {
    const parsed = numberOf(value);
    if (parsed === null) return null;
    return `${parsed.toFixed(2).replace(".", ",")}${suffix}`;
}

export async function GET() {
    try {
        const benchmarks: any = await getMarketBenchmarks();
        const selicRate = numberOf(benchmarks?.selic?.rate);
        const cdi12m = numberOf(benchmarks?.cdi?.twelveMonthsReturn);
        const ipca12m = numberOf(benchmarks?.ipca?.twelveMonthsReturn);
        const ipcaYear = numberOf(benchmarks?.ipca?.yearReturn);
        const lastDate = benchmarks?.date || null;

        return NextResponse.json(
            {
                ok: true,
                title: "Contexto macro para FIIs",
                items: [
                    {
                        label: "Selic",
                        value: selicRate,
                        formatted: selicRate !== null ? formatPercent(selicRate, "% a.a.") : "Indisponível",
                        source: benchmarks?.selic?.source || "Banco Central do Brasil - SGS 432",
                        date: benchmarks?.selic?.date || null,
                    },
                    {
                        label: "CDI 12m",
                        value: cdi12m,
                        formatted: cdi12m !== null ? formatPercent(cdi12m) : "Indisponível",
                        source: benchmarks?.cdi?.source || "Banco Central do Brasil - SGS 12",
                        date: benchmarks?.cdi?.lastDate || null,
                    },
                    {
                        label: "IPCA 12m",
                        value: ipca12m,
                        formatted: ipca12m !== null ? formatPercent(ipca12m) : "Indisponível",
                        source: benchmarks?.ipca?.source || "Banco Central do Brasil - SGS 433",
                        date: benchmarks?.ipca?.lastDate || null,
                    },
                ],
                secondary: ipcaYear !== null ? `IPCA no ano: ${formatPercent(ipcaYear)}` : null,
                note: "Juros e inflação influenciam custo de oportunidade, cap rate, financiamento e apetite por FIIs.",
                date: lastDate,
                updatedAt: new Date().toISOString(),
            },
            {
                headers: {
                    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
                    Pragma: "no-cache",
                    Expires: "0",
                },
            }
        );
    } catch (err: any) {
        return NextResponse.json(
            {
                ok: false,
                title: "Contexto macro para FIIs",
                items: [],
                note: "Contexto macro indisponível no momento.",
                updatedAt: new Date().toISOString(),
                error: err?.message || "Erro ao consultar contexto macro.",
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
}
