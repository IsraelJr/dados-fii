"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileDown, ListPlus, Loader2, ShieldAlert, Trash2, XCircle } from "lucide-react";
import {
  buildFnetCollectionQueue,
  parseFnetCollectionQueue,
  type FnetCollectionQueueItem,
} from "@/lib/risk-lab/FnetCollectionQueue";
import type { FnetDividendNoticePreview } from "@/types/riskLabFnetNotice";

type ListResponse =
  | { ok: true; enabled: boolean; candidates: FnetDividendNoticePreview[] }
  | { ok: false; error: string };

type ImportResponse =
  | { ok: true; result: { candidate: FnetDividendNoticePreview; created: boolean } }
  | { ok: false; error: string };

type QueueState = FnetCollectionQueueItem & {
  status: "pending" | "importing" | "imported" | "error";
  message: string;
};

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

export default function FnetCollectionQueuePanel() {
  const [enabled, setEnabled] = useState(false);
  const [candidates, setCandidates] = useState<FnetDividendNoticePreview[]>([]);
  const [rawIds, setRawIds] = useState("");
  const [queue, setQueue] = useState<QueueState[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const importedIds = useMemo(() => new Set(candidates.map((candidate) => candidate.documentId)), [candidates]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await requestJson<ListResponse>("/api/admin/system/risk-lab/notices");
      if (!response.ok) throw new Error(response.error);
      setEnabled(response.enabled);
      setCandidates(response.candidates);
      setQueue((current) => current.map((item) => ({
        ...item,
        alreadyImported: response.candidates.some((candidate) => candidate.documentId === item.documentId),
        status: response.candidates.some((candidate) => candidate.documentId === item.documentId)
          ? "imported"
          : item.status === "importing"
            ? "pending"
            : item.status,
      })));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar os candidatos já importados.");
    } finally {
      setLoading(false);
    }
  }

  function createQueue() {
    setError("");
    setNotice("");
    const parsed = parseFnetCollectionQueue(rawIds);
    const items = buildFnetCollectionQueue(parsed.documentIds, importedIds).map<QueueState>((item) => ({
      ...item,
      status: item.alreadyImported ? "imported" : "pending",
      message: item.alreadyImported ? "Documento já importado anteriormente." : "Aguardando importação individual.",
    }));
    setQueue(items);

    const messages: string[] = [];
    if (parsed.rejectedTokens.length) messages.push(`${parsed.rejectedTokens.length} token(s) inválido(s) foram ignorados.`);
    if (parsed.truncated) messages.push("A fila foi limitada aos primeiros 20 IDs válidos e únicos.");
    if (!items.length) messages.push("Nenhum ID válido foi encontrado.");
    setNotice(messages.join(" "));
  }

  async function importOne(documentId: string) {
    setBusyId(documentId);
    setError("");
    setNotice("");
    setQueue((current) => current.map((item) => item.documentId === documentId
      ? { ...item, status: "importing", message: "Importando aviso e protocolo oficiais…" }
      : item));

    try {
      const response = await requestJson<ImportResponse>("/api/admin/system/risk-lab/notices", {
        method: "POST",
        body: JSON.stringify({ action: "import", documentId }),
      });
      if (!response.ok) throw new Error(response.error);
      const candidate = response.result.candidate;
      setCandidates((current) => {
        const withoutSame = current.filter((item) => item.documentId !== candidate.documentId);
        return [candidate, ...withoutSame];
      });
      setQueue((current) => current.map((item) => item.documentId === documentId
        ? {
            ...item,
            alreadyImported: true,
            status: "imported",
            message: `${candidate.ticker} · ${candidate.competenceMonth} · aguardando revisão manual.`,
          }
        : item));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Falha ao importar o documento.";
      setQueue((current) => current.map((item) => item.documentId === documentId
        ? { ...item, status: "error", message }
        : item));
    } finally {
      setBusyId("");
    }
  }

  function removeItem(documentId: string) {
    if (busyId === documentId) return;
    setQueue((current) => current.filter((item) => item.documentId !== documentId));
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-indigo-700">Organização operacional</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">Fila manual de documentos FNET</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Cole IDs oficiais já localizados. A fila apenas organiza o trabalho: cada documento precisa ser importado individualmente e continuará pendente de revisão humana.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${enabled ? "bg-emerald-100 text-emerald-900 ring-emerald-300" : "bg-slate-100 text-slate-700 ring-slate-300"}`}>
          {enabled ? "Importação disponível" : "Feature desativada"}
        </span>
      </div>

      <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-950 ring-1 ring-amber-200">
        <ShieldAlert className="mr-2 inline" size={18} /> Não existe ação em lote. A fila não aprova observações, não executa o detector e não altera o Premium.
      </div>

      <div className="mt-5 space-y-3">
        <textarea
          value={rawIds}
          onChange={(event) => setRawIds(event.target.value.slice(0, 1000))}
          placeholder="Cole IDs separados por espaço, vírgula, ponto e vírgula ou quebra de linha"
          className="min-h-32 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-600"
        />
        <button
          type="button"
          onClick={createQueue}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white"
        >
          <ListPlus size={17} /> Montar fila local
        </button>
      </div>

      {notice && <p className="mt-4 rounded-2xl bg-indigo-50 p-4 text-sm font-bold text-indigo-900 ring-1 ring-indigo-200">{notice}</p>}
      {error && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-900 ring-1 ring-red-200">{error}</p>}
      {loading && <p className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-500"><Loader2 className="animate-spin" size={17} /> Conferindo documentos já importados…</p>}

      {!loading && (
        <div className="mt-6 space-y-3">
          {queue.map((item, index) => {
            const importing = item.status === "importing";
            const imported = item.status === "imported" || item.alreadyImported;
            const failed = item.status === "error";
            return (
              <article key={item.documentId} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Posição {index + 1}</p>
                  <p className="mt-1 font-mono text-lg font-black text-slate-900">{item.documentId}</p>
                  <p className={`mt-1 text-sm font-bold ${failed ? "text-red-700" : imported ? "text-emerald-700" : "text-slate-600"}`}>{item.message}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={!enabled || imported || importing || Boolean(busyId)}
                    onClick={() => void importOne(item.documentId)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {importing ? <Loader2 className="animate-spin" size={16} /> : imported ? <CheckCircle2 size={16} /> : failed ? <XCircle size={16} /> : <FileDown size={16} />}
                    {importing ? "Importando…" : imported ? "Importado" : failed ? "Tentar novamente" : "Importar este ID"}
                  </button>
                  <button
                    type="button"
                    disabled={importing}
                    onClick={() => removeItem(item.documentId)}
                    aria-label={`Remover ${item.documentId} da fila`}
                    className="inline-flex items-center justify-center rounded-xl bg-slate-100 px-3 text-slate-700 ring-1 ring-slate-200 disabled:opacity-40"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            );
          })}
          {!queue.length && <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">A fila local está vazia.</p>}
        </div>
      )}
    </section>
  );
}
