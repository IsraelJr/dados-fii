'use client';

import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";

interface FII {
    code: string;
    price: string;
    opening: string;
    variation: string;
}

type FiiWithNumeric = FII & {
    priceNum: number;
    openingNum: number;
    variationNum: number;
    variationFromSheet: boolean;
};

const parseBRL = (s?: string) => {
    if (!s) return NaN;
    try {
        const clean = String(s)
            .replace(/R\$\s?/i, "")
            .replace(/\s/g, "")
            .replace(/\./g, "")
            .replace(",", ".");
        return Number(clean);
    } catch {
        return NaN;
    }
};

const parsePercent = (s?: string) => {
    if (!s) return NaN;
    try {
        if (/R\$/i.test(s)) return NaN;
        const clean = String(s).replace("%", "").replace(/\s/g, "").replace(",", ".");
        return Number(clean);
    } catch {
        return NaN;
    }
};

const formatBRL = (n: number) =>
    Number.isFinite(n)
        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)
        : "-";

const formatPercent = (n: number) =>
    Number.isFinite(n)
        ? `${n >= 0 ? "+" : ""}${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}%`
        : "-";

export default function FiiTopPanels() {
    const [fiis, setFiis] = useState<FII[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        const fetchFiis = async () => {
            try {
                const res = await fetch(`/api/fii?limit=500&ts=${Date.now()}`, { cache: "no-store" });
                const data: { items?: FII[] } = await res.json();
                if (active) setFiis(Array.isArray(data.items) ? data.items : []);
            } catch (err) {
                console.error("Erro ao buscar FIIs:", err);
                if (active) setFiis([]);
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchFiis();
        const interval = window.setInterval(fetchFiis, 5 * 60 * 1000);

        return () => {
            active = false;
            window.clearInterval(interval);
        };
    }, []);

    if (loading) return <p>Carregando FIIs...</p>;

    const normalized: FiiWithNumeric[] = fiis.map((fii) => {
        const priceNum = parseBRL(fii.price);
        const openingNum = parseBRL(fii.opening);
        const sheetVar = parsePercent(fii.variation);
        const variationFromSheet = Number.isFinite(sheetVar);
        let variationNum = sheetVar;

        if (!variationFromSheet) {
            if (Number.isFinite(priceNum) && Number.isFinite(openingNum) && openingNum !== 0) {
                variationNum = ((priceNum - openingNum) / openingNum) * 100;
            } else {
                variationNum = 0;
            }
        }

        return {
            ...fii,
            priceNum,
            openingNum,
            variationNum,
            variationFromSheet,
        };
    });

    const topAltas = [...normalized].sort((a, b) => b.variationNum - a.variationNum).slice(0, 3);
    const topBaixas = [...normalized].sort((a, b) => a.variationNum - b.variationNum).slice(0, 3);

    const Badge = ({
        code,
        variationNum,
        priceNum,
        type,
    }: {
        code: string;
        variationNum: number;
        priceNum: number;
        type: "up" | "down";
    }) => {
        const percentLabel = formatPercent(variationNum);
        return (
            <div
                className={`p-2 rounded shadow text-xs cursor-pointer flex items-center gap-2 ${type === "up" ? "bg-green-800 text-green-200" : "bg-red-800 text-red-200"
                    }`}
                title={`Preço atual: ${Number.isFinite(priceNum) ? formatBRL(priceNum) : "-"}`}
            >
                {type === "up" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                <span className="font-bold">{code}</span>
                <span>{percentLabel}</span>
            </div>
        );
    };

    return (
        <div className="flex flex-col items-center gap-4 max-w-lg mx-auto">
            <div className="w-full">
                <h3 className="text-center font-bold text-green-700 mb-2">📈 Maiores Altas</h3>
                <div className="flex justify-center gap-2 flex-wrap">
                    {topAltas.map((fii) => (
                        <Badge
                            key={`alta-${fii.code}`}
                            code={fii.code}
                            variationNum={fii.variationNum}
                            priceNum={fii.priceNum}
                            type="up"
                        />
                    ))}
                </div>
            </div>

            <div className="w-full">
                <h3 className="text-center font-bold text-red-700 mb-2">📉 Maiores Baixas</h3>
                <div className="flex justify-center gap-2 flex-wrap">
                    {topBaixas.map((fii) => (
                        <Badge
                            key={`baixa-${fii.code}`}
                            code={fii.code}
                            variationNum={fii.variationNum}
                            priceNum={fii.priceNum}
                            type="down"
                        />
                    ))}
                </div>
            </div>
            <p className="text-gray-600">Possui atraso de aproximadamente 15 minutos</p>
        </div>
    );
}
