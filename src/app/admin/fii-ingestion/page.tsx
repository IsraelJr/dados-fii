'use client';

import { useEffect, useMemo, useState } from "react";
import { Database, Loader2, Play, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import PageHeader from "../../components/PageHeader";
import {
  getIngestionFundConfig,
  listBlockedIngestionFunds,
  listOperationalIngestionFunds,
} from "@/lib/fiiIngestionConfig";

type ApiResult = Record<string, any> | null;

const RUN_STORAGE_KEY = "dados-fii-operational-ingestion-run";
const OPERATIONAL_FUNDS = listOperationalIngestionFunds();
const BLOCKED_FUNDS = listBlockedIngestionFunds();

async function readJson(response: Response) {
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.error || "Erro na operação.");
  return json;
}

export default function OperationalIngestionPage() {
  const [ticker, setTicker] = useState("MXRF11");
  const [cnpj, setCnpj] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [delayMinutes, setDelayMinutes] = useState("0");
  const [enableAi, setEnableAi] = useState(false);
  const [runId, setRunId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult>(null);
  const [error, setError] = useState("");

  const selectedFund = getIngestionFundConfig(ticker);
  const runStatus = String(result?.run?.status || result?.status || "");
  const finished = ["completed", "failed"].includes(runStatus);
  const qaUrl = useMemo(() => runId
    ? `/api/admin/fii-ingestion/operational-qa?runId=${encodeURIComponent(runId)}&persist=1`
    : "", [runId]);

  useEffect(() => {
    const stored = String(window.localStorage.getItem(RUN_STORAGE_KEY) || "").trim();
    if (stored) setRunId(stored);
  }, []);

  useEffect(() => {
    if (!runId || finished) return;
    const interval = window.setInterval(() => {
      loadStatus(true).catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [runId, finished]);

  async function startRun() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/admin/fii-ingestion/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ticker,
          cnpj: cnpj || undefined,
          year: Number(year || new Date().getFullYear()),
          delayMinutes: Number(delayMinutes || 0),
          enableAi,
        }),
      });
      const json = await readJson(response);
      const nextRunId = String(json.runId || "");
      setRunId(nextRunId);
      setResult(json);
      if (nextRunId) window.localStorage.setItem(RUN_STORAGE_KEY, nextRunId);
    } catch (err: any) {
      setError(err?.message || "Não foi possível iniciar a execução.");
    } finally {
      setLoading(false);
    }
  }

  async function loadStatus(silent = false) {
    if (!runId) return;
    if (!silent) setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/fii-ingestion/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ runId }),
      });
      setResult(await readJson(response));
    } catch (err: any) {
      setError(err?.message || "Não foi possível consultar o status.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function runQa() {
    if (!runId) return;
    setLoading(true);
    setError("");

    try {
      const response = await fetch(qaUrl, {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });
      setResult(await readJson(response));
    } catch (err: any) {
      setError(err?.message || "Não foi possível executar o QA.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        title="Ingestão operacional de fundos"
        subtitle="O tipo regulatório seleciona o adaptador correto. Toda coleta permanece em staging e a publicação oficial continua bloqueada."
        backLabel="← Voltar ao Admin"
        backHref="/admin"
      />

      <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl ring-1 ring-white/10">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600">
            <Database size={25} />
          </span>
          <div>
            <h1 className="text-2xl font-black">Template operacional por adaptador</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              FIIs usam o adaptador CVM FII v2 e FIAGROs usam o adaptador CVM FIAGRO v2. Tipos sem adaptador validado ficam bloqueados.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label>
            <span className="mb-1 block text-sm font-bold text-slate-300">Fundo</span>
            <select
              value={ticker}
              onChange={(event) => {
                setTicker(event.target.value);
                setCnpj("");
              }}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 font-bold text-white outline-none focus:border-indigo-400"
            >
              {OPERATIONAL_FUNDS.map((fund) => (
                <option key={fund.ticker} value={fund.ticker}>
                  {fund.ticker} · {fund.fundType}
                </option>
              ))}
            </select>
          </label>

          <Field label="CNPJ" value={cnpj} onChange={setCnpj} placeholder="Opcional se já estiver cadastrado" />
          <Field label="Ano" value={year} onChange={setYear} placeholder="2026" type="number" />
          <Field label="Atraso em minutos" value={delayMinutes} onChange={setDelayMinutes} placeholder="0" type="number" />
        </div>

        {selectedFund && (
          <div className="mt-4 rounded-2xl bg-indigo-500/10 p-4 text-sm ring-1 ring-indigo-400/20">
            <div className="font-black text-indigo-100">
              {selectedFund.fundType} · {selectedFund.adapterId}
            </div>
            <p className="mt-1 text-slate-300">{selectedFund.description}</p>
          </div>
        )}

        {BLOCKED_FUNDS.length > 0 && (
          <div className="mt-4 rounded-2xl bg-amber-500/10 p-4 ring-1 ring-amber-400/20">
            <div className="flex items-center gap-2 font-black text-amber-100">
              <ShieldAlert size={18} /> Tipos cadastrados, mas bloqueados
            </div>
            {BLOCKED_FUNDS.map((fund) => (
              <p key={fund.ticker} className="mt-2 text-xs leading-5 text-amber-100/80">
                <strong>{fund.ticker} · {fund.fundType}:</strong> {fund.blockReason}
              </p>
            ))}
          </div>
        )}

        <label className="mt-5 flex items-start gap-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
          <input
            type="checkbox"
            checked={enableAi}
            onChange={(event) => setEnableAi(event.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span>
            <strong className="block text-sm">Ativar enriquecimento por IA</strong>
            <span className="mt-1 block text-xs leading-5 text-slate-400">
              A coleta e o QA estruturado funcionam sem IA. Mantenha desativado durante os testes de regressão.
            </span>
          </span>
        </label>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={startRun}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-extrabold hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
            Iniciar {ticker}
          </button>

          <button
            type="button"
            onClick={() => loadStatus(false)}
            disabled={loading || !runId}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-3 font-extrabold hover:bg-slate-700 disabled:opacity-40"
          >
            <RefreshCw size={18} /> Atualizar status
          </button>

          <button
            type="button"
            onClick={runQa}
            disabled={loading || !runId || runStatus !== "completed"}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-extrabold hover:bg-emerald-600 disabled:opacity-40"
          >
            <ShieldCheck size={18} /> Executar QA
          </button>
        </div>

        {runId && (
          <p className="mt-4 break-all rounded-xl bg-slate-900 p-3 text-xs font-bold text-indigo-200">
            Execução: {runId}
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-red-500/10 p-4 text-sm font-bold text-red-200 ring-1 ring-red-500/20">
            {error}
          </p>
        )}

        {result && (
          <pre className="mt-5 max-h-[34rem] overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-black/30 p-4 text-xs leading-5 text-slate-200">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label>
      <span className="mb-1 block text-sm font-bold text-slate-300">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none placeholder:text-slate-600 focus:border-indigo-400"
      />
    </label>
  );
}
