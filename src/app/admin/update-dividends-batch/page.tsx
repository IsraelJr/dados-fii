'use client';

import { useState } from "react";

export default function UpdateDividendsBatchPage() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [limit, setLimit] = useState("10");
  const [cursor, setCursor] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");

  async function runBatch(currentCursor: string) {
    const res = await fetch("/api/admin/update-dividends-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year: Number(year),
        limit: Number(limit),
        cursor: currentCursor || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao atualizar dividendos em lote.");
    return data;
  }

  async function runOne() {
    setRunning(true);
    setResult("");

    try {
      const data = await runBatch(cursor);
      setCursor(data.nextCursor || "");
      setResult(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setResult(err.message || "Erro inesperado.");
    } finally {
      setRunning(false);
    }
  }

  async function runAll() {
    setRunning(true);
    setResult("");
    let currentCursor = cursor;
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalFailed = 0;

    try {
      while (true) {
        const data = await runBatch(currentCursor);
        totalProcessed += Number(data.processed || 0);
        totalUpdated += Number(data.updated || 0);
        totalFailed += Number(data.failed || 0);
        currentCursor = data.nextCursor || "";
        setCursor(currentCursor);
        setResult(JSON.stringify({ ...data, totalProcessed, totalUpdated, totalFailed }, null, 2));
        if (!data.hasMore) break;
      }
    } catch (err: any) {
      setResult(err.message || "Erro inesperado.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6 text-gray-900">
      <h1 className="mb-2 text-2xl font-bold">Atualização massiva de dividendos</h1>
      <p className="mb-6 text-sm text-gray-600">
        Usa StatusInvest, em lotes, e atualiza apenas earnings do ano informado.
      </p>

      <div className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
        <label className="block">
          <span className="text-sm font-semibold">Ano</span>
          <input value={year} onChange={(e) => setYear(e.target.value)} className="mt-1 w-full rounded-lg border p-2" />
        </label>

        <label className="block">
          <span className="text-sm font-semibold">Tamanho do lote</span>
          <input value={limit} onChange={(e) => setLimit(e.target.value)} className="mt-1 w-full rounded-lg border p-2" />
        </label>

        <label className="block">
          <span className="text-sm font-semibold">Cursor</span>
          <input value={cursor} onChange={(e) => setCursor(e.target.value)} className="mt-1 w-full rounded-lg border p-2" placeholder="Vazio para começar do início" />
        </label>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={runOne} disabled={running} className="rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white disabled:bg-gray-400">
            Atualizar 1 lote
          </button>
          <button type="button" onClick={runAll} disabled={running} className="rounded-lg bg-green-600 px-4 py-2 font-bold text-white disabled:bg-gray-400">
            Atualizar tudo
          </button>
          <button type="button" onClick={() => { setCursor(""); setResult(""); }} disabled={running} className="rounded-lg bg-gray-200 px-4 py-2 font-bold text-gray-800 disabled:bg-gray-100">
            Resetar cursor
          </button>
        </div>
      </div>

      {result && <pre className="mt-6 overflow-auto rounded-2xl bg-gray-950 p-4 text-sm text-gray-100">{result}</pre>}
    </main>
  );
}
