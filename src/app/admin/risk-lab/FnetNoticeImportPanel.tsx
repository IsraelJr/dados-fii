"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, FileDown, Loader2, ShieldAlert, XCircle } from "lucide-react";
import type { FnetDividendNoticePreview } from "@/types/riskLabFnetNotice";
import type { DividendSeriesReadiness } from "@/types/riskLabSeriesReadiness";

type ListResponse =
  | {
      ok: true;
      enabled: boolean;
      candidates: FnetDividendNoticePreview[];
      series: DividendSeriesReadiness[];
    }
  | { ok: false; error: string };

type WriteResponse =
  | { ok: true; result?: { candidate: FnetDividendNoticePreview }; candidate?: FnetDividendNoticePreview }
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

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("pt-BR") : value;
}

function reviewStyle(status: FnetDividendNoticePreview["reviewStatus"]) {
  if (status === "approved") return "bg-emerald-100 text-emerald-900 ring-emerald-300";
  if (status === "rejected") return "bg-red-100 text-red-900 ring-red-300";
  return "bg-amber-100 text-amber-900 ring-amber-300";
}

function missingLabel(months: string[]) {
  if (!months.length) return "Nenhuma lacuna entre a primeira e a última competência";
  const visible = months.slice(0, 12).join(", ");
  return months.length > 12 ? `${visible} e mais ${months.length - 12}` : visible;
}

