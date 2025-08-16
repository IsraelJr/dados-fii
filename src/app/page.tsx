'use client';

import { useState } from "react";
import { CheckCircle, XCircle, DollarSign, Building2, BarChart3, ClipboardCopy, CalendarDays } from "lucide-react";

export default function Home() {
    const [ticker, setTicker] = useState("");
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState("");

    const fetchFII = async () => {
        setError("");
        setData(null);

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
        } catch (err: any) {
            setError(err.message || "Erro desconhecido");
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

    const copyJSON = () => {
        if (!data) return;
        const filtered = {
            ativo: data.active ? "Sim" : "Não",
            ticker: data.code,
            DY: data.dividendYield,
            isIFIX: data.isIFIX ? "Sim" : "Não",
            preço: data.price,
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

    return (
        <div className="font-sans text-center mt-12 px-4">
            <h1 className="text-2xl font-bold mb-2">📊 Dados de Fundos Imobiliários</h1>
            <p className="text-gray-600">Consulte informações resumidas de FIIs</p>

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

            {error && (
                <div className="text-red-400 mt-4">{error}</div>
            )}

            {data && (
                <div className="mt-8 mx-auto max-w-3xl p-6 rounded-2xl bg-gray-900 text-gray-100 shadow-lg">
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
                            <span><strong>Preço:</strong> {data.price}</span>
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
                </div>
            )}
        </div>
    );
}
