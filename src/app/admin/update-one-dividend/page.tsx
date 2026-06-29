'use client';

import { useState } from "react";

export default function UpdateOneDividendPage() {
  const [secret, setSecret] = useState("");
  const [ticker, setTicker] = useState("VGIA11");
  const [year, setYear] = useState("2026");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  async function update() {
    setLoading(true);
    setResult("");

    try {
      const res = await fetch("/api/admin/update-one-dividend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, ticker, year: Number(year) }),
      });

      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error: any) {
      setResult(error.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6 text-gray-900">
      <h1 className="mb-4 text-2xl font-bold">Atualizar dividendos de 1 FII</h1>

      <div className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
        <label className="block">
          <span className="text-sm font-semibold">Senha ADMIN_UPDATE_SECRET</span>
          <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} className="mt-1 w-full rounded-lg border p-2" />
        </label>

        <label className="block">
          <span className="text-sm font-semibold">Ticker</span>
          <input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} className="mt-1 w-full rounded-lg border p-2" />
        </label>

        <label className="block">
          <span className="text-sm font-semibold">Ano</span>
          <input value={year} onChange={(e) => setYear(e.target.value)} className="mt-1 w-full rounded-lg border p-2" />
        </label>

        <button type="button" onClick={update} disabled={loading} className="rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white disabled:bg-gray-400">
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      {result && <pre className="mt-6 overflow-auto rounded-2xl bg-gray-950 p-4 text-sm text-gray-100">{result}</pre>}
    </main>
  );
}