export default function FnetNoticeImportPanel() {
  const [enabled, setEnabled] = useState(false);
  const [candidates, setCandidates] = useState<FnetDividendNoticePreview[]>([]);
  const [series, setSeries] = useState<DividendSeriesReadiness[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await requestJson<ListResponse>("/api/admin/system/risk-lab/notices");
      if (!response.ok) throw new Error(response.error);
      setEnabled(response.enabled);
      setCandidates(response.candidates);
      setSeries(response.series);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar os avisos FNET.");
    } finally {
      setLoading(false);
    }
  }

  async function write(action: "import" | "approve" | "reject", payload: Record<string, unknown>) {
    setBusy(action === "import" ? "import" : String(payload.candidateId || action));
    setError("");
    try {
      const response = await requestJson<WriteResponse>("/api/admin/system/risk-lab/notices", {
        method: "POST",
        body: JSON.stringify({ action, ...payload }),
      });
      if (!response.ok) throw new Error(response.error);
      if (action === "import") setDocumentId("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha no fluxo de revisão FNET.");
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-indigo-700">Coleta documental controlada</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">Avisos mensais do FNET</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Importe um ID oficial de aviso estruturado de rendimentos de MCCI11 ou RBRY11. O sistema lê o aviso e o protocolo, mas nenhum dado entra na série verificada antes da sua aprovação manual.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${enabled ? "bg-emerald-100 text-emerald-900 ring-emerald-300" : "bg-slate-100 text-slate-700 ring-slate-300"}`}>
          {enabled ? "Importação ativa" : "Feature desativada"}
        </span>
      </div>

      <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200">
        <ShieldAlert className="mr-2 inline" size={18} /> Aprovar um aviso não executa o detector, não altera alertas e não libera o backtest externo.
      </div>

      {!loading && (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {series.map((item) => (
            <article key={item.ticker} className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Cobertura da série verificada</p>
                  <h3 className="mt-1 text-2xl font-black">{item.ticker}</h3>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${item.readyForStressDetection ? "bg-emerald-200 text-emerald-950 ring-emerald-300" : "bg-amber-200 text-amber-950 ring-amber-300"}`}>
                  {item.readyForStressDetection ? "Série suficiente" : "Coleta incompleta"}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <SeriesMetric label="Meses aprovados" value={String(item.approvedObservations)} />
                <SeriesMetric label="Maior sequência" value={`${item.longestContiguousCount}/${item.requiredContiguousCount}`} />
                <SeriesMetric label="Detector" value={item.detectorExecuted ? "Executado" : "Não executado"} />
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <p><strong className="text-white">Intervalo aprovado:</strong> {item.firstCompetence && item.lastCompetence ? `${item.firstCompetence} a ${item.lastCompetence}` : "nenhum mês aprovado"}</p>
                <p><strong className="text-white">Maior sequência contínua:</strong> {item.longestContiguousMonths.length ? item.longestContiguousMonths.join(", ") : "nenhuma"}</p>
                <p><strong className="text-white">Lacunas:</strong> {missingLabel(item.missingMonths)}</p>
              </div>

              <p className="mt-4 rounded-xl bg-white/10 p-3 text-xs font-bold leading-5 text-slate-200">
                “Série suficiente” significa apenas que existem nove competências consecutivas aprovadas para alimentar o detector. Nenhum resultado analítico foi calculado nesta etapa.
              </p>
            </article>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          value={documentId}
          onChange={(event) => setDocumentId(event.target.value.replace(/\D/g, "").slice(0, 12))}
          inputMode="numeric"
          placeholder="ID numérico do documento FNET"
          className="min-w-0 flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-600"
        />
        <button
          type="button"
          disabled={!enabled || !documentId || busy === "import"}
          onClick={() => void write("import", { documentId })}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-700 px-5 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === "import" ? <Loader2 className="animate-spin" size={17} /> : <FileDown size={17} />}
          Importar e pré-visualizar
        </button>
      </div>

      {error && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-900 ring-1 ring-red-200">{error}</p>}
      {loading && <p className="mt-5 flex items-center gap-2 text-sm font-bold text-slate-500"><Loader2 className="animate-spin" size={17} /> Carregando candidatos e cobertura…</p>}

      {!loading && (
        <div className="mt-6 space-y-4">
          {candidates.map((candidate) => (
            <article key={candidate.candidateId} className="rounded-2xl border border-slate-200 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">{candidate.candidateId}</p>
                  <h3 className="mt-1 text-xl font-black text-slate-900">{candidate.ticker} · {candidate.competenceMonth}</h3>
                  <p className="mt-1 text-sm text-slate-600">{candidate.fundName}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ring-1 ${reviewStyle(candidate.reviewStatus)}`}>{candidate.reviewStatus.replaceAll("_", " ")}</span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Small label="Rendimento por cota" value={money(candidate.amountPerShare)} />
                <Small label="Anúncio público" value={dateTime(candidate.announcedAt)} />
                <Small label="Data-base" value={candidate.baseDate} />
                <Small label="Pagamento" value={candidate.paymentDate} />
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <a href={candidate.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-between rounded-2xl bg-indigo-50 p-4 text-sm font-extrabold text-indigo-900 ring-1 ring-indigo-100">Abrir aviso estruturado <ExternalLink size={16} /></a>
                <a href={candidate.protocolUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-between rounded-2xl bg-slate-100 p-4 text-sm font-extrabold text-slate-900 ring-1 ring-slate-200">Abrir protocolo de entrega <ExternalLink size={16} /></a>
              </div>

              <div className="mt-3 break-all rounded-2xl bg-slate-50 p-3 font-mono text-[11px] leading-5 text-slate-600">
                aviso {candidate.sourceHash}<br />protocolo {candidate.protocolHash}
              </div>

              {candidate.reviewStatus === "pending_manual_review" && (
                <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <label className="flex items-start gap-3 text-sm font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={Boolean(confirmations[candidate.candidateId])}
                      onChange={(event) => setConfirmations((current) => ({ ...current, [candidate.candidateId]: event.target.checked }))}
                      className="mt-1 h-4 w-4"
                    />
                    Conferi ticker, competência, valor por cota, data-base, pagamento e horário de entrega nos dois documentos oficiais.
                  </label>
                  <div className="flex flex-col gap-3 lg:flex-row">
                    <button
                      type="button"
                      disabled={!confirmations[candidate.candidateId] || busy === candidate.candidateId}
                      onClick={() => void write("approve", { candidateId: candidate.candidateId, confirmed: true })}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-40"
                    >
                      <CheckCircle2 size={16} /> Aprovar observação
                    </button>
                    <input
                      value={reasons[candidate.candidateId] || ""}
                      onChange={(event) => setReasons((current) => ({ ...current, [candidate.candidateId]: event.target.value.slice(0, 500) }))}
                      placeholder="Motivo para rejeição (mínimo 10 caracteres)"
                      className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                    />
                    <button
                      type="button"
                      disabled={(reasons[candidate.candidateId] || "").trim().length < 10 || busy === candidate.candidateId}
                      onClick={() => void write("reject", { candidateId: candidate.candidateId, reason: reasons[candidate.candidateId] })}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-40"
                    >
                      <XCircle size={16} /> Rejeitar
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
          {!candidates.length && <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">Nenhum aviso importado.</p>}
        </div>
      )}
    </section>
  );
}

function SeriesMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white/10 p-3"><p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-black text-white">{value}</p></div>;
}

function Small({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200"><p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-black text-slate-900">{value}</p></div>;
}
