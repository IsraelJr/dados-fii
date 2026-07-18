"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FlaskConical,
  Loader2,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";
import type {
  DividendStressRunResult,
  DividendStressRunStatus,
  DividendStressRunTicker,
} from "@/types/riskLabDividendStressRun";

type StatusResponse =
  | { ok: true; enabled: boolean; statuses: DividendStressRunStatus[] }
  | { ok: false; error: string };

type ExecuteResponse =
  | { ok: true; result: DividendStressRunResult }
  | { ok: false; error: string };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const payload = await response.json().catch(() => ({ ok: false, error: "Resposta inválida do servidor." }));
  if (!response.ok) throw new Error(String(payload?.error || `Falha HTTP ${response.status}`));
  return payload as T;
}

function dateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString("pt-BR") : value;
}

function resultLabel(value?: string | null) {
  if (value === "reversible_stress_confirmed") return "Estresse reversível matemático";
  if (value === "stress_without_recovery") return "Estresse sem recuperação";
  if (value === "recovery_blocked_by_material_credit_event") {
    return "Recuperação bloqueada por evento de crédito";
  }
  if (value === "no_qualifying_stress") return "Sem estresse qualificável";
  return "Sem execução";
}

function statusStyle(value?: string | null) {
  if (value === "reversible_stress_confirmed") return "bg-amber-100 text-amber-950 ring-amber-300";
  if (value === "stress_without_recovery" || value === "recovery_blocked_by_material_credit_event") {
    return "bg-red-100 text-red-950 ring-red-300";
  }
  if (value === "no_qualifying_stress") return "bg-emerald-100 text-emerald-950 ring-emerald-300";
  return "bg-slate-100 text-slate-700 ring-slate-300";
}

export default function DividendStressRunPanel() {
  const [enabled, setEnabled] = useState(false);
  const [statuses, setStatuses] = useState<DividendStressRunStatus[]>([]);
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busyTicker, setBusyTicker] = useState<DividendStressRunTicker | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await requestJson<StatusResponse>("/api/admin/system/risk-lab/stress-runs");
      if (!response.ok) throw new Error(response.error);
      setEnabled(response.enabled);
      setStatuses(response.statuses);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar as execuções manuais.");
    } finally {
      setLoading(false);
    }
  }

  async function execute(ticker: DividendStressRunTicker) {
    setBusyTicker(ticker);
    setError("");
    setMessage("");
    try {
      const response = await requestJson<ExecuteResponse>("/api/admin/system/risk-lab/stress-runs", {
        method: "POST",
        body: JSON.stringify({ action: "execute", ticker, confirmed: true }),
      });
      if (!response.ok) throw new Error(response.error);
      setMessage(
        response.result.created
          ? `${ticker}: execução manual criada e auditada.`
          : `${ticker}: o mesmo snapshot já havia sido executado; nenhum registro duplicado foi criado.`,
      );
      setConfirmations((current) => ({ ...current, [ticker]: false }));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível executar o detector.");
    } finally {
      setBusyTicker(null);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-violet-700">
            <FlaskConical size={16} /> Execução controlada
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">Detector de estresse de dividendos</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Executa o ruleset congelado somente sobre competências aprovadas. O resultado é preliminar até a revisão dos eventos materiais de crédito e não produz efeitos externos.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${enabled ? "bg-emerald-100 text-emerald-900 ring-emerald-300" : "bg-slate-100 text-slate-700 ring-slate-300"}`}>
          {enabled ? "Execução habilitada" : "Feature desativada"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Notice icon={<ShieldCheck size={17} />} text="Não cria alertas nem notificações." />
        <Notice icon={<ShieldCheck size={17} />} text="Não altera o Relatório Premium." />
        <Notice icon={<AlertTriangle size={17} />} text="Classificação sempre preliminar nesta etapa." warning />
      </div>

      {error && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-900 ring-1 ring-red-200">{error}</p>}
      {message && <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900 ring-1 ring-emerald-200">{message}</p>}
      {loading && <p className="mt-5 flex items-center gap-2 text-sm font-bold text-slate-500"><Loader2 className="animate-spin" size={17} /> Carregando prontidão e histórico…</p>}

      {!loading && (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {statuses.map((status) => {
            const ready = status.readiness.readyForStressDetection;
            const confirmed = Boolean(confirmations[status.ticker]);
            const latest = status.latestRun;
            const busy = busyTicker === status.ticker;
            return (
              <article key={status.ticker} className="rounded-2xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Série aprovada</p>
                    <h3 className="mt-1 text-2xl font-black text-slate-900">{status.ticker}</h3>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${ready ? "bg-emerald-100 text-emerald-900 ring-emerald-300" : "bg-amber-100 text-amber-900 ring-amber-300"}`}>
                    {ready ? "Série suficiente" : "Coleta incompleta"}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Small label="Aprovados" value={status.readiness.approvedObservations} />
                  <Small label="Maior sequência" value={`${status.readiness.longestContiguousCount}/${status.readiness.requiredContiguousCount}`} />
                  <Small label="Primeira competência" value={status.readiness.firstCompetence || "-"} />
                  <Small label="Última competência" value={status.readiness.lastCompetence || "-"} />
                </div>

                <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600 ring-1 ring-slate-200">
                  <strong>Meses ausentes:</strong> {status.readiness.missingMonths.length ? status.readiness.missingMonths.join(", ") : "nenhum dentro do intervalo aprovado"}.
                </div>

                {latest ? (
                  <div className="mt-4 rounded-2xl bg-violet-50 p-4 ring-1 ring-violet-100">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-sm font-black text-violet-950"><Clock3 size={16} /> Última execução</p>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${statusStyle(latest.result.status)}`}>
                        {resultLabel(latest.result.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-violet-900">{dateTime(latest.executedAt)} · {latest.executedBy}</p>
                    <p className="mt-1 break-all font-mono text-[10px] leading-4 text-violet-800">{latest.rulesetVersion} · {latest.inputHash}</p>
                    <p className="mt-2 text-xs font-bold text-amber-900">Resultado preliminar: eventos materiais de crédito ainda não revisados.</p>
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500 ring-1 ring-slate-200">Nenhuma execução persistida para este fundo.</p>
                )}

                <label className="mt-4 flex items-start gap-3 text-sm font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmations((current) => ({ ...current, [status.ticker]: event.target.checked }))}
                    className="mt-1 h-4 w-4"
                  />
                  Confirmo que esta ação apenas grava um resultado preliminar, sem alertas, notificações ou alteração do Premium.
                </label>

                <button
                  type="button"
                  disabled={!enabled || !ready || !confirmed || busy}
                  onClick={() => void execute(status.ticker)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? <Loader2 className="animate-spin" size={17} /> : latest ? <PlayCircle size={17} /> : <CheckCircle2 size={17} />}
                  {busy ? "Executando e auditando…" : "Executar detector manualmente"}
                </button>
              </article>
            );
          })}
          {!statuses.length && <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500 lg:col-span-2">Nenhum status retornado.</p>}
        </div>
      )}
    </section>
  );
}

function Notice({ icon, text, warning = false }: { icon: ReactNode; text: string; warning?: boolean }) {
  return <div className={`flex items-center gap-2 rounded-2xl p-3 text-sm font-bold ring-1 ${warning ? "bg-amber-50 text-amber-950 ring-amber-200" : "bg-emerald-50 text-emerald-950 ring-emerald-200"}`}>{icon}<span>{text}</span></div>;
}

function Small({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200"><p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-black text-slate-900">{value}</p></div>;
}
