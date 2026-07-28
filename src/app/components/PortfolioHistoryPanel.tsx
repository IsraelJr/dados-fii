'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, Pencil, Save, Trash2, X } from "lucide-react";

type HistorySource = "manual" | "automatic_snapshot" | "legacy";
type ProductEventName = "portfolio_viewed" | "history_month_added" | "history_month_updated" | "history_month_deleted";

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

type FormState = {
  year: string;
  month: string;
  dividends: string;
};

const EMAIL_KEY = "dados-fii-wallet-email";
const TOKEN_KEY = "dados-fii-wallet-session";
const PORTFOLIO_ID = "default";
const HISTORY_UPDATED_EVENT = "dados-fii-portfolio-history-updated";
const EMPTY_FORM: FormState = {
  year: String(new Date().getFullYear()),
  month: String(Math.max(1, new Date().getMonth())),
  dividends: "",
};

function currency(value: number | null) {
  return value === null ? "Não informado" : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthLabel(competence: string) {
  const [year, month] = competence.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function sourceLabel(source: HistorySource) {
  if (source === "manual") return "Informado por você";
  if (source === "automatic_snapshot") return "Snapshot automático";
  return "Registro legado";
}

function credentials() {
  const email = window.localStorage.getItem(EMAIL_KEY)?.trim().toLowerCase() ?? "";
  const token = window.localStorage.getItem(TOKEN_KEY) ?? "";
  return { email, token };
}

function authHeaders(): Record<string, string> {
  const { email, token } = credentials();
  if (!email || !token) return {};
  return { "x-wallet-email": email, "x-wallet-session": token };
}

async function api(method: "GET" | "POST" | "PATCH" | "DELETE", body?: Record<string, unknown>) {
  const response = await fetch(`/api/portfolio/history?portfolioId=${PORTFOLIO_ID}`, {
    method,
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

export default function PortfolioHistoryPanel() {
  const [entries, setEntries] = useState<readonly HistoryEntry[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const viewedTracked = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const json = await api("GET");
      const nextEntries = Array.isArray(json.entries) ? json.entries : [];
      setEntries(nextEntries);
      publishHistory(nextEntries);
      if (!viewedTracked.current) {
        viewedTracked.current = true;
        track("portfolio_viewed");
      }
    } catch (error) {
      setEntries([]);
      publishHistory([]);
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar o histórico.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onSession = () => void load();
    window.addEventListener("dados-fii-wallet-session-updated", onSession);
    return () => window.removeEventListener("dados-fii-wallet-session-updated", onSession);
  }, [load]);

  const currentYearEntries = useMemo(
    () => entries.filter((entry) => entry.competence.startsWith(`${new Date().getFullYear()}-`)),
    [entries],
  );

  function resetForm() {
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  function beginEdit(entry: HistoryEntry) {
    if (entry.source !== "manual") return;
    const [year, month] = entry.competence.split("-");
    setEditing(entry.competence);
    setSuccess("");
    setForm({
      year,
      month: String(Number(month)),
      dividends: entry.dividends === null ? "" : String(entry.dividends).replace(".", ","),
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setSuccess("");
    try {
      const editedCompetence = editing;
      if (editing) {
        await api("PATCH", { competence: editing, dividends: form.dividends });
        track("history_month_updated");
      } else {
        await api("POST", { year: form.year, month: form.month, dividends: form.dividends });
        track("history_month_added");
      }
      const savedLabel = editedCompetence
        ? monthLabel(editedCompetence)
        : monthLabel(`${form.year}-${String(Number(form.month)).padStart(2, "0")}`);
      resetForm();
      await load();
      setSuccess(`Dividendos de ${savedLabel} salvos no histórico.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o histórico.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(entry: HistoryEntry) {
    if (entry.source !== "manual") return;
    if (!window.confirm(`Excluir ${monthLabel(entry.competence)} do histórico de dividendos?`)) return;
    setSaving(true);
    setMessage("");
    setSuccess("");
    try {
      await api("DELETE", { competence: entry.competence });
      track("history_month_deleted");
      if (editing === entry.competence) resetForm();
      await load();
      setSuccess(`${monthLabel(entry.competence)} removido do histórico.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível excluir o mês.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="portfolio-history-title" className="mx-auto mb-6 w-full max-w-6xl rounded-2xl border border-gray-200 bg-white p-4 text-gray-950 shadow-sm sm:p-6 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="portfolio-history-title" className="text-xl font-extrabold text-gray-950 dark:text-white">Complete seu histórico de dividendos</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">Informe quanto recebeu em dividendos nos meses anteriores do ano corrente. Cada mês é salvo no banco e passa a alimentar os gráficos da carteira.</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Grátis</span>
      </div>

      <form onSubmit={submit} className="mt-5 grid gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:bg-gray-900">
        <label className="text-sm font-bold text-gray-800 dark:text-gray-100">Ano
          <input aria-label="Ano do histórico" inputMode="numeric" value={form.year} disabled={Boolean(editing)} onChange={(event) => setForm((current) => ({ ...current, year: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-3 font-normal text-gray-950 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
        </label>
        <label className="text-sm font-bold text-gray-800 dark:text-gray-100">Mês
          <select aria-label="Mês do histórico" value={form.month} disabled={Boolean(editing)} onChange={(event) => setForm((current) => ({ ...current, month: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-3 font-normal text-gray-950 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-white">
            {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(2026, month - 1, 1))}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-gray-800 dark:text-gray-100">Dividendos recebidos
          <input aria-label="Dividendos recebidos no mês" inputMode="decimal" value={form.dividends} onChange={(event) => setForm((current) => ({ ...current, dividends: event.target.value }))} placeholder="R$ 120,00" required className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-3 font-normal text-gray-950 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" disabled={saving} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-indigo-700 disabled:opacity-60">
            {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
            {editing ? "Salvar alteração" : "Salvar mês"}
          </button>
          {editing && <button type="button" onClick={resetForm} aria-label="Cancelar edição" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 px-3 text-gray-700 dark:border-gray-700 dark:text-gray-200"><X size={18} /></button>}
        </div>
      </form>

      {success && <p role="status" className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"><CheckCircle2 size={18} />{success}</p>}
      {message && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-100">{message}</p>}

      <div className="mt-5" aria-label="Histórico mensal de dividendos">
        {loading ? (
          <div className="flex min-h-24 items-center justify-center"><Loader2 className="animate-spin" /></div>
        ) : currentYearEntries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">Nenhum dividendo informado no ano corrente.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{currentYearEntries.map((entry) => (
            <article key={entry.competence} className="rounded-xl border border-gray-200 bg-white p-4 text-gray-950 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-extrabold capitalize text-gray-950 dark:text-white">{monthLabel(entry.competence)}</p>
                  <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">{currency(entry.dividends)}</p>
                  <span className="mt-2 inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">{sourceLabel(entry.source)}</span>
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={entry.source !== "manual" || saving} onClick={() => beginEdit(entry)} aria-label={`Editar ${monthLabel(entry.competence)}`} className="rounded-lg border border-gray-300 p-2 text-gray-700 disabled:cursor-not-allowed disabled:opacity-35 dark:border-gray-700 dark:text-gray-200"><Pencil size={16} /></button>
                  <button type="button" disabled={entry.source !== "manual" || saving} onClick={() => void remove(entry)} aria-label={`Excluir ${monthLabel(entry.competence)}`} className="rounded-lg border border-red-200 p-2 text-red-700 disabled:cursor-not-allowed disabled:opacity-35 dark:border-red-900 dark:text-red-300"><Trash2 size={16} /></button>
                </div>
              </div>
            </article>
          ))}</div>
        )}
      </div>
    </section>
  );
}
