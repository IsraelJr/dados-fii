'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Cloud, CloudUpload, Save, Trash2 } from "lucide-react";
import {
  flushPortfolioHistoryOperations,
  PORTFOLIO_HISTORY_PERSISTED_EVENT,
  reconcilePortfolioHistoryQueueAfterFlush,
} from "@/lib/portfolio/PortfolioHistoryFlush";
import AppToast from "./AppToast";

type HistorySource = "manual" | "automatic_snapshot" | "legacy";
type ProductEventName = "portfolio_viewed" | "history_month_added" | "history_month_updated" | "history_month_deleted";
type SyncState = "local" | "syncing" | "synced" | "error";

type HistoryEntry = Readonly<{
  schemaVersion: 1;
  portfolioId: string;
  competence: string;
  totalValue: number | null;
  dividends: number | null;
  source: HistorySource;
  createdAt: string;
  updatedAt: string;
}>;

type PendingHistory = Readonly<{ upserts: Record<string, HistoryEntry>; deletes: string[] }>;
type FormState = { year: string; month: string; dividends: string };

const EMAIL_KEY = "dados-fii-wallet-email";
const TOKEN_KEY = "dados-fii-wallet-session";
const PENDING_KEY = "dados-fii-portfolio-history-pending-v2";
const CACHE_KEY = "dados-fii-portfolio-history-cache-v2";
const PORTFOLIO_ID = "default";
const HISTORY_UPDATED_EVENT = "dados-fii-portfolio-history-updated";
const SYNC_DELAY_MS = 8_000;
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
] as const;

