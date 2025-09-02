"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import CookieBanner from "./components/CookieBanner";
import PersonalizedNews from "./components/PersonalizedNews";
import FiiTopPanels from "./components/FiiTopPanels";
import FiiSummary from "./components/FiiSummary";
import Login from "./components/Login"; // <-- Importando Login

export default function Home() {
    const [stats, setStats] = useState<{ visit: number; search: number }>({ visit: 0, search: 0 });
    const [ticker, setTicker] = useState("");
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState("");
    const [dolar, setDolar] = useState<string>("...");
    const [loadingFII, setLoadingFII] = useState(false);
    const [isMarketOpen, setIsMarketOpen] = useState(false);
    const [showLogin, setShowLogin] = useState(false); // controla exibição do Login

    // Mostrar botão de Login apenas em localhost
    useEffect(() => {
        if (typeof window !== "undefined") {
            setShowLogin(window.location.hostname === "localhost");
        }
    }, []);

    const fetchFII = async () => {
        setError("");
        setData(null);
        setLoadingFII(true);
        if (!ticker.trim()) {
            setError("Digite um ticker válido.");
            return;
        }
        try {
            const res = await fetch(`/api/fii?ticker=${ticker.toUpperCase().trim()}`);
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
                body: JSON.stringify({ fii: ticker.toUpperCase().trim() }),
            });
            await fetch("/api/stats", { method: "POST", body: JSON.stringify({ type: "search" }) });
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
        const monthsOrder = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return Object.entries(yearData).sort(
            ([a], [b]) => monthsOrder.indexOf(a) - monthsOrder.indexOf(b)
        );
    };

    const monthsPTBR: Record<string, string> = {
        January: "Janeiro", February: "Fevereiro", March: "Março", April: "Abril",
        May: "Maio", June: "Junho", July: "Julho", August: "Agosto",
        September: "Setembro", October: "Outubro", November: "Novembro", December: "Dezembro",
    };

    useEffect(() => {
        const fetchDolar = async () => {
            try {
                const res = await fetch("/api/dolar");
                const json = await res.json();
                setDolar(json.formatted);
            } catch {
                setDolar("Erro");
            }
        };
        fetchDolar();
    }, []);

    useEffect(() => {
        fetch("/api/stats", { method: "POST", body: JSON.stringify({ type: "visit" }) });
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

    const lastDividend = useMemo(() => {
        const dividends = getCurrentYearDividends(data?.earnings2025 || {});
        if (!dividends.length) return null;
        const [, info]: any = dividends[dividends.length - 1];
        return parseFloat(info.earnings.replace("R$ ", "").replace(",", "."));
    }, [data]);

    return (
        <div className="font-sans text-center mt-12 px-4">
            {/* Login fixo no topo direito, apenas em localhost */}
            {showLogin && (
                <div className="fixed top-4 right-4">
                    <Login />
                </div>
            )}

            <h1 className="text-2xl font-bold mb-2">📊 Dados de Fundos Imobiliários</h1>
            <p className="text-gray-600">Consulte informações resumidas de FIIs</p>

            <div className="mt-4 text-gray-400">
                💵 Cotação do dólar: {dolar}
                <br /><br />
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

            <div className="mt-6 flex justify-center gap-2">
                <input
                    type="text"
                    placeholder="Digite o ticker (ex: ABCD11)"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value)}
                    className="p-2 w-56 rounded-lg border border-gray-400 bg-gray-100 text-black"
                />
                <button
                    onClick={fetchFII}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700"
                >
                    Consultar
                </button>
            </div>
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
                />
            )}

            <PersonalizedNews />

            <br /><br />
            <div className="fixed bottom-0 left-0 w-full bg-yellow-500 text-black text-center py-2 text-sm font-semibold shadow-md">
                🚧 Este site está em versão Beta – Algumas funcionalidades podem mudar ou estar em testes.
            </div>

            <CookieBanner />
        </div>
    );
}
