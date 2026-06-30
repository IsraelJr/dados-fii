"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Loader2, Wallet } from "lucide-react";
import CookieBanner from "./components/CookieBanner";
import PersonalizedNews from "./components/PersonalizedNews";
import FiiTopPanels from "./components/FiiTopPanels";
import FiiSummary from "./components/FiiSummary";
import Login from "./components/Login";
import MonitoredFiisPanel from "./components/MonitoredFiisPanel";
import GoogleAdsBlock from "./components/GoogleAdsBlock";
import HomeDividendCalendar from "./components/HomeDividendCalendar";

type DollarState = {
    formatted: string;
    source?: string | null;
    updatedAt?: string | null;
};

const DOLLAR_CACHE_KEY = "dados-fii-dollar-cache-v1";

function getCachedDollar(): DollarState {
    if (typeof window === "undefined") return { formatted: "..." };

    try {
        const stored = window.localStorage.getItem(DOLLAR_CACHE_KEY);
        if (!stored) return { formatted: "..." };

        const parsed = JSON.parse(stored) as DollarState;
        return parsed?.formatted ? parsed : { formatted: "..." };
    } catch {
        return { formatted: "..." };
    }
}

function saveCachedDollar(value: DollarState) {
    try {
        window.localStorage.setItem(DOLLAR_CACHE_KEY, JSON.stringify(value));
    } catch {
        return;
    }
}

function formatDollarUpdateTime(value?: string | null) {
    if (!value) return "";

    try {
        return new Intl.DateTimeFormat("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        }).format(new Date(value));
    } catch {
        return "";
    }
}

function isDollarRefreshWindow(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo",
        weekday: "short",
        hour: "2-digit",
        hour12: false,
    }).formatToParts(date);

    const weekday = parts.find((part) => part.type === "weekday")?.value;
    const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
    const isWeekday = weekday !== "Sat" && weekday !== "Sun";

    return isWeekday && hour >= 9 && hour < 18;
}

