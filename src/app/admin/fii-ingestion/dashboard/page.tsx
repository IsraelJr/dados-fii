'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BarChart3, CheckCircle2, Database, FileText, Loader2, ShieldCheck } from "lucide-react";
import PageHeader from "../../../components/PageHeader";

type DashboardPayload = Record<string, any> | null;

export default function RegulatoryDashboardPage() {
  const [payload, setPayload] = useState<DashboardPayload>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/admin/fii-ingestion/dashboard", { cache: "no-store", credentials: "same-origin" });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json?.error || "Não foi possível carregar o dashboard.");
        if (active) setPayload(json);
      } catch (err: any) {
        if (active) setError(err?.message || "Não foi possível carregar o dashboard.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const summary = payload?.summary || {};
  const funds = Array.isArray(payload?.funds) ? payload.funds : [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader title="Dashboard regulatório" subtitle="Cobertura, publicação, histórico e pendências do pipeline." backLabel="← Voltar à ingestão" backHref="/admin/fii-ingestion" />

      {loading && <div className="flex items-center justify-center gap-3 rounded-3xl bg-slate-950 p-10 text-white"><Loader2 className="animate-spin" /> Carregando indicadores...</div>}
      {error && <div className="rounded-2xl bg-red-50 p-5 text-red-800 ring-1 ring-red-200">{error}</div>}

      {!loading && !error && payload && (
        <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric icon={<Database />} label="Fundos operacionais" value={summary.operationalFunds} />
            <Metric icon={<CheckCircle2 />} label="Publicados" value={summary.publishedFunds} />
            <Metric icon={<BarChart3 />} label="Competências" value={summary.totalMonthlySnapshots} />
            <Metric icon={<FileText />} label="Documentos" value={summary.totalDocuments} />
          </section>

          <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-100 text-slate-600"><tr><th className="p-4">Fundo</th><th className="p-4">Tipo</th><th className="p-4">Publicação</th><th className="p-4">Anos</th><th className="p-4">Competências</th><th className="p-4">Documentos</th><th className="p-4">QA</th><th className="p-4">Último run</th></tr></thead>
                <tbody>{funds.map((fund: any) => <tr key={fund.ticker} className="border-t border-slate-200"><td className="p-4 font-black"><Link href={`/fii/${fund.ticker}/relatorio`} className="text-indigo-700">{fund.ticker}</Link></td><td className="p-4">{fund.fundType}</td><td className="p-4">{fund.published ? <span className="inline-flex items-center gap-1 font-bold text-emerald-700"><CheckCircle2 size={15} /> Publicado</span> : <span className="inline-flex items-center gap-1 font-bold text-amber-700"><AlertTriangle size={15} /> Pendente</span>}</td><td className="p-4">{fund.referenceYears?.join(", ") || "—"}</td><td className="p-4">{fund.monthlySnapshots}</td><td className="p-4">{fund.documents}</td><td className="p-4">{fund.qaScore ?? "—"}</td><td className="p-4">{fund.latestRun?.status || "—"}</td></tr>)}</tbody>
              </table>
            </div>
          </section>

          {!!payload.blockedFunds?.length && <section className="rounded-3xl bg-amber-50 p-6 ring-1 ring-amber-200"><h2 className="flex items-center gap-2 text-lg font-black text-amber-950"><ShieldCheck size={19} /> Famílias bloqueadas</h2><div className="mt-3 space-y-2">{payload.blockedFunds.map((fund: any) => <p key={fund.ticker} className="text-sm text-amber-900"><strong>{fund.ticker} · {fund.fundType}:</strong> {fund.reason}</p>)}</div></section>}
        </div>
      )}
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: unknown }) {
  return <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm"><div className="flex items-center gap-2 text-indigo-300">{icon}<span className="text-xs font-extrabold uppercase tracking-wide">{label}</span></div><div className="mt-3 text-3xl font-black">{String(value ?? 0)}</div></div>;
}
