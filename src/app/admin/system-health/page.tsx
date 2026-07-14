'use client';

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, History, Loader2, Play, XCircle } from "lucide-react";
import PageHeader from "../../components/PageHeader";

type Check = {
  id: string;
  title: string;
  level: "pass" | "warn" | "fail";
  detail: string;
  weight: number;
};

type Report = {
  runId: string;
  status: "healthy" | "attention" | "degraded";
  score: number;
  generatedAt: string;
  summary: { pass: number; warn: number; fail: number };
  checks: Check[];
  recommendations: string[];
};

async function parseResponse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || "Falha na operação.");
  return body;
}

function formatDate(value?: string | null) {
  if (!value) return "Ainda não executada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status?: string) {
  if (status === "healthy") return "Saudável";
  if (status === "attention") return "Atenção";
  if (status === "degraded") return "Degradado";
  return "Desconhecido";
}

function CheckIcon({ level }: { level: Check["level"] }) {
  if (level === "pass") return <CheckCircle2 className="text-emerald-600" size={20} />;
  if (level === "warn") return <AlertTriangle className="text-amber-600" size={20} />;
  return <XCircle className="text-red-600" size={20} />;
}

export default function SystemHealthPage() {
  const [latest, setLatest] = useState<Report | null>(null);
  const [history, setHistory] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/admin/system/validation-history?limit=10", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const body = await parseResponse(response);
      const items = Array.isArray(body.history) ? body.history : [];
      setHistory(items);
      setLatest(items[0] || null);
    } catch (err: any) {
      setError(err.message || "Falha ao carregar validações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runValidation() {
    setRunning(true);
    setError("");
    try {
      const response = await fetch("/api/admin/system/run-validation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ persist: true }),
      });
      const body = await parseResponse(response);
      setLatest(body.report);
      await load();
    } catch (err: any) {
      setError(err.message || "Falha ao executar validação.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title="Saúde do Sistema"
        subtitle="Validação operacional da infraestrutura regulatória, segurança e dados publicados."
        backLabel="← Voltar ao Admin"
        backHref="/admin"
        action={(
          <button
            type="button"
            onClick={runValidation}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {running ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
            Executar validação
          </button>
        )}
      />

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center gap-3 text-slate-600">
          <Loader2 className="animate-spin" /> Carregando saúde do sistema…
        </div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl bg-slate-950 p-6 text-white md:col-span-2">
              <div className="flex items-center gap-3 text-indigo-300">
                <Activity size={24} />
                <span className="text-sm font-extrabold uppercase tracking-wider">Health Score</span>
              </div>
              <div className="mt-4 flex items-end gap-3">
                <strong className="text-6xl font-black">{latest?.score ?? "—"}</strong>
                <span className="pb-2 text-lg font-bold text-slate-400">/100</span>
              </div>
              <p className="mt-3 text-lg font-extrabold">{statusLabel(latest?.status)}</p>
              <p className="mt-1 text-sm text-slate-400">Última validação: {formatDate(latest?.generatedAt)}</p>
            </div>

            <MetricCard label="Aprovados" value={latest?.summary?.pass ?? 0} tone="emerald" />
            <MetricCard label="Alertas / falhas" value={(latest?.summary?.warn ?? 0) + (latest?.summary?.fail ?? 0)} tone="amber" />
          </section>

          <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black text-slate-900">Checks operacionais</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {(latest?.checks || []).map((item) => (
                <div key={item.id} className="flex gap-4 py-4">
                  <CheckIcon level={item.level} />
                  <div>
                    <h3 className="font-extrabold text-slate-900">{item.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                  </div>
                </div>
              ))}
              {!latest && <p className="py-8 text-center text-slate-500">Execute a primeira validação para gerar o diagnóstico.</p>}
            </div>
          </section>

          <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-3">
              <History className="text-indigo-600" />
              <h2 className="text-xl font-black text-slate-900">Histórico recente</h2>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Data</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Score</th>
                    <th className="px-3 py-3">Pass</th>
                    <th className="px-3 py-3">Warn</th>
                    <th className="px-3 py-3">Fail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((item) => (
                    <tr key={item.runId}>
                      <td className="px-3 py-3 font-semibold text-slate-700">{formatDate(item.generatedAt)}</td>
                      <td className="px-3 py-3 font-bold text-slate-900">{statusLabel(item.status)}</td>
                      <td className="px-3 py-3 font-black text-indigo-700">{item.score}</td>
                      <td className="px-3 py-3 text-emerald-700">{item.summary?.pass ?? 0}</td>
                      <td className="px-3 py-3 text-amber-700">{item.summary?.warn ?? 0}</td>
                      <td className="px-3 py-3 text-red-700">{item.summary?.fail ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" }) {
  const classes = tone === "emerald"
    ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
    : "bg-amber-50 text-amber-900 ring-amber-200";
  return (
    <div className={`rounded-3xl p-6 ring-1 ${classes}`}>
      <p className="text-sm font-extrabold uppercase tracking-wide opacity-70">{label}</p>
      <strong className="mt-4 block text-5xl font-black">{value}</strong>
    </div>
  );
}
