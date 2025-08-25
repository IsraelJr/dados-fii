'use client';

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, DollarSign, Building2, BarChart3, ClipboardCopy, CalendarDays, Hash, Loader2 } from "lucide-react";
import CookieBanner from "./components/CookieBanner";
import PersonalizedNews from "./components/PersonalizedNews";

export default function Home() {
    const [stats, setStats] = useState<{ visit: number; search: number }>({ visit: 0, search: 0 });
    const [ticker, setTicker] = useState("");
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState("");
    const [dolar, setDolar] = useState<string>("...");
    const [loadingFII, setLoadingFII] = useState(false);

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

            // Registra pesquisa no Firestore
            await fetch("/api/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fii: ticker.toUpperCase().trim() }),
            });

            // Incrementa estatística de busca
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
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        return Object.entries(yearData).sort(
            ([monthA], [monthB]) => monthsOrder.indexOf(monthA) - monthsOrder.indexOf(monthB)
        );
    };

    const monthsPTBR: Record<string, string> = {
        January: "Janeiro", February: "Fevereiro", March: "Março", April: "Abril",
        May: "Maio", June: "Junho", July: "Julho", August: "Agosto",
        September: "Setembro", October: "Outubro", November: "Novembro", December: "Dezembro",
    };

    const copyJSON = () => {
        if (!data) return;
        const filtered = {
            ativo: data.active ? "Sim" : "Não",
            ticker: data.code,
            DY: data.dividendYield,
            isIFIX: data.isIFIX ? "Sim" : "Não",
            preço: data.price,
            totalQuotas: data.numberShares,
            segmento: data.segment_new,
            razãoSocial: data.socialReason,
            dividendos: getCurrentYearDividends(data.earnings2025).map(
                ([month, info]: any) => {
                    const value = parseFloat(info.earnings.replace("R$ ", "").replace(",", "."));
                    return { month, earnings: value.toFixed(3), payment_date: info.payment_date };
                }
            )
        };
        navigator.clipboard.writeText(JSON.stringify(filtered, null, 2));
        alert("JSON copiado para a área de transferência!");
    };

    // Cotação do dólar
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

    // Registrar visita
    useEffect(() => {
        fetch("/api/stats", { method: "POST", body: JSON.stringify({ type: "visit" }) });
    }, []);

    // Carregar stats
    useEffect(() => {
        const loadStats = async () => {
            const res = await fetch("/api/stats");
            const data = await res.json();
            setStats(data);
        };
        loadStats();
    }, []);

    return (
        <div className="font-sans text-center mt-12 px-4">
            <h1 className="text-2xl font-bold mb-2">📊 Dados de Fundos Imobiliários</h1>
            <p className="text-gray-600">Consulte informações resumidas de FIIs</p>

            <div className="mt-4 text-gray-400">
                💵 Cotação do dólar: {dolar}
            </div>

            <div className="mt-6 flex justify-center gap-2">
                <input
                    type="text"
                    placeholder="Digite o ticker (ex: TGAR11)"
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

            {error && <div className="text-red-400 mt-4">{error}</div>}

            {loadingFII && (
                <p className="flex items-center justify-center text-gray-500 italic mt-4">
                    <Loader2 className="animate-spin mr-2" size={20} /> Carregando dados do FII...
                </p>
            )}

            {data && (
                <div className="mt-8 mx-auto max-w-3xl p-6 rounded-2xl bg-gray-900 text-gray-100 shadow-lg">
                    {/* FII Details */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2">
                            {data.active ? <CheckCircle className="text-green-400" /> : <XCircle className="text-red-400" />}
                            <span><strong>Ativo:</strong> {data.active ? "Sim" : "Não"}</span>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2">
                            <BarChart3 className="text-blue-400" />
                            <span><strong>Ticker:</strong> {data.code}</span>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2">
                            <DollarSign className="text-yellow-400" />
                            <span><strong>DY:</strong> {data.dividendYield}</span>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2">
                            {data.isIFIX ? <CheckCircle className="text-green-400" /> : <XCircle className="text-red-400" />}
                            <span><strong>IFIX:</strong> {data.isIFIX ? "Sim" : "Não"}</span>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2">
                            <DollarSign className="text-green-400" />
                            <span><strong>Preço:</strong> {data.price || "N/A"}</span>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2">
                            <Hash className="text-orange-400" />
                            <span><strong>Total de Quotas:</strong> {data.numberShares?.toLocaleString("pt-BR") || "N/A"}</span>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2">
                            <Building2 className="text-purple-400" />
                            <span><strong>Segmento:</strong> {data.segment_new}</span>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2 col-span-2 md:col-span-3">
                            <Building2 className="text-pink-400" />
                            <span><strong>Razão Social:</strong> {data.socialReason}</span>
                        </div>
                    </div>

                    {/* Dividendos */}
                    <h3 className="text-xl font-bold mt-6 mb-2">💰 Dividendos ({new Date().getFullYear()}):</h3>
                    <div className="bg-gray-800 rounded-xl p-4">
                        <ul className="space-y-2">
                            {getCurrentYearDividends(data.earnings2025).map(([month, info]: any) => {
                                const monthPT = monthsPTBR[month] || month;
                                const value = parseFloat(info.earnings.replace("R$ ", "").replace(",", "."));
                                const formatted = `R$ ${value.toFixed(3)}`;
                                return (
                                    <li key={month} className="flex items-center gap-2">
                                        <CalendarDays className="text-indigo-400" />
                                        <span>
                                            <strong>{monthPT}:</strong> {formatted} | Pago em {info.payment_date}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    <button
                        onClick={copyJSON}
                        className="mt-6 px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 flex items-center gap-2"
                    >
                        <ClipboardCopy size={18} /> Copiar JSON
                    </button>

                    <div className="text-gray-400 text-sm mt-2">
                        <br />
                        👥 {stats.visit} visitantes | 🔎 {stats.search} buscas
                    </div>
                </div>
            )}

            {/* Painel de notícias personalizadas */}
            <br />
            <PersonalizedNews />

            <br /><br />
            <div className="fixed bottom-0 left-0 w-full bg-yellow-500 text-black text-center py-2 text-sm font-semibold shadow-md">
                🚧 Este site está em versão Beta – Algumas funcionalidades podem mudar ou estar em testes.
            </div>
            <CookieBanner />
        </div>
    );
}
