"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Beaker,
  ExternalLink,
  FileSearch,
  History,
  Loader2,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";
import type { AlertLevel } from "@/types/riskLab";
import type { RiskLabAdminStatus, RiskLabReport } from "@/types/riskLabProduction";

type StatusResponse = { ok: true; status: RiskLabAdminStatus } | { ok: false; error: string };
type GenerateResponse = { ok: true; report: RiskLabReport } | { ok: false; error: string };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const payload = await response.json().catch(() => ({ ok: false, error: "Resposta inválida do servidor." }));
  if (!response.ok) throw new Error(String(payload?.error || `Falha HTTP ${response.status}`));
  return payload as T;
}

function dateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("pt-BR") : value;
}

function alertStyle(alert: AlertLevel) {
  if (alert === "red") return "bg-red-600 text-white ring-red-700";
  if (alert === "orange") return "bg-orange-100 text-orange-900 ring-orange-300";
  if (alert === "yellow") return "bg-amber-100 text-amber-900 ring-amber-300";
  if (alert === "green") return "bg-emerald-100 text-emerald-900 ring-emerald-300";
  return "bg-slate-100 text-slate-700 ring-slate-300";
}

export default function RiskLabAdminPage() {
  const [status, setStatus] = useState<RiskLabAdminStatus | null>(null);
  const [report, setReport] = useState<RiskLabReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function loadStatus() {
    setLoading(true);
    setError("");
    try {
      const response = await requestJson<StatusResponse>("/api/admin/system/risk-lab");
      if (!response.ok) throw new Error(response.error);
      setStatus(response.status);
      setReport(response.status.latestReport);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar o Risk Lab.");
    } finally {
      setLoading(false);
    }
  }

  async function generateReport() {
    setRunning(true);
    setError("");
    try {
      const response = await requestJson<GenerateResponse>("/api/admin/system/risk-lab", {
        method: "POST",
        body: JSON.stringify({ action: "generate", ticker: "HCTR11" }),
      });
      if (!response.ok) throw new Error(response.error);
      setReport(response.report);
      await loadStatus();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível gerar o relatório.");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-3xl bg-gradient-to-br from-slate-950 to-red-950 p-6 text-white shadow-lg md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-red-200"><Beaker size={15} /> Laboratório administrativo</p>
              <h1 className="mt-3 text-3xl font-black md:text-5xl">Risk Lab unitário</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">Executa o marco histórico validado do HCTR11 com regras determinísticas e evidências primárias.</p>
            </div>
            <Link href="/admin/sistema" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-slate-900"><ArrowLeft size={16} /> Voltar ao Admin</Link>
          </div>
        </header>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-950 ring-1 ring-amber-200"><AlertTriangle className="mr-2 inline" size={18} /> Não está integrado ao Relatório Premium.</div>
          <div className="rounded-2xl bg-indigo-50 p-4 text-sm font-bold text-indigo-950 ring-1 ring-indigo-200"><ShieldCheck className="mr-2 inline" size={18} /> Não envia notificações nem altera dados públicos.</div>
        </div>

        {error && (
          <section className="mt-5 rounded-2xl bg-red-50 p-5 text-red-900 ring-1 ring-red-200">
            <p className="font-black">Não foi possível executar</p>
            <p className="mt-1 text-sm">{error}</p>
            {/autoriz|sessão|login|401/i.test(error) && <Link href="/admin/sistema" className="mt-3 inline-flex rounded-full bg-red-700 px-4 py-2 text-sm font-extrabold text-white">Entrar no Admin</Link>}
          </section>
        )}

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-red-700">Execução permitida</p>
              <h2 className="mt-2 text-3xl font-black text-slate-900">HCTR11 · 12/12/2024</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Um clique carrega somente o dataset ouro aprovado, aplica o motor v0.1.0, salva o relatório e registra a auditoria.</p>
            </div>
            <button
              type="button"
              onClick={generateReport}
              disabled={loading || running || !status?.enabled || !status?.supportedTickers.includes("HCTR11")}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-red-700 px-6 py-3 text-sm font-extrabold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              {running ? <Loader2 size={18} className="animate-spin" /> : <PlayCircle size={18} />}
              {running ? "Gerando e auditando…" : "Gerar relatório de risco"}
            </button>
          </div>

          {loading ? (
            <p className="mt-5 flex items-center gap-2 text-sm font-bold text-slate-500"><Loader2 className="animate-spin" size={17} /> Conferindo autorização e histórico…</p>
          ) : status ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Small label="Feature" value={status.enabled ? "Ativa" : "Desativada"} />
              <Small label="Dataset" value={`${status.dataset.id} · v${status.dataset.version}`} />
              <Small label="Qualidade" value={status.dataset.approved ? "Gold aprovado" : "Bloqueado"} />
              <Small label="Escopo" value={status.dataset.scope || "-"} />
            </div>
          ) : null}
        </section>

        {report && (
          <>
            <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Resultado persistido</p>
                  <h2 className="mt-2 text-3xl font-black text-slate-900">{report.ticker}</h2>
                  <p className="mt-1 text-sm text-slate-600">Gerado em {dateTime(report.generatedAt)} por {report.generatedBy}</p>
                </div>
                <span className={`rounded-full px-5 py-2 text-sm font-black uppercase ring-1 ${alertStyle(report.assessment.prudentialAlert)}`}>{report.assessment.prudentialAlert}</span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Small label="Deterioração" value={report.assessment.deteriorationAlert.toUpperCase()} />
                <Small label="Risco estrutural" value={report.assessment.structuralRisk} />
                <Small label="Confiança" value={`${report.assessment.confidence}%`} />
                <Small label="Score" value={`${report.assessment.deteriorationScore}/100`} />
              </div>

              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <article className="rounded-2xl bg-red-50 p-5 ring-1 ring-red-100">
                  <h3 className="flex items-center gap-2 font-black text-red-900"><FileSearch size={18} /> Regras acionadas</h3>
                  <div className="mt-3 space-y-3">{report.assessment.hits.map((hit) => <div key={hit.ruleId} className="rounded-xl bg-white p-3 text-sm ring-1 ring-red-100"><p className="font-black text-slate-900">{hit.ruleId} · {hit.title}</p><p className="mt-1 text-slate-700">{hit.message}</p><p className="mt-1 text-xs font-bold text-slate-500">Confiança {hit.confidence}%</p></div>)}</div>
                </article>

                <article className="rounded-2xl bg-indigo-50 p-5 ring-1 ring-indigo-100">
                  <h3 className="flex items-center gap-2 font-black text-indigo-950"><ShieldCheck size={18} /> Evidências primárias</h3>
                  <div className="mt-3 space-y-3">{report.evidence.map((item) => <div key={`${item.metric}-${item.documentId}`} className="rounded-xl bg-white p-3 text-sm ring-1 ring-indigo-100"><p className="font-black text-slate-900">{item.metric}: {String(item.value)} {item.unit || ""}</p><p className="mt-1 text-slate-700">Página {item.page}: {item.excerpt}</p><a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-extrabold text-indigo-700">Abrir fonte oficial <ExternalLink size={13} /></a></div>)}</div>
                </article>
              </div>
            </section>

            <section className="mt-6 rounded-3xl bg-slate-950 p-6 text-slate-100 shadow-sm">
              <h2 className="text-xl font-black">Relatório autônomo</h2>
              <pre className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">{report.reportMarkdown}</pre>
            </section>
          </>
        )}

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="flex items-center gap-2 text-2xl font-black text-slate-900"><History className="text-indigo-700" /> Histórico recente</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Fundo</th><th className="px-4 py-3">Alerta</th><th className="px-4 py-3">Confiança</th><th className="px-4 py-3">Dataset</th><th className="px-4 py-3">Responsável</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{(status?.recentReports || []).map((item) => <tr key={item.id}><td className="px-4 py-3">{dateTime(item.generatedAt)}</td><td className="px-4 py-3 font-black">{item.ticker}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ring-1 ${alertStyle(item.prudentialAlert)}`}>{item.prudentialAlert}</span></td><td className="px-4 py-3">{item.confidence}%</td><td className="px-4 py-3">v{item.datasetVersion}</td><td className="px-4 py-3">{item.generatedBy}</td></tr>)}{!status?.recentReports.length && <tr><td colSpan={6} className="px-4 py-8 text-center font-bold text-slate-500">Nenhuma execução persistida.</td></tr>}</tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Small({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-black text-slate-900">{value}</p></div>;
}
