"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  executeSegmentedCohortBacktest,
  getCohortBacktestStatus,
} from "@/app/admin/risk-lab/cohortBacktestClient";
import type { PublicRiskLabCohortBacktestEvidence } from "@/types/riskLabCohortBacktest";

function dateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString("pt-BR") : value;
}

function shortSha(value?: string | null) {
  return value ? value.slice(0, 8) : "-";
}

function statusPresentation(status?: string | null) {
  if (status === "passed") return {
    label: "Aprovado",
    className: "bg-emerald-100 text-emerald-950 ring-emerald-300",
    icon: <CheckCircle2 size={16} />,
  };
  if (status === "failed") return {
    label: "Com blockers",
    className: "bg-red-100 text-red-950 ring-red-300",
    icon: <XCircle size={16} />,
  };
  if (status === "running") return {
    label: "Em execução",
    className: "bg-amber-100 text-amber-950 ring-amber-300",
    icon: <Loader2 className="animate-spin" size={16} />,
  };
  return {
    label: "Pendente",
    className: "bg-slate-100 text-slate-700 ring-slate-300",
    icon: <Clock3 size={16} />,
  };
}

export default function CohortBacktestPanel() {
  const [enabled, setEnabled] = useState(false);
  const [runId, setRunId] = useState("");
  const [releaseCommit, setReleaseCommit] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<PublicRiskLabCohortBacktestEvidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await getCohortBacktestStatus();
      if (!response.ok) {
        throw new Error(response.error || "Não foi possível carregar o status do backtest.");
      }
      setEnabled(response.enabled);
      setRunId(response.runId);
      setReleaseCommit(response.releaseCommit);
      setEvidence(response.evidence);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar a Sprint 3.5.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function execute() {
    setRunning(true);
    setError("");
    setMessage("");
    setProgressPercent(0);
    try {
      const response = await executeSegmentedCohortBacktest((label, completed, total) => {
        setProgress(label);
        setProgressPercent(Math.round(completed / total * 100));
      });
      if (!response.ok && response.evidence?.status !== "failed") {
        throw new Error(response.error || "Falha ao consolidar a execução segmentada.");
      }
      setEnabled(response.enabled);
      setRunId(response.runId);
      setReleaseCommit(response.releaseCommit);
      setEvidence(response.evidence);
      setMessage(
        response.evidence?.status === "passed"
          ? "Todos os gates metodológicos da Sprint 3.5 foram aprovados."
          : "A execução terminou e registrou blockers estruturados para correção.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível executar as pendências.");
      await load(true);
    } finally {
      setRunning(false);
      setProgress("");
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (evidence?.status !== "running" || running) return;
    const timer = window.setInterval(() => void load(true), 5_000);
    return () => window.clearInterval(timer);
  }, [evidence?.status, running]);

  const presentation = statusPresentation(evidence?.status);
  const metrics = evidence?.metrics;
  const releaseMatches = Boolean(
    evidence?.releaseCommit
      && releaseCommit
      && evidence.releaseCommit === releaseCommit,
  );

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-violet-700">
            <ShieldCheck size={16} /> Execução administrativa protegida
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">Pendências da Sprint 3.5</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Um clique executa e persiste os seis fundos em etapas independentes, verifica fontes
            primárias, look-ahead, cobertura e erros. Nenhum conteúdo técnico é aprovado manualmente.
          </p>
        </div>
        <span className={`inline-flex items-center gap-2 self-start rounded-full px-3 py-1 text-xs font-black ring-1 ${presentation.className}`}>
          {presentation.icon} {presentation.label}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Small label="Run" value={runId || "-"} />
        <Small label="Produção ativa" value={shortSha(releaseCommit)} />
        <Small label="Release da evidência" value={shortSha(evidence?.releaseCommit)} />
        <Small label="Release confere" value={releaseMatches ? "Sim" : "Ainda não"} />
      </div>

      {error && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-900 ring-1 ring-red-200">{error}</p>}
      {message && <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900 ring-1 ring-emerald-200">{message}</p>}
      {running && (
        <div className="mt-4 rounded-2xl bg-violet-50 p-4 ring-1 ring-violet-200">
          <p className="text-sm font-black text-violet-950">{progress || "Preparando execução…"}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-violet-100">
            <div className="h-full rounded-full bg-violet-700 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="mt-2 text-xs font-bold text-violet-700">{progressPercent}% · progresso já persistido no servidor</p>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={!enabled || loading || running}
          onClick={() => void execute()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-sm font-extrabold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running ? <Loader2 className="animate-spin" size={18} /> : <PlayCircle size={18} />}
          {running ? "Executando etapas…" : evidence?.status === "failed" ? "Executar novamente após correções" : "Executar pendências automaticamente"}
        </button>
        <button
          type="button"
          disabled={loading || running}
          onClick={() => void load()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-5 py-3 text-sm font-extrabold text-slate-800 ring-1 ring-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RefreshCw className={loading ? "animate-spin" : ""} size={17} /> Atualizar status
        </button>
      </div>

      {!enabled && !loading && (
        <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-950 ring-1 ring-amber-200">
          <AlertTriangle className="mr-2 inline" size={17} />
          O botão só fica ativo no deployment de Produção com um commit Git válido.
        </p>
      )}

      {loading && <p className="mt-5 flex items-center gap-2 text-sm font-bold text-slate-500"><Loader2 className="animate-spin" size={17} /> Carregando status e evidências…</p>}

      {!loading && metrics && (
        <div className="mt-6">
          <h3 className="text-lg font-black text-slate-900">Métricas da última execução</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Small label="Casos persistidos" value={`${evidence?.cases.length || 0}/6`} />
            <Small label="Casos conclusivos" value={`${metrics.conclusiveCases}/${metrics.totalCases}`} />
            <Small label="Cobertura" value={`${metrics.coveragePercent}%`} />
            <Small label="Falsos positivos" value={metrics.falsePositives} />
            <Small label="Falsos negativos" value={metrics.falseNegatives} />
            <Small label="Inconclusivos" value={metrics.inconclusiveCases} />
            <Small label="Checks aprovados" value={`${evidence?.checks.filter((item) => item.status === "passed").length || 0}/${evidence?.checks.length || 0}`} />
            <Small label="Conclusão" value={dateTime(evidence?.completedAt)} />
          </div>
        </div>
      )}

      {!loading && evidence?.cases.length ? (
        <div className="mt-6 overflow-x-auto rounded-2xl ring-1 ring-slate-200">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3">Fundo</th><th className="px-4 py-3">Papel</th><th className="px-4 py-3">Resultado</th><th className="px-4 py-3">Cobertura</th><th className="px-4 py-3">Fonte primária</th><th className="px-4 py-3">Look-ahead</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {evidence.cases.map((item) => <tr key={item.ticker}><td className="px-4 py-3 font-black text-slate-900">{item.ticker}</td><td className="px-4 py-3">{item.role}</td><td className="px-4 py-3">{item.outcome}</td><td className="px-4 py-3">{item.sourceCoveragePercent}%</td><td className="px-4 py-3">{item.primaryEvidenceComplete ? "Completa" : "Incompleta"}</td><td className="px-4 py-3">{item.lookAheadDetected ? "Detectado" : "Nenhum"}</td></tr>)}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && evidence?.blockers.length ? (
        <div className="mt-6 rounded-2xl bg-red-50 p-5 text-red-950 ring-1 ring-red-200">
          <h3 className="flex items-center gap-2 font-black"><AlertTriangle size={18} /> Blockers registrados</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6">{evidence.blockers.map((blocker, index) => <li key={`${index}-${blocker}`}>• {blocker}</li>)}</ul>
        </div>
      ) : null}
    </section>
  );
}

function Small({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200"><p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-black text-slate-900">{value}</p></div>;
}