function currentYear() { return new Date().getFullYear(); }
function lastClosedMonth() { return new Date().getMonth(); }
function competenceOf(year: string, month: string) { return `${year}-${String(Number(month)).padStart(2, "0")}`; }
function monthLabel(competence: string) {
  const [year, month] = competence.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} / ${year}`;
}
function emptyForm(): FormState {
  return { year: String(currentYear()), month: String(Math.max(1, lastClosedMonth())), dividends: "" };
}
function currency(value: number | null) {
  return value === null ? "Não informado" : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function parseCurrencyInput(value: string) {
  const parsed = Number(value.replace(/\s/g, "").replace("R$", "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
function sortEntries(entries: readonly HistoryEntry[]) {
  return [...entries].sort((left, right) => left.competence.localeCompare(right.competence));
}
function epoch(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function newest(local: HistoryEntry, remote: HistoryEntry) {
  return epoch(local.updatedAt) > epoch(remote.updatedAt) ? local : remote;
}
function credentials() {
  return {
    email: window.localStorage.getItem(EMAIL_KEY)?.trim().toLowerCase() ?? "",
    token: window.localStorage.getItem(TOKEN_KEY) ?? "",
  };
}
function authHeaders(): Record<string, string> {
  const { email, token } = credentials();
  return email && token ? { "x-wallet-email": email, "x-wallet-session": token } : {};
}
async function api(method: "GET" | "POST" | "PATCH" | "DELETE", body?: Record<string, unknown>, keepalive = false) {
  const response = await fetch(`/api/portfolio/history?portfolioId=${PORTFOLIO_ID}`, {
    method,
    keepalive,
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: method === "GET" ? undefined : JSON.stringify({ portfolioId: PORTFOLIO_ID, ...body }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível processar o histórico.");
  return json;
}
function track(name: ProductEventName) {
  const headers = authHeaders();
  if (!headers["x-wallet-email"] || !headers["x-wallet-session"]) return;
  void fetch("/api/product/events", {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ name }),
  }).catch(() => undefined);
}
function publishHistory(entries: readonly HistoryEntry[]) {
  window.dispatchEvent(new CustomEvent(HISTORY_UPDATED_EVENT, { detail: { entries } }));
}
function publishHistoryPersistence() {
  window.dispatchEvent(new Event(PORTFOLIO_HISTORY_PERSISTED_EVENT));
}
function readPending(): PendingHistory {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PENDING_KEY) || "{}");
    return {
      upserts: parsed?.upserts && typeof parsed.upserts === "object" ? parsed.upserts : {},
      deletes: Array.isArray(parsed?.deletes) ? parsed.deletes : [],
    };
  } catch { return { upserts: {}, deletes: [] }; }
}
function writePending(pending: PendingHistory) {
  if (!Object.keys(pending.upserts).length && !pending.deletes.length) window.localStorage.removeItem(PENDING_KEY);
  else window.localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}
function readCache(): HistoryEntry[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CACHE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function writeCache(entries: readonly HistoryEntry[]) {
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(sortEntries(entries)));
}

export default function PortfolioHistoryPanel() {
  const [entries, setEntries] = useState<readonly HistoryEntry[]>([]);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [loading, setLoading] = useState(true);
  const [syncState, setSyncState] = useState<SyncState>("synced");
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" | "warning" } | null>(null);
  const viewedTracked = useRef(false);
  const persistedCompetences = useRef(new Set<string>());
  const pendingRef = useRef<PendingHistory>({ upserts: {}, deletes: [] });
  const syncTimer = useRef<number | null>(null);
  const flushInProgress = useRef<Promise<void> | null>(null);
  const inFlightUpserts = useRef(new Set<string>());
  const flushRef = useRef<(keepalive?: boolean) => Promise<void>>(async () => undefined);

  const applyEntries = useCallback((next: readonly HistoryEntry[]) => {
    const sorted = sortEntries(next);
    setEntries(sorted);
    writeCache(sorted);
    publishHistory(sorted);
  }, []);

  const flush = useCallback(async (keepalive = false) => {
    if (flushInProgress.current) return flushInProgress.current;
    let completed = false;
    const operation = (async () => {
      const captured = pendingRef.current;
      const upserts = Object.values(captured.upserts);
      const deletes = [...captured.deletes];
      if (!upserts.length && !deletes.length) {
        setSyncState("synced");
        return;
      }
      inFlightUpserts.current = new Set(upserts.map((entry) => entry.competence));
      setSyncState("syncing");
      try {
        await flushPortfolioHistoryOperations({
          upserts,
          deletes,
          isPersisted: (competence) => persistedCompetences.current.has(competence),
          refreshPersisted: async () => {
            const remote = await api("GET");
            const remoteEntries: HistoryEntry[] = Array.isArray(remote.entries) ? remote.entries : [];
            persistedCompetences.current = new Set(remoteEntries.map((entry) => entry.competence));
          },
          request: (method, body) => api(method, { ...body }, keepalive),
          markPersisted: (competence) => persistedCompetences.current.add(competence),
          markDeleted: (competence) => persistedCompetences.current.delete(competence),
          track,
          onPersisted: publishHistoryPersistence,
        });
        pendingRef.current = reconcilePortfolioHistoryQueueAfterFlush(
          pendingRef.current,
          captured,
        ) as PendingHistory;
        writePending(pendingRef.current);
        completed = true;
        setSyncState(
          Object.keys(pendingRef.current.upserts).length || pendingRef.current.deletes.length
            ? "local"
            : "synced",
        );
      } catch (error) {
        setSyncState("error");
        setToast({ message: error instanceof Error ? error.message : "Não foi possível sincronizar o histórico.", variant: "error" });
      }
    })();
    flushInProgress.current = operation;
    try { await operation; } finally {
      flushInProgress.current = null;
      inFlightUpserts.current.clear();
      if (
        completed
        && (Object.keys(pendingRef.current.upserts).length || pendingRef.current.deletes.length)
      ) {
        if (syncTimer.current !== null) window.clearTimeout(syncTimer.current);
        syncTimer.current = window.setTimeout(() => {
          syncTimer.current = null;
          void flushRef.current();
        }, 0);
      }
    }
  }, []);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const scheduleFlush = useCallback(() => {
    if (syncTimer.current !== null) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      syncTimer.current = null;
      void flushRef.current();
    }, SYNC_DELAY_MS);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const cached = readCache();
    if (cached.length) {
      setEntries(sortEntries(cached));
      publishHistory(sortEntries(cached));
    }
    try {
      const json = await api("GET");
      const serverEntries: HistoryEntry[] = Array.isArray(json.entries) ? json.entries : [];
      persistedCompetences.current = new Set(serverEntries.map((entry) => entry.competence));
      const pending = readPending();
      const localByCompetence = new Map(cached.map((entry) => [entry.competence, entry] as const));
      const remoteByCompetence = new Map(serverEntries.map((entry) => [entry.competence, entry] as const));
      const recoveredUpserts = { ...pending.upserts };
      const mergedByCompetence = new Map<string, HistoryEntry>();

      for (const remote of serverEntries) mergedByCompetence.set(remote.competence, remote);
      for (const local of cached) {
        const remote = remoteByCompetence.get(local.competence);
        if (!remote) {
          mergedByCompetence.set(local.competence, local);
          if (local.source === "manual") recoveredUpserts[local.competence] = local;
          continue;
        }
        const winner = newest(local, remote);
        mergedByCompetence.set(local.competence, winner);
        if (winner === local && local.source === "manual" && local.dividends !== remote.dividends) recoveredUpserts[local.competence] = local;
      }
      for (const [competence, pendingEntry] of Object.entries(pending.upserts)) {
        const current = mergedByCompetence.get(competence);
        if (!current || epoch(pendingEntry.updatedAt) >= epoch(current.updatedAt)) mergedByCompetence.set(competence, pendingEntry);
      }
      const deleted = new Set(pending.deletes);
      for (const competence of deleted) mergedByCompetence.delete(competence);
      for (const [competence, remote] of remoteByCompetence) {
        const local = localByCompetence.get(competence);
        if (local && epoch(remote.updatedAt) >= epoch(local.updatedAt)) delete recoveredUpserts[competence];
      }

      pendingRef.current = { upserts: recoveredUpserts, deletes: pending.deletes };
      writePending(pendingRef.current);
      applyEntries([...mergedByCompetence.values()]);
      if (Object.keys(recoveredUpserts).length || pending.deletes.length) {
        setSyncState("local");
        scheduleFlush();
      } else setSyncState("synced");
      if (!viewedTracked.current) { viewedTracked.current = true; track("portfolio_viewed"); }
    } catch (error) {
      setSyncState(cached.length ? "local" : "error");
      setToast({ message: error instanceof Error ? error.message : "Não foi possível carregar o histórico.", variant: "error" });
    } finally { setLoading(false); }
  }, [applyEntries, scheduleFlush]);

  useEffect(() => {
    void load();
    const onSession = () => void load();
    const onPageHide = () => void flush(true);
    const onVisibilityChange = () => { if (document.visibilityState === "hidden") void flush(true); };
    const onFreeze = () => void flush(true);
    const onOnline = () => void flush();
    window.addEventListener("dados-fii-wallet-session-updated", onSession);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("freeze", onFreeze);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("dados-fii-wallet-session-updated", onSession);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("freeze", onFreeze);
      window.removeEventListener("online", onOnline);
      if (syncTimer.current !== null) window.clearTimeout(syncTimer.current);
      void flush(true);
    };
  }, [flush, load]);

  const currentYearEntries = useMemo(() => entries.filter((entry) => entry.competence.startsWith(`${currentYear()}-`)), [entries]);
  const closedMonths = useMemo(() => Array.from({ length: lastClosedMonth() }, (_, index) => index + 1), []);
  const complete = closedMonths.length > 0 && closedMonths.every((month) => currentYearEntries.some((entry) => entry.competence === competenceOf(String(currentYear()), String(month))));

  function nextMonthAfter(month: number) {
    const nextMissing = closedMonths.find((candidate) => candidate > month && !currentYearEntries.some((entry) => entry.competence === competenceOf(String(currentYear()), String(candidate))));
    return String(nextMissing ?? Math.min(month + 1, Math.max(lastClosedMonth(), 1)));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const dividends = parseCurrencyInput(form.dividends);
    if (dividends === null) {
      setToast({ message: "Informe um valor válido de dividendos.", variant: "warning" });
      return;
    }
    const competence = competenceOf(form.year, form.month);
    const now = new Date().toISOString();
    const existing = entries.find((entry) => entry.competence === competence);
    const optimisticEntry: HistoryEntry = {
      schemaVersion: 1,
      portfolioId: PORTFOLIO_ID,
      competence,
      totalValue: null,
      dividends,
      source: "manual",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    applyEntries(entries.filter((entry) => entry.competence !== competence).concat(optimisticEntry));
    pendingRef.current = {
      upserts: { ...pendingRef.current.upserts, [competence]: optimisticEntry },
      deletes: pendingRef.current.deletes.filter((item) => item !== competence),
    };
    writePending(pendingRef.current);
    setSyncState("local");
    scheduleFlush();
    setToast({ message: `${monthLabel(competence)} atualizado • ${currency(dividends)}`, variant: "success" });
    setForm((current) => ({ ...current, month: nextMonthAfter(Number(current.month)), dividends: "" }));
  }

  function remove(entry: HistoryEntry) {
    if (entry.source !== "manual") return;
    applyEntries(entries.filter((item) => item.competence !== entry.competence));
    const upserts = { ...pendingRef.current.upserts };
    delete upserts[entry.competence];
    pendingRef.current = {
      upserts,
      deletes: persistedCompetences.current.has(entry.competence)
        || inFlightUpserts.current.has(entry.competence)
        ? Array.from(new Set([...pendingRef.current.deletes, entry.competence]))
        : pendingRef.current.deletes,
    };
    writePending(pendingRef.current);
    setSyncState("local");
    scheduleFlush();
  }

  const syncLabel = syncState === "syncing" ? "Sincronizando…" : syncState === "synced" ? "Sincronizado" : syncState === "error" ? "Falha ao sincronizar" : "Salvo neste dispositivo";
  const SyncIcon = syncState === "synced" ? CheckCircle2 : syncState === "syncing" ? CloudUpload : Cloud;

  return (
    <section aria-labelledby="portfolio-history-title" className="mx-auto mb-6 w-full max-w-6xl rounded-2xl border border-gray-200 bg-white p-4 text-gray-950 shadow-sm sm:p-6 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100">
      <AppToast message={toast?.message ?? ""} variant={toast?.variant ?? "info"} onClose={() => setToast(null)} />
      <span className="sr-only">Snapshot automático Registro legado</span>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="portfolio-history-title" className="text-xl font-extrabold text-gray-950 dark:text-white">Complete seu histórico de dividendos</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">Informe os dividendos dos meses já encerrados. O gráfico é atualizado imediatamente e as alterações são sincronizadas em segundo plano.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span aria-live="polite" className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700 dark:bg-gray-900 dark:text-gray-200"><SyncIcon size={14} />{syncLabel}</span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Grátis</span>
        </div>
      </div>
      <form onSubmit={submit} className="mt-5 grid gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:bg-gray-900">
        <label className="text-sm font-bold text-gray-800 dark:text-gray-100">Ano<input aria-label="Ano do histórico" value={form.year} disabled className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-3 font-normal text-gray-950 opacity-70 dark:border-gray-700 dark:bg-gray-950 dark:text-white" /></label>
        <label className="text-sm font-bold text-gray-800 dark:text-gray-100">Mês<select aria-label="Mês do histórico" value={form.month} onChange={(event) => setForm((current) => ({ ...current, month: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-3 font-normal text-gray-950 dark:border-gray-700 dark:bg-gray-950 dark:text-white">{closedMonths.map((month) => <option key={month} value={month}>{MONTH_NAMES[month - 1]}</option>)}</select></label>
        <label className="text-sm font-bold text-gray-800 dark:text-gray-100">Dividendos recebidos<input aria-label="Dividendos recebidos no mês" inputMode="decimal" value={form.dividends} onChange={(event) => setForm((current) => ({ ...current, dividends: event.target.value }))} placeholder="R$ 120,00" required className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-3 font-normal text-gray-950 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white" /></label>
        <div className="flex items-end"><button type="submit" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-indigo-700"><Save size={17} /> Salvar mês</button></div>
      </form>
      {complete && <p className="mt-4 text-sm font-extrabold text-emerald-700 dark:text-emerald-300">✓ Histórico completo até {MONTH_NAMES[Math.max(lastClosedMonth() - 1, 0)]} de {currentYear()}</p>}
      {!loading && currentYearEntries.length > 0 && <div className="mt-5" aria-label="Meses informados no histórico"><p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-gray-400">Meses informados</p><div className="flex flex-wrap gap-2">{currentYearEntries.map((entry) => <article key={entry.competence} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 py-1.5 pl-3 pr-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"><span className="font-bold">{MONTH_NAMES[Number(entry.competence.slice(5, 7)) - 1].slice(0, 3)} / {entry.competence.slice(0, 4)}</span><span>{currency(entry.dividends)}</span>{entry.source === "manual" && <button type="button" onClick={() => remove(entry)} aria-label={`Excluir ${monthLabel(entry.competence)}`} className="rounded-full p-1.5 text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950"><Trash2 size={14} /></button>}</article>)}</div></div>}
    </section>
  );
}