export default function Home() {
    const [stats, setStats] = useState<{ visit: number; search: number }>({ visit: 0, search: 0 });
    const [ticker, setTicker] = useState("");
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState("");
    const [dolar, setDolar] = useState<DollarState>(() => getCachedDollar());
    const [loadingFII, setLoadingFII] = useState(false);
    const [isMarketOpen, setIsMarketOpen] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [adsClosed, setAdsClosed] = useState(true);

    const closeAds = useCallback(() => {
        setAdsClosed(true);
    }, []);

    useEffect(() => {
        if (typeof window !== "undefined") {
            setShowLogin(window.location.hostname === "localhost");
        }
    }, []);

    const fetchFII = async () => {
        setError("");
        setData(null);

        if (!ticker.trim()) {
            setError("Digite um ticker válido.");
            return;
        }

        setLoadingFII(true);

        try {
            const normalizedTicker = ticker.toUpperCase().trim();
            const res = await fetch(`/api/fii?ticker=${normalizedTicker}`);

            if (!res.ok) {
                const err = await res.json();
                setError(err.error || "Erro ao buscar FII");
                return;
            }

            const json = await res.json();
            setData(json);

            await fetch("/api/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fii: normalizedTicker }),
            });

            await fetch("/api/stats", {
                method: "POST",
                body: JSON.stringify({ type: "search" }),
            });

            const statsRes = await fetch("/api/stats");
            const statsData = await statsRes.json();
            setStats(statsData);
        } catch (err: any) {
            setError(err.message || "Erro desconhecido");
        } finally {
            setLoadingFII(false);
        }
    };

    const getCurrentYearDividends = (yearData: any) => {
        if (!yearData) return [];

        const monthsOrder = [
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

        return Object.entries(yearData).sort(
            ([a], [b]) => monthsOrder.indexOf(a) - monthsOrder.indexOf(b)
        );
    };

    const monthsPTBR: Record<string, string> = {
        January: "Janeiro",
        February: "Fevereiro",
        March: "Março",
        April: "Abril",
        May: "Maio",
        June: "Junho",
        July: "Julho",
        August: "Agosto",
        September: "Setembro",
        October: "Outubro",
        November: "Novembro",
        December: "Dezembro",
    };

    useEffect(() => {
        let active = true;

        const fetchDolar = async () => {
            try {
                const res = await fetch(`/api/dolar?ts=${Date.now()}`, { cache: "no-store" });
                const json = await res.json();

                if (!active) return;

                const nextDollar = {
                    formatted: json.formatted || "Indisponível",
                    source: json.source,
                    updatedAt: json.updatedAt,
                };

                setDolar(nextDollar);
                saveCachedDollar(nextDollar);
            } catch {
                if (active && !dolar.formatted) setDolar({ formatted: "Erro" });
            }
        };

        fetchDolar();
        const interval = setInterval(() => {
            if (isDollarRefreshWindow()) fetchDolar();
        }, 5 * 60 * 1000);

        return () => {
            active = false;
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        fetch("/api/stats", {
            method: "POST",
            body: JSON.stringify({ type: "visit" }),
        });
    }, []);

    useEffect(() => {
        const loadStats = async () => {
            const res = await fetch("/api/stats");
            const data = await res.json();
            setStats(data);
        };

        loadStats();
    }, []);

    useEffect(() => {
        const checkMarketHours = () => {
            const now = new Date();
            const hours = now.getHours();
            const day = now.getDay();
            const isWeekday = day >= 1 && day <= 5;
            const isWithinHours =
                hours >= Number(process.env.NEXT_PUBLIC_OPENING_TIME) &&
                hours < Number(process.env.NEXT_PUBLIC_CLOSING_TIME);

            setIsMarketOpen(isWeekday && isWithinHours);
        };

        checkMarketHours();
        const interval = setInterval(checkMarketHours, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, []);

    const currentYear = new Date().getFullYear();

    const lastDividend = useMemo(() => {
        if (!data) return null;

        const yearKey = `earnings${currentYear}`;
        const dividends = getCurrentYearDividends(data[yearKey] || {});

        if (!dividends.length) return null;

        const [, info]: any = dividends[dividends.length - 1];
        return parseFloat(info.earnings.replace("R$ ", "").replace(",", "."));
    }, [data, currentYear]);

    const dollarUpdatedAt = formatDollarUpdateTime(dolar.updatedAt);

    return (
        <div className="font-sans text-center mt-12 px-4">
            {showLogin && (
                <div className="fixed top-4 right-4">
                    <Login />
                </div>
            )}

            <h1 className="text-2xl font-bold mb-2">📊 Dados de Fundos Imobiliários</h1>
            <p className="text-gray-600">Consulte informações resumidas de FIIs</p>

            <div className="mx-auto mt-4 max-w-fit rounded-2xl bg-gray-900 px-5 py-3 text-gray-100 shadow-lg ring-1 ring-white/10">
                <p className="text-sm font-bold text-white">💵 Dólar comercial: {dolar.formatted}</p>
                <p className="mt-1 text-xs font-medium text-gray-300">
                    {dolar.source ? `Fonte: ${dolar.source}` : "Fonte indisponível"}
                    {dollarUpdatedAt ? ` · Atualizado às ${dollarUpdatedAt}` : ""}
                </p>
            </div>

            <br />

            <Link
                href="/carteira"
                className="mx-auto mb-6 inline-flex max-w-fit items-center gap-2 rounded-full bg-indigo-600 px-5 py-3 font-bold text-white shadow-lg transition-colors hover:bg-indigo-700"
            >
                <Wallet size={18} /> Minha Carteira e Dividendos
            </Link>

            <HomeDividendCalendar />

            <div className="flex top-4 left-4">
                <MonitoredFiisPanel />
            </div>

            <div>
                {isMarketOpen ? (
                    <FiiTopPanels />
                ) : (
                    <p className="text-gray-400 italic text-center mt-4">
                        {`Painel de maiores altas e baixas disponível de segunda à sexta entre ${Number(process.env.NEXT_PUBLIC_OPENING_TIME)}h e ${Number(process.env.NEXT_PUBLIC_CLOSING_TIME)}h.`}
                    </p>
                )}
            </div>

            {!adsClosed && <GoogleAdsBlock onClose={closeAds} />}

            {adsClosed && (
                <div className="mt-6 flex justify-center gap-2">
                    <input
                        type="text"
                        placeholder="Digite o ticker (ex: ABCD11)"
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") fetchFII();
                        }}
                        className="p-2 w-56 rounded-lg border border-gray-400 bg-gray-100 text-black"
                    />
                    <button
                        onClick={fetchFII}
                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700"
                    >
                        Consultar
                    </button>
                </div>
            )}

            <div className="text-gray-400 text-sm mt-2">
                👥 {stats.visit} visitantes | 🔎 {stats.search} buscas
            </div>

            {error && <div className="text-red-400 mt-4">{error}</div>}

            {loadingFII && (
                <p className="flex items-center justify-center text-gray-500 italic mt-4">
                    <Loader2 className="animate-spin mr-2" size={20} /> Carregando dados do FII...
                </p>
            )}

            {data && (
                <FiiSummary
                    data={data}
                    getCurrentYearDividends={getCurrentYearDividends}
                    monthsPTBR={monthsPTBR}
                    lastDividend={lastDividend}
                    onDividendUpdate={fetchFII}
                />
            )}

            <PersonalizedNews />

            <section className="mx-auto mt-8 max-w-4xl rounded-2xl bg-white p-5 text-left shadow-sm ring-1 ring-slate-200">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
                            <BookOpen size={14} /> Cantinho da leitura
                        </p>
                        <h2 className="mt-3 text-xl font-extrabold text-slate-800">Educação financeira também começa cedo</h2>
                        <p className="mt-1 text-sm text-slate-600">
                            Conheça livros e materiais sobre dinheiro, escolhas e investimentos.
                        </p>
                    </div>
                    <Link
                        href="/livros"
                        className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
                    >
                        Ver livros
                    </Link>
                </div>
            </section>

            <br />
            <br />
            <div className="fixed bottom-0 left-0 w-full bg-yellow-500 text-black text-center py-2 text-sm font-semibold shadow-md">
                🚧 Este site está em versão Beta – Algumas funcionalidades podem mudar ou estar em testes.
            </div>

            <CookieBanner />
        </div>
    );
}
