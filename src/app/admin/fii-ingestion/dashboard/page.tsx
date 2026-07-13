'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, BarChart3, CheckCircle2, Database, FileSearch, FileText, Loader2, ShieldCheck } from "lucide-react";
import PageHeader from "../../../components/PageHeader";

type DashboardPayload = Record<string, any> | null;

function healthTone(status: string) {
  if (status === "healthy") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (status === "degraded") return "bg-red-50 text-red-800 ring-red-200";
  return "bg-amber-50 text-amber-800 ring-amber-200";
}

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
  const adapters = Array.isArray(payload?.adapterHealth) ? payload.adapterHealth : [];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <PageHeader title="Dashboard regulatório" subtitle="Cobertura, publicação, adaptadores, validação pós-publicação e auditoria." backLabel="← Voltar à ingestão" backHref="/admin/fii-ingestion" />

      {loading && <div className="flex items-center justify-center gap-3 rounded-3xl bg-slate-950 p-10 text-white"><Loader2 className="animate-spin" /> Carregando indicadores...</div>}
      {error && <div className="rounded-2xl bg-red-50 p-5 text-red-800 ring-1 ring-red-200">{error}</div>}

      {!loading && !error && payload && (
        <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <Metric icon={<Database />} label="Fundos operacionais" value={summary.operationalFunds} />
            <Metric icon={<CheckCircle2 />} label="Publicados" value={summary.publishedFunds} />
            <Metric icon={<BarChart3 />} label="Competências" value={summary.totalMonthlySnapshots} />
            <Metric icon={<FileText />} label="Documentos" value={summary.totalDocuments} />
            <Metric icon={<ShieldCheck />} label="Pós-publicação OK" value={summary.postPublicationValidated} />
            <Metric icon={<Activity />} label="Adaptadores degradados" value={summary.adaptersDegraded} />
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-extrabold uppercase tracking-wide text-indigo-600">Infraestrutura</p><h2 className="mt-1 text-2xl font-black">Saúde dos adaptadores</h2></div>
              <Link href="/api/admin/fii-ingestion/adapter-health" className="text-sm font-bold text-indigo-700">Abrir JSON</Link>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {adapters.map((adapter: any) => (
                <div key={adapter.adapterId} className={`rounded-2xl p-5 ring-1 ${healthTone(adapter.status)}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-black">{adapter.adapterId}</p><p className="mt-1 text-xs font-bold uppercase tracking-wide">{adapter.status}</p></div>
                    <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-extrabold">{adapter.successRate}% sucesso</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><p><strong>Runs:</strong> {adapter.runsAnalyzed}</p><p><strong>Falhas seguidas:</strong> {adapter.consecutiveFailures}</p><p><strong>QA médio:</strong> {adapter.averageQaScore ?? "—"}</p><p><strong>Cobertura:</strong> {adapter.averageCoverage ?? "—"}</p></div>
                  {!!adapter.latestRun?.error && <p className="mt-3 text-xs font-bold">Último erro: {adapter.latestRun.error}</p>}
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px] text-left text-sm">
                <thead className="bg-slate-100 text-slate-600"><tr><th className="p-4">Fundo</th><th className="p-4">Adaptador</th><th className="p-4">Publicação</th><th className="p-4">Pós-publicação</th><th className="p-4">Anos</th><th className="p-4">Competências</th><th className="p-4">Documentos</th><th className="p-4">QA</th><th className="p-4">Último run</th><th className="p-4">Auditoria</th></tr></thead>
                <tbody>{funds.map((fund: any) => <tr key={fund.ticker} className="border-t border-slate-200">
                  <td className="p-4 font-black"><Link href={`/fii/${fund.ticker}/relatorio`} className="text-indigo-700">{fund.ticker}</Link><p className="mt-1 text-xs font-medium text-slate-500">{fund.fundType}</p></td>
                  <td className="p-4 font-mono text-xs">{fund.adapterId}</td>
                  <td className="p-4">{fund.published ? <span className="inline-flex items-center gap-1 font-bold text-emerald-700"><CheckCircle2 size={15} /> {fund.publication?.status || "Publicado"}</span> : <span className="inline-flex items-center gap-1 font-bold text-amber-700"><AlertTriangle size={15} /> Pendente</span>}</td>
                  <td className="p-4">{fund.postPublicationValidation ? <span className={`font-bold ${fund.postPublicationValidation.verdict === "passed" ? "text-emerald-700" : "text-red-700"}`}>{fund.postPublicationValidation.verdict} {fund.postPublicationValidation.score ? `(${fund.postPublicationValidation.score})` : ""}</span> : "—"}</td>
                  <td className="p-4">{fund.referenceYears?.join(", ") || "—"}</td><td className="p-4">{fund.monthlySnapshots}</td><td className="p-4">{fund.documents}</td><td className="p-4">{fund.qaScore ?? "—"}</td>
                  <td className="p-4"><p className="font-bold">{fund.latestRun?.status || "—"}</p><p className="mt-1 max-w-56 truncate text-xs text-slate-500">{fund.latestRun?.runId || ""}</p></td>
                  <td className="p-4">{fund.latestRun?.runId ? <Link href={`/admin/fii-ingestion/audit?runId=${encodeURIComponent(fund.latestRun.runId)}`} className="inline-flex items-center gap-1 font-bold text-indigo-700"><FileSearch size={15} /> Abrir</Link> : "—"}</td>
                </tr>)}</tbody>
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
