"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Loader2, Search } from "lucide-react";
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
const FII_RESULT_ANCHOR = "fii-search-result";
const MARKET_OPEN_HOUR = 9;
const MARKET_CLOSE_HOUR = 19;

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
        }).format(new Date(value));
    } catch {
        return "";
    }
}

function getSaoPauloMarketParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo",
        weekday: "short",
        hour: "2-digit",
        hour12: false,
    }).formatToParts(date);

    const weekday = parts.find((part) => part.type === "weekday")?.value;
    const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
    const isWeekday = weekday !== "Sat" && weekday !== "Sun";

    return { hour, isWeekday };
}

function isMarketRefreshWindow(date = new Date()) {
    const { hour, isWeekday } = getSaoPauloMarketParts(date);
    return isWeekday && hour >= MARKET_OPEN_HOUR && hour < MARKET_CLOSE_HOUR;
}

export default function Home() {
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

            window.setTimeout(() => {
                document.getElementById(FII_RESULT_ANCHOR)?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });
            }, 100);

            await fetch("/api/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fii: normalizedTicker }),
            });
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
            if (isMarketRefreshWindow()) fetchDolar();
        }, 5 * 60 * 1000);

        return () => {
            active = false;
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        const checkMarketHours = () => {
            setIsMarketOpen(isMarketRefreshWindow());
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
        <main className="font-sans">
            {showLogin && (
                <div className="fixed right-4 top-20 z-50">
                    <Login />
                </div>
            )}

            <section className="bg-gradient-to-b from-white to-slate-50 px-4 py-8 md:py-12">
                <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
                    <div className="rounded-3xl bg-white p-6 text-left shadow-sm ring-1 ring-slate-200 md:p-8">
                        <p className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-700">
                            Fundos imobiliários, dividendos e carteira
                        </p>
                        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-5xl">
                            Consulte FIIs com mais clareza.
                        </h1>
                        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                            O Dados FII reúne consulta de fundos imobiliários, calendário de dividendos, próximos pagamentos,
                            carteira de FIIs, notícias e educação financeira em uma navegação simples.
                        </p>

                        <div className="mt-6 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                    type="text"
                                    placeholder="Digite o ticker, ex: ABCD11"
                                    value={ticker}
                                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") fetchFII();
                                    }}
                                    className="min-h-12 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                />
                                <button
                                    onClick={fetchFII}
                                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-extrabold text-white shadow-sm hover:bg-indigo-700"
                                >
                                    <Search size={18} /> Consultar
                                </button>
                            </div>
                            {error && <p className="mt-3 text-sm font-bold text-red-600">{error}</p>}
                            {loadingFII && (
                                <p className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-500">
                                    <Loader2 className="animate-spin" size={18} /> Carregando dados do FII...
                                </p>
                            )}
                        </div>
                    </div>

                    <aside className="grid gap-3">
                        <div className="rounded-3xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
                            <p className="text-sm font-bold text-gray-300">Dólar comercial</p>
                            <strong className="mt-2 block text-3xl text-indigo-300">{dolar.formatted}</strong>
                            <p className="mt-2 text-xs font-medium text-gray-300">
                                {dolar.source ? `Fonte: ${dolar.source}` : "Fonte indisponível"}
                                {dollarUpdatedAt ? ` · Atualizado às ${dollarUpdatedAt}` : ""}
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                            <FeatureCard title="Consulta rápida" description="Preço, dividendos, DY, P/VP e dados cadastrais." />
                            <FeatureCard title="Calendário" description="Data-com, pagamento e rendimento por cota." />
                            <FeatureCard title="Carteira" description="Renda estimada e próximos pagamentos salvos no navegador." />
                        </div>
                    </aside>
                </div>
            </section>

            <section className="mx-auto max-w-6xl space-y-8 px-4 py-6">
                {!adsClosed && <GoogleAdsBlock onClose={closeAds} />}

                {data && (
                    <div id={FII_RESULT_ANCHOR} className="scroll-mt-24">
                        <FiiSummary
                            data={data}
                            getCurrentYearDividends={getCurrentYearDividends}
                            monthsPTBR={monthsPTBR}
                            lastDividend={lastDividend}
                            onDividendUpdate={fetchFII}
                        />
                    </div>
                )}

                <HomeDividendCalendar />

                <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="space-y-6">
                        <MonitoredFiisPanel />

                        <section className="rounded-2xl bg-white p-5 text-left shadow-sm ring-1 ring-slate-200">
                            <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
                                <BookOpen size={14} /> Educação financeira
                            </p>
                            <h2 className="mt-3 text-xl font-extrabold text-slate-800">Aprenda sobre FIIs, dinheiro e bons hábitos</h2>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Veja explicações simples, exemplos práticos e livros sobre dinheiro, escolhas e investimentos.
                            </p>
                            <Link
                                href="/educacao"
                                className="mt-4 inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
                            >
                                Ver educação financeira
                            </Link>
                        </section>
                    </div>

                    <div>
                        {isMarketOpen ? (
                            <FiiTopPanels />
                        ) : (
                            <section className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
                                <p className="text-sm font-bold text-slate-500">
                                    {`Painel de maiores altas e baixas disponível de segunda à sexta entre ${MARKET_OPEN_HOUR}h e ${MARKET_CLOSE_HOUR}h.`}
                                </p>
                            </section>
                        )}
                    </div>
                </div>

                <PersonalizedNews />

                <section className="rounded-2xl bg-slate-100 p-5 text-left ring-1 ring-slate-200">
                    <h2 className="text-xl font-extrabold text-slate-800">Acompanhe FIIs com mais clareza</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                        Use o Dados FII para consultar fundos imobiliários, acompanhar rendimentos, verificar próximos dividendos
                        e organizar sua carteira. As informações ajudam no acompanhamento, mas não substituem análise própria,
                        leitura de relatórios gerenciais e comunicados oficiais dos fundos.
                    </p>
                </section>
            </section>

            <CookieBanner />
        </main>
    );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
    return (
        <div className="rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-extrabold text-slate-800">{title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
    );
}
