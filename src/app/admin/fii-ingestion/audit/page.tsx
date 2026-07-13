'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleDashed, FileSearch, Loader2 } from "lucide-react";
import PageHeader from "../../../components/PageHeader";

export default function IngestionAuditPage() {
  const [runId, setRunId] = useState("");
  const [payload, setPayload] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("runId") || "";
    setRunId(value);
    if (value) load(value);
  }, []);

  async function load(explicitRunId?: string) {
    const selected = String(explicitRunId || runId).trim();
    if (!selected) return;
    setLoading(true);
    setError("");
    setPayload(null);
    try {
      const response = await fetch(`/api/admin/fii-ingestion/audit?runId=${encodeURIComponent(selected)}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || "Não foi possível carregar a auditoria.");
      setPayload(json);
    } catch (err: any) {
      setError(err?.message || "Não foi possível carregar a auditoria.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader title="Trilha de auditoria" subtitle="Rastreabilidade completa de uma execução regulatória." backLabel="← Voltar ao dashboard" backHref="/admin/fii-ingestion/dashboard" />

      <section className="rounded-3xl bg-slate-950 p-5 text-white shadow-xl">
        <div className="flex flex-col gap-3 md:flex-row">
          <input value={runId} onChange={(event) => setRunId(event.target.value)} placeholder="Run ID" className="flex-1 rounded-xl border border-slate-700 bg-slate-900 p-3 outline-none focus:border-indigo-400" />
          <button onClick={() => load()} disabled={loading || !runId.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-extrabold disabled:opacity-40">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <FileSearch size={18} />} Auditar execução
          </button>
        </div>
      </section>

      {error && <p className="mt-5 rounded-2xl bg-red-50 p-5 font-bold text-red-800 ring-1 ring-red-200">{error}</p>}

      {payload && (
        <div className="mt-6 space-y-6">
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h1 className="text-2xl font-black">{payload.ticker || "Execução"}</h1>
            <p className="mt-1 break-all font-mono text-xs text-slate-500">{payload.runId}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Metric label="Competências em staging" value={payload.counts?.monthlySnapshots} />
              <Metric label="Documentos em staging" value={payload.counts?.documents} />
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black">Fluxo completo</h2>
            <div className="mt-5 space-y-3">
              {(payload.timeline || []).map((item: any) => (
                <div key={item.step} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  {item.exists ? <CheckCircle2 className="mt-0.5 text-emerald-600" size={19} /> : <CircleDashed className="mt-0.5 text-slate-400" size={19} />}
                  <div className="min-w-0 flex-1">
                    <p className="font-black">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.status || (item.exists ? "Disponível" : "Ainda não executado")}</p>
                    {item.at && <p className="mt-1 text-xs text-slate-400">{String(item.at)}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black">Documentos de controle</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {Object.entries(payload.records || {}).map(([key, record]: any) => (
                <div key={key} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{key}</p>
                  <p className="mt-2 break-all font-mono text-xs text-slate-700">{record.document}</p>
                  <p className={`mt-2 text-sm font-bold ${record.exists ? "text-emerald-700" : "text-slate-500"}`}>{record.exists ? "Encontrado" : "Ausente"}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl bg-slate-950 p-6 text-white">
            <h2 className="text-xl font-black">Evidências de origem</h2>
            <p className="mt-2 text-sm text-slate-300">Amostra limitada aos primeiros 10 registros de cada grupo.</p>
            <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-black/30 p-4 text-xs leading-5 text-slate-200">{JSON.stringify(payload.sourceEvidence, null, 2)}</pre>
          </section>

          {payload.ticker && <Link href={`/fii/${payload.ticker}/relatorio`} className="inline-flex rounded-xl bg-indigo-600 px-5 py-3 font-extrabold text-white">Abrir relatório do fundo</Link>}
        </div>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-3xl font-black">{String(value ?? 0)}</p></div>;
}
