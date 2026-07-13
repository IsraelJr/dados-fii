'use client';

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Loader2, LockKeyhole, Scale, Trophy } from "lucide-react";
import { readRegisteredUserCredentials } from "@/lib/registeredUserClient";

type ComparisonPayload = Record<string, any> | null;

function number(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(numeric) : "—";
}

function formatTickerList(value: string) {
  return [...new Set(String(value || "")
    .toUpperCase()
    .split(/[\s,;|]+/)
    .map((item) => item.replace(/[^A-Z0-9]/g, ""))
    .filter(Boolean))]
    .slice(0, 5);
}

export default function RegulatoryComparatorPage() {
  const [input, setInput] = useState("KNCA11, MXRF11");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [payload, setPayload] = useState<ComparisonPayload>(null);
  const tickers = useMemo(() => formatTickerList(input), [input]);

  async function compare() {
    const credentials = readRegisteredUserCredentials();
    if (!credentials.email || !credentials.sessionToken) {
      setRequiresLogin(true);
      setError("Confirme seu e-mail cadastrado antes de usar o comparador.");
      return;
    }
    setLoading(true);
    setError("");
    setRequiresLogin(false);
    setPayload(null);
    try {
      const response = await fetch("/api/fii-regulatory-comparator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers, ...credentials }),
        cache: "no-store",
      });
      const json = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 403) setRequiresLogin(true);
      if (!response.ok) throw new Error(json?.error || "Não foi possível comparar os fundos.");
      setPayload(json);
    } catch (err: any) {
      setError(err?.message || "Não foi possível comparar os fundos.");
    } finally {
      setLoading(false);
    }
  }

  const comparison = payload?.comparison;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-indigo-700"><ArrowLeft size={17} /> Voltar</Link>
        <header className="mt-5 rounded-3xl bg-slate-950 p-6 text-white shadow-xl md:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-indigo-300">Comparador regulatório</p>
          <h1 className="mt-3 text-3xl font-black md:text-5xl">Compare fundos por evidências oficiais</h1>
          <p className="mt-4 max-w-3xl leading-7 text-slate-300">Use de dois a cinco tickers. Dimensões sem fonte confiável ficam fora da comparação.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <input value={input} onChange={(event) => setInput(event.target.value)} className="flex-1 rounded-xl border border-slate-700 bg-slate-900 p-3 font-bold text-white outline-none focus:border-indigo-400" />
            <button type="button" onClick={compare} disabled={loading || tickers.length < 2} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-extrabold hover:bg-indigo-500 disabled:opacity-40">{loading ? <Loader2 className="animate-spin" size={18} /> : <Scale size={18} />} Comparar</button>
          </div>
        </header>

        {error && <section className="mt-5 rounded-2xl bg-amber-50 p-5 text-amber-900 ring-1 ring-amber-200"><p className="font-bold">{error}</p>{requiresLogin && <Link href="/carteira" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-2 text-sm font-extrabold text-white"><LockKeyhole size={16} /> Confirmar e-mail</Link>}</section>}

        {comparison && (
          <div className="mt-6 space-y-5">
            <section className="grid gap-4 md:grid-cols-3">
              <Highlight title="Líder geral" item={comparison.highlights?.overallLeader} />
              <Highlight title="Melhor qualidade de dados" item={comparison.highlights?.dataQualityLeader} />
              <Highlight title="Menor risco observado" item={comparison.highlights?.lowerObservedRisk} />
            </section>

            <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600"><tr><th className="p-4">Dimensão</th>{comparison.funds.map((fund: any) => <th key={fund.ticker} className="p-4">{fund.ticker}</th>)}</tr></thead>
                  <tbody>{comparison.dimensions.map((dimension: any) => <tr key={dimension.key} className="border-t border-slate-200"><td className="p-4 font-black">{dimension.label}</td>{dimension.values.map((item: any) => <td key={item.ticker} className={`p-4 ${dimension.winner?.ticker === item.ticker ? "bg-emerald-50 font-black text-emerald-800" : ""}`}>{item.assessed ? number(item.value) : "Não avaliado"}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </section>

            <div className="flex flex-wrap gap-3">{comparison.funds.map((fund: any) => <Link key={fund.ticker} href={`/fii/${fund.ticker}/relatorio`} className="rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-indigo-800 ring-1 ring-indigo-200">Abrir {fund.ticker}</Link>)}</div>
          </div>
        )}
      </div>
    </main>
  );
}

function Highlight({ title, item }: { title: string; item: any }) {
  const label = item?.ticker || (item?.ties?.length ? `Empate: ${item.ties.join(", ")}` : "Não avaliado");
  return <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-slate-500"><Trophy size={16} className="text-amber-500" /> {title}</p><p className="mt-3 text-xl font-black">{label}</p>{item?.value !== undefined && item?.value !== null && <p className="mt-1 text-sm font-bold text-indigo-700">Nota {number(item.value)}</p>}</div>;
}
