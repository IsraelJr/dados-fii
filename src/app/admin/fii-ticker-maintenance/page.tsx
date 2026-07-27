'use client';

import { useState } from "react";

export default function FiiTickerMaintenancePage() {
    const [ticker, setTicker] = useState("TGAR11");
    const [year, setYear] = useState("2026");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState("");

    async function run() {
        setLoading(true);
        setResult("");

        try {
            const res = await fetch("/api/admin/fii-maintenance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ticker: ticker.trim().toUpperCase(),
                    action: "both",
                    year: Number(year),
                    limit: 1,
                }),
            });

            const data = await res.json();
            setResult(JSON.stringify(data, null, 2));
        } catch (err: any) {
            setResult(err.message || "Erro inesperado");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="mx-auto max-w-2xl p-6 text-gray-900">
            <h1 className="mb-2 text-2xl font-bold">Atualização temporária por ticker</h1>
            <p className="mb-6 text-sm text-gray-600">
                Use para testar TGAR11 ou outro FII específico. Depois apague esta página.
            </p>

            <div className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
                <label className="block">
                    <span className="text-sm font-semibold">Ticker</span>
                    <input
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value.toUpperCase())}
                        className="mt-1 w-full rounded-lg border p-2"
                    />
                </label>

                <label className="block">
                    <span className="text-sm font-semibold">Ano</span>
                    <input
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="mt-1 w-full rounded-lg border p-2"
                    />
                </label>

                <button
                    type="button"
                    onClick={run}
                    disabled={loading}
                    className="rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white disabled:bg-gray-400"
                >
                    {loading ? "Atualizando..." : "Atualizar ticker"}
                </button>
            </div>

            {result && (
                <pre className="mt-6 overflow-auto rounded-2xl bg-gray-950 p-4 text-sm text-gray-100">
                    {result}
                </pre>
            )}
        </main>
    );
}
