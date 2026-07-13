'use client';

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseBackup,
  Loader2,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  UploadCloud,
} from "lucide-react";
import PageHeader from "../../../components/PageHeader";

async function readJson(response: Response) {
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.error || "Erro na operação.");
  return json;
}

export default function PublicationControlPage() {
  const [runId, setRunId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [publication, setPublication] = useState<Record<string, any> | null>(null);
  const [rollback, setRollback] = useState<Record<string, any> | null>(null);
  const [confirmationText, setConfirmationText] = useState("");
  const [proposalHash, setProposalHash] = useState("");
  const [result, setResult] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const nextRunId = String(query.get("runId") || "").trim();
    if (nextRunId) {
      setRunId(nextRunId);
      loadReadiness(nextRunId).catch(() => undefined);
    }
  }, []);

  async function loadReadiness(explicitRunId?: string) {
    const selectedRunId = String(explicitRunId || runId).trim();
    if (!selectedRunId) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const publicationResponse = await fetch(
        `/api/admin/fii-ingestion/publication?runId=${encodeURIComponent(selectedRunId)}`,
        { credentials: "same-origin", cache: "no-store" }
      );
      const publicationJson = await readJson(publicationResponse);
      const publicationReadiness = publicationJson.readiness || null;
      setPublication(publicationReadiness);
      setProposalHash(String(publicationReadiness?.proposalHash || ""));
      setConfirmationText("");

      const rollbackResponse = await fetch(
        `/api/admin/fii-ingestion/rollback?runId=${encodeURIComponent(selectedRunId)}`,
        { credentials: "same-origin", cache: "no-store" }
      );
      const rollbackJson = await readJson(rollbackResponse);
      setRollback(rollbackJson.readiness || null);
    } catch (err: any) {
      setError(err?.message || "Não foi possível consultar a prontidão.");
    } finally {
      setLoading(false);
    }
  }

  async function publish() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const json = await readJson(await fetch("/api/admin/fii-ingestion/publication", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, proposalHash, confirmationText }),
      }));
      setResult(json);
      await loadReadiness(runId);
    } catch (err: any) {
      setError(err?.message || "Não foi possível publicar.");
    } finally {
      setLoading(false);
    }
  }

  async function rollbackPublication() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const json = await readJson(await fetch("/api/admin/fii-ingestion/rollback", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, proposalHash, confirmationText }),
      }));
      setResult(json);
      await loadReadiness(runId);
    } catch (err: any) {
      setError(err?.message || "Não foi possível executar o rollback.");
    } finally {
      setLoading(false);
    }
  }

  const published = publication?.publicationStatus === "published";
  const expected = published
    ? rollback?.expectedConfirmation || ""
    : publication?.expectedConfirmation || "";
  const environmentEnabled = published
    ? rollback?.environmentEnabled === true
    : publication?.environmentEnabled === true;
  const actionReady = published
    ? rollback?.canAttemptRollback === true
    : publication?.canAttemptPublication === true;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        title="Controle de publicação regulatória"
        subtitle="Audite hashes, backup e estado da base. Escritas só ficam disponíveis durante uma janela habilitada por variável de ambiente."
        backLabel="← Voltar à aprovação"
        backHref={runId ? `/admin/fii-ingestion/approval?runId=${encodeURIComponent(runId)}&ticker=${encodeURIComponent(publication?.ticker || "")}` : "/admin/fii-ingestion"}
      />

      <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl ring-1 ring-white/10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <label className="flex-1">
            <span className="mb-1 block text-sm font-bold text-slate-300">Run ID</span>
            <input
              value={runId}
              onChange={(event) => setRunId(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none focus:border-indigo-400"
            />
          </label>
          <button
            type="button"
            onClick={() => loadReadiness()}
            disabled={loading || !runId}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-extrabold hover:bg-indigo-500 disabled:opacity-40"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
            Atualizar prontidão
          </button>
        </div>

        {publication && (
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <StatusCard label="Aprovação" value={publication.approvalStatus || "—"} ok={publication.approvalExists} />
            <StatusCard label="Backup" value={publication.backupStatus || "—"} ok={publication.backupExists} />
            <StatusCard label="Base inalterada" value={publication.officialDocumentUnchanged ? "Sim" : "Não"} ok={publication.officialDocumentUnchanged} />
            <StatusCard label="Ambiente de escrita" value={environmentEnabled ? "Ativo" : "Desativado"} ok={environmentEnabled} />
          </div>
        )}

        {publication && !environmentEnabled && (
          <div className="mt-5 rounded-2xl bg-amber-500/10 p-5 ring-1 ring-amber-400/20">
            <div className="flex items-center gap-2 font-black text-amber-100">
              <LockKeyhole size={19} /> Escrita bloqueada pelo ambiente
            </div>
            <p className="mt-2 text-sm leading-6 text-amber-100/80">
              {published
                ? "FII_INGESTION_ROLLBACK_ENABLED não está ativo."
                : "FII_INGESTION_PUBLICATION_ENABLED não está ativo."}
              Nenhum clique nesta tela consegue alterar a base enquanto o sinalizador estiver desligado.
            </p>
          </div>
        )}

        {publication && (
          <div className="mt-5 rounded-2xl bg-slate-900 p-5 ring-1 ring-slate-800">
            <div className="flex items-center gap-2 font-black">
              <DatabaseBackup size={19} className="text-indigo-300" /> Identidade do pacote
            </div>
            <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
              <div><dt className="text-slate-500">Ticker</dt><dd className="font-black">{publication.ticker}</dd></div>
              <div><dt className="text-slate-500">Hash aprovado</dt><dd className="break-all font-mono text-xs">{proposalHash}</dd></div>
              <div><dt className="text-slate-500">Publicação</dt><dd>{publication.publicationStatus || "Ainda não publicada"}</dd></div>
              <div><dt className="text-slate-500">Rollback</dt><dd>{rollback?.publicationExists ? (rollback?.rollbackAvailable ? "Disponível" : "Indisponível") : "Não aplicável"}</dd></div>
            </dl>
          </div>
        )}

        {publication && (
          <div className="mt-5 rounded-2xl bg-red-500/10 p-5 ring-1 ring-red-400/20">
            <div className="flex items-center gap-2 font-black text-red-100">
              {published ? <RotateCcw size={19} /> : <UploadCloud size={19} />}
              {published ? "Rollback transacional" : "Publicação transacional"}
            </div>
            <p className="mt-2 text-sm leading-6 text-red-100/80">
              Esta ação exige o hash completo e a frase exata abaixo. Ela continuará indisponível enquanto o ambiente não estiver habilitado.
            </p>
            <div className="mt-4 rounded-xl bg-black/30 p-3 font-mono text-sm font-black text-red-100">{expected}</div>
            <input
              value={confirmationText}
              onChange={(event) => setConfirmationText(event.target.value.toUpperCase())}
              placeholder={expected}
              className="mt-3 w-full rounded-xl border border-red-400/30 bg-slate-950 p-3 font-black text-white outline-none focus:border-red-300"
            />
            <button
              type="button"
              onClick={published ? rollbackPublication : publish}
              disabled={loading || !actionReady || confirmationText !== expected}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-700 px-5 py-3 font-extrabold hover:bg-red-600 disabled:opacity-30"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : published ? <RotateCcw size={18} /> : <UploadCloud size={18} />}
              {published ? "Executar rollback" : "Publicar regulatoryData"}
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-red-500/10 p-4 text-sm font-bold text-red-200 ring-1 ring-red-500/20">
            {error}
          </p>
        )}

        {result && (
          <pre className="mt-5 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-black/30 p-4 text-xs leading-5 text-slate-200">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </section>
    </main>
  );
}

function StatusCard({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        {ok ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertTriangle size={16} className="text-amber-400" />}
        {label}
      </div>
      <div className="mt-2 break-words text-sm font-black text-white">{value}</div>
    </div>
  );
}
