'use client';

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, BarChart3, CheckCircle2, Loader2, Scale, ShieldAlert, Trophy } from "lucide-react";

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
  const [payload, setPayload] = useState<ComparisonPayload>(null);
  const tickers = useMemo(() => formatTickerList(input), [input]);

  async function compare() {
    setLoading(true);
    setError("");
    setPayload(null);
    try {
      const response = await fetch(`/api/fii-regulatory-comparator?tickers=${encodeURIComponent(tickers.join(","))}`, {
        cache: "no-store",
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || "Não foi possível comparar os fundos.");
      setPayload(json);
    } catch (err: any) {
      setError(err?.message || "Não foi possível comparar os fundos.");
    } finally {
      setLoading(false);
    }
  }

  const comparison = payload?.comparison;
  const funds = comparison?.funds || [];
  const dimensions = comparison?.dimensions || [];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-indigo-700 hover:text-indigo-900">
          <ArrowLeft size={17} /> Voltar ao Dados FIIs
        </Link>

        <header className="mt-5 rounded-3xl bg-slate-950 p-6 text-white shadow-xl md:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-indigo-300">Comparador institucional</p>
          <h1 className="mt-3 text-3xl font-black md:text-5xl">Comparador regulatório de fundos</h1>
          <p className="mt-4 max-w-4xl text-base leading-7 text-slate-300">
            Compare de dois a cinco fundos usando exclusivamente dados regulatórios publicados e scores determinísticos. Dimensões sem fonte disponível ficam fora da disputa.
          </p>
        </header>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <label className="block text-sm font-extrabold text-slate-700">Tickers</label>
          <div className="mt-2 flex flex-col gap-3 md:flex-row">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="KNCA11, MXRF11, VGIA11"
              className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 font-bold uppercase outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={compare}
              disabled={loading || tickers.length < 2}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 font-extrabold text-white hover:bg-indigo-600 disabled:opacity-40"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Scale size={18} />}
              Comparar
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Selecionados: {tickers.join(", ") || "nenhum"}</p>
        </section>

        {error && (
          <div className="mt-5 rounded-2xl bg-red-50 p-5 font-bold text-red-800 ring-1 ring-red-200">{error}</div>
        )}

        {comparison && (
          <div className="mt-6 space-y-6">
            <section className="grid gap-4 md:grid-cols-3">
              <Highlight
                icon={<Trophy size={20} />}
                label="Líder geral"
                value={leaderLabel(comparison.highlights?.overallLeader)}
              />
              <Highlight
                icon={<CheckCircle2 size={20} />}
                label="Melhor qualidade de dados"
                value={leaderLabel(comparison.highlights?.dataQualityLeader)}
              />
              <Highlight
                icon={<ShieldAlert size={20} />}
                label="Menor risco observado"
                value={leaderLabel(comparison.highlights?.lowerObservedRisk)}
              />
            </section>

            <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="overflow-auto">
                <table className="min-w-[900px] w-full text-left text-sm">
                  <thead className="bg-slate-950 text-white">
                    <tr>
                      <th className="p-4">Dimensão</th>
                      {funds.map((fund: any) => (
                        <th key={fund.ticker} className="p-4">
                          <Link href={`/fii/${fund.ticker}/relatorio`} className="font-black text-indigo-200 hover:text-white">
                            {fund.ticker}
                          </Link>
                          <span className="mt-1 block text-xs font-medium text-slate-400">{fund.segment || fund.name || "—"}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dimensions.map((dimension: any) => (
                      <tr key={dimension.key} className="border-t border-slate-200">
                        <td className="p-4 font-black text-slate-800">{dimension.label}</td>
                        {funds.map((fund: any) => {
                          const item = dimension.values.find((entry: any) => entry.ticker === fund.ticker);
                          const winner = dimension.winner?.ticker === fund.ticker
                            || (!dimension.winner?.ticker && dimension.winner?.ties?.includes(fund.ticker));
                          return (
                            <td key={fund.ticker} className={`p-4 ${winner ? "bg-emerald-50" : ""}`}>
                              <span className="text-xl font-black">{item?.assessed ? number(item.value) : "—"}</span>
                              <span className="mt-1 block text-xs font-bold text-slate-500">
                                {item?.assessed ? (winner ? "Melhor resultado" : "Avaliado") : "Não avaliado"}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {!!payload?.unavailable?.length && (
              <section className="rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200">
                <h2 className="font-black text-amber-950">Fundos não incluídos</h2>
                <ul className="mt-2 space-y-1 text-sm text-amber-900">
                  {payload.unavailable.map((item: any) => <li key={item.ticker}>• {item.ticker}: relatório regulatório ainda indisponível.</li>)}
                </ul>
              </section>
            )}

            <section className="rounded-2xl bg-slate-100 p-5 text-sm leading-6 text-slate-600 ring-1 ring-slate-200">
              <div className="flex items-start gap-3">
                <BarChart3 className="mt-1 shrink-0 text-indigo-600" size={20} />
                <p>
                  A comparação usa o Score Engine v2. Risco utiliza “menor é melhor”; liquidez e outras dimensões sem fonte integrada não recebem nota. O resultado não constitui recomendação de investimento.
                </p>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function leaderLabel(value: any) {
  if (!value) return "Não avaliado";
  if (value.ticker) return `${value.ticker} · ${number(value.value)}`;
  if (value.ties?.length) return `Empate: ${value.ties.join(", ")}`;
  return "Não avaliado";
}

function Highlight({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-2 text-indigo-600">{icon}<span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</span></div>
      <div className="mt-3 text-xl font-black text-slate-900">{value}</div>
    </div>
  );
}
