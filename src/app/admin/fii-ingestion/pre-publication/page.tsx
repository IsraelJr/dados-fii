'use client';

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseBackup,
  FileDiff,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import PageHeader from "../../../components/PageHeader";

type ReviewResponse = Record<string, any> | null;

async function readJson(response: Response) {
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.error || "Erro ao gerar pré-publicação.");
  return json;
}

function money(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function integer(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "—";
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return `${value.length} item(ns)`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function PrePublicationPage() {
  const [runId, setRunId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<ReviewResponse>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const value = String(query.get("runId") || "").trim();
    if (value) {
      setRunId(value);
      generate(value).catch(() => undefined);
    }
  }, []);

  async function generate(explicitRunId?: string) {
    const selectedRunId = String(explicitRunId || runId).trim();
    if (!selectedRunId) {
      setError("Informe o runId aprovado no QA.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await readJson(await fetch("/api/admin/fii-ingestion/pre-publication", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: selectedRunId, persist: true }),
      }));
      setResponse(result);
    } catch (err: any) {
      setError(err?.message || "Não foi possível gerar a pré-publicação.");
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }

  const review = response?.reviewPackage || null;
  const proposal = review?.proposedRegulatoryData || null;
  const latest = proposal?.latestSnapshot || null;
  const differences = Array.isArray(review?.differences) ? review.differences : [];
  const qaUrl = useMemo(() => runId
    ? `/api/admin/fii-ingestion/operational-qa?runId=${encodeURIComponent(runId)}&persist=1`
    : "", [runId]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title="Pré-publicação regulatória"
        subtitle="Compare o pacote aprovado em staging com o namespace regulatório da base oficial. Nenhum dado pode ser publicado nesta tela."
        backLabel="← Voltar à ingestão"
        backHref="/admin/fii-ingestion"
      />

      <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl ring-1 ring-white/10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <label className="flex-1">
            <span className="mb-1 block text-sm font-bold text-slate-300">Run ID aprovado no QA</span>
            <input
              value={runId}
              onChange={(event) => setRunId(event.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none placeholder:text-slate-600 focus:border-indigo-400"
            />
          </label>
          <button
            type="button"
            onClick={() => generate()}
            disabled={loading || !runId.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-extrabold hover:bg-indigo-500 disabled:opacity-40"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
            Gerar pacote
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-red-500/10 p-4 text-sm font-bold text-red-200 ring-1 ring-red-500/20">
            {error}
          </p>
        )}

        {!review && !error && (
          <div className="mt-6 rounded-2xl bg-slate-900 p-6 text-sm text-slate-300 ring-1 ring-slate-800">
            A execução precisa ter QA com score 100 e verdict <code>approved_for_human_review</code>.
          </div>
        )}

        {review && (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <Metric icon={<ShieldCheck size={19} />} label="QA" value={`${review.safeguards?.qaScore || 0}/100`} />
              <Metric icon={<FileDiff size={19} />} label="Diferenças" value={String(differences.length)} />
              <Metric icon={<DatabaseBackup size={19} />} label="Competências" value={String(proposal?.quality?.monthlySnapshots || 0)} />
              <Metric icon={<LockKeyhole size={19} />} label="Publicação" value="Bloqueada" />
            </div>

            <div className="rounded-2xl bg-emerald-500/10 p-5 ring-1 ring-emerald-400/20">
              <div className="flex items-center gap-2 font-black text-emerald-100">
                <CheckCircle2 size={20} /> Pacote pronto para revisão humana
              </div>
              <p className="mt-2 text-sm leading-6 text-emerald-100/80">
                Destino futuro: <strong>{review.targetDocument}</strong>, somente dentro de <strong>{review.targetNamespace}</strong>.
                Os {review.protectedLegacyFields?.length || 0} campos legados existentes permanecem protegidos.
              </p>
            </div>

            <section>
              <h2 className="text-lg font-black">Última competência proposta</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <DataCard label="Referência" value={latest?.referenceDate || "—"} />
                <DataCard label="Patrimônio líquido" value={money(latest?.netWorth)} />
                <DataCard label="VP/cota" value={money(latest?.vpCota)} />
                <DataCard label="Cotas emitidas" value={integer(latest?.sharesOutstanding)} />
                <DataCard label="Cotistas" value={integer(latest?.numberShareholders)} />
              </div>
            </section>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-black">Diferenças em regulatoryData</h2>
                <a
                  href={qaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-bold text-indigo-300 hover:text-indigo-200"
                >
                  Abrir QA da execução
                </a>
              </div>
              <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-slate-800">
                <div className="max-h-[30rem] overflow-auto">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="sticky top-0 bg-slate-900 text-slate-300">
                      <tr>
                        <th className="p-3">Campo</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3">Atual</th>
                        <th className="p-3">Proposto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {differences.map((item: any) => (
                        <tr key={item.path} className="border-t border-slate-800 align-top">
                          <td className="p-3 font-bold text-indigo-200">{item.path}</td>
                          <td className="p-3 text-slate-300">{item.changeType}</td>
                          <td className="max-w-xs break-words p-3 text-slate-400">{displayValue(item.before)}</td>
                          <td className="max-w-xs break-words p-3 text-white">{displayValue(item.after)}</td>
                        </tr>
                      ))}
                      {!differences.length && (
                        <tr><td colSpan={4} className="p-6 text-center text-slate-400">Nenhuma diferença regulatória.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-slate-900 p-5 ring-1 ring-slate-800">
                <h2 className="font-black">Proteções confirmadas</h2>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  <li>✓ Nenhuma gravação em Fiis/{review.ticker}</li>
                  <li>✓ Nenhum endpoint de publicação disponível</li>
                  <li>✓ Campos legados não serão sobrescritos</li>
                  <li>✓ Backup e rollback obrigatórios antes da publicação</li>
                  <li>✓ Autorização explícita ainda necessária</li>
                </ul>
              </div>

              <div className="rounded-2xl bg-amber-500/10 p-5 ring-1 ring-amber-400/20">
                <div className="flex items-center gap-2 font-black text-amber-100">
                  <AlertTriangle size={19} /> Etapa deliberadamente bloqueada
                </div>
                <p className="mt-3 text-sm leading-6 text-amber-100/80">
                  Esta tela apenas salva o pacote em <strong>FiiIngestionPrePublication/{review.runId}</strong>.
                  A publicação oficial só poderá existir após implementarmos backup imutável, aprovação humana registrada e rollback.
                </p>
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
      <div className="flex items-center gap-2 text-indigo-300">{icon}<span className="text-xs font-bold uppercase tracking-wide">{label}</span></div>
      <div className="mt-2 text-xl font-black">{value}</div>
    </div>
  );
}

function DataCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 break-words font-black text-white">{value}</div>
    </div>
  );
}
