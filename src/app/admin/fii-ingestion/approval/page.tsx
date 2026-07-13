'use client';

import { useEffect, useState } from "react";
import { CheckCircle2, DatabaseBackup, Loader2, LockKeyhole } from "lucide-react";
import PageHeader from "../../../components/PageHeader";

async function readJson(response: Response) {
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.error || "Erro ao registrar aprovação.");
  return json;
}

export default function HumanApprovalPage() {
  const [runId, setRunId] = useState("");
  const [ticker, setTicker] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const nextRunId = String(query.get("runId") || "").trim();
    const nextTicker = String(query.get("ticker") || "").trim().toUpperCase();
    setRunId(nextRunId);
    setTicker(nextTicker);
  }, []);

  const expected = ticker ? `APROVAR ${ticker}` : "APROVAR TICKER";

  async function approve() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/admin/fii-ingestion/approve-pre-publication", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, confirmationText }),
      });
      setResult(await readJson(response));
    } catch (err: any) {
      setError(err?.message || "Não foi possível registrar a aprovação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <PageHeader
        title="Aprovação humana e backup"
        subtitle="Registre a revisão do pacote e crie um backup imutável do documento oficial. Esta etapa não publica dados."
        backLabel="← Voltar à pré-publicação"
        backHref={runId ? `/admin/fii-ingestion/pre-publication?runId=${encodeURIComponent(runId)}` : "/admin/fii-ingestion"}
      />

      <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl ring-1 ring-white/10">
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="mb-1 block text-sm font-bold text-slate-300">Run ID</span>
            <input
              value={runId}
              onChange={(event) => setRunId(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none focus:border-indigo-400"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold text-slate-300">Ticker</span>
            <input
              value={ticker}
              onChange={(event) => setTicker(event.target.value.toUpperCase())}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 font-black text-white outline-none focus:border-indigo-400"
            />
          </label>
        </div>

        <div className="mt-5 rounded-2xl bg-amber-500/10 p-5 ring-1 ring-amber-400/20">
          <div className="flex items-center gap-2 font-black text-amber-100">
            <LockKeyhole size={19} /> Confirmação obrigatória
          </div>
          <p className="mt-2 text-sm leading-6 text-amber-100/80">
            Digite exatamente <strong>{expected}</strong>. Isso registra sua aprovação e congela o pacote por hash.
          </p>
          <input
            value={confirmationText}
            onChange={(event) => setConfirmationText(event.target.value.toUpperCase())}
            placeholder={expected}
            className="mt-4 w-full rounded-xl border border-amber-400/30 bg-slate-950 p-3 font-black text-white outline-none focus:border-amber-300"
          />
        </div>

        <div className="mt-5 rounded-2xl bg-slate-900 p-5 ring-1 ring-slate-800">
          <div className="flex items-center gap-2 font-black">
            <DatabaseBackup size={19} className="text-indigo-300" /> O que será gravado
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>✓ Aprovação em FiiIngestionApprovals/{runId || "runId"}</li>
            <li>✓ Cópia integral em FiiIngestionBackups/{runId || "runId"}</li>
            <li>✓ Hash do pacote aprovado para impedir alterações silenciosas</li>
            <li>✓ Nenhuma alteração em Fiis/{ticker || "TICKER"}</li>
          </ul>
        </div>

        <button
          type="button"
          onClick={approve}
          disabled={loading || !runId || !ticker || confirmationText !== expected}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-extrabold hover:bg-emerald-600 disabled:opacity-40"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
          Registrar aprovação e criar backup
        </button>

        {error && (
          <p className="mt-4 rounded-xl bg-red-500/10 p-4 text-sm font-bold text-red-200 ring-1 ring-red-500/20">
            {error}
          </p>
        )}

        {result && (
          <div className="mt-5 rounded-2xl bg-emerald-500/10 p-5 ring-1 ring-emerald-400/20">
            <div className="font-black text-emerald-100">Aprovação e backup registrados</div>
            <p className="mt-2 text-sm text-emerald-100/80">
              A base oficial continua intacta e a publicação permanece bloqueada.
            </p>
            <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/30 p-4 text-xs text-slate-200">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </section>
    </main>
  );
}
