'use client';

import { useCallback, useEffect, useState } from "react";
import { BellRing, Loader2, Save } from "lucide-react";

const EMAIL_KEY = "dados-fii-wallet-email";
const TOKEN_KEY = "dados-fii-wallet-session";

type PreferencePayload = {
  ok: boolean;
  isPaid: boolean;
  plan: "free" | "premium" | "super_premium";
  planLabel: string;
  thresholdPercent: number;
  minimumPercent: number;
  maximumPercent: number;
  error?: string;
};

function credentials() {
  if (typeof window === "undefined") return { email: "", sessionToken: "" };
  return {
    email: String(window.localStorage.getItem(EMAIL_KEY) || "").trim().toLowerCase(),
    sessionToken: String(window.localStorage.getItem(TOKEN_KEY) || ""),
  };
}

async function requestPreferences(action: "load" | "save", thresholdPercent?: number) {
  const response = await fetch("/api/wallet/notification-preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...credentials(), action, patrimonyChangeThresholdPercent: thresholdPercent }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Não foi possível configurar as notificações.");
  return payload as PreferencePayload;
}

export default function PortfolioNotificationPreferences() {
  const [preferences, setPreferences] = useState<PreferencePayload | null>(null);
  const [threshold, setThreshold] = useState("3");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const current = credentials();
    if (!current.email || !current.sessionToken) {
      setPreferences(null);
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const payload = await requestPreferences("load");
      setPreferences(payload);
      setThreshold(String(payload.thresholdPercent).replace(".", ","));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar a configuração.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("dados-fii-wallet-session-updated", load);
    return () => window.removeEventListener("dados-fii-wallet-session-updated", load);
  }, [load]);

  async function save() {
    const parsed = Number(threshold.replace(",", "."));
    if (!preferences?.isPaid || !Number.isFinite(parsed)) return;
    setLoading(true);
    setMessage("");
    try {
      const payload = await requestPreferences("save", parsed);
      setPreferences((current) => current ? { ...current, ...payload } : payload);
      setThreshold(String(payload.thresholdPercent).replace(".", ","));
      setMessage("Limite patrimonial atualizado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar a configuração.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto mb-6 w-full max-w-6xl rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-700"><BellRing size={14} /> Notificações da carteira</p>
          <h2 className="mt-3 text-xl font-black text-slate-900">Avise apenas quando houver uma mudança relevante</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Um novo rendimento anunciado ou alterado continua gerando aviso. Quando os rendimentos não mudarem, o site só notificará se o patrimônio acumular alta ou queda igual ou superior ao limite.</p>
        </div>
        {preferences && <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700 ring-1 ring-slate-200">Plano {preferences.planLabel}</span>}
      </div>

      {!preferences && !loading ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-600 ring-1 ring-slate-200">Confirme seu e-mail no bloco “Salve sua carteira” para ver e configurar este limite.</p>
      ) : null}

      {preferences ? (
        <div className="mt-5 rounded-2xl bg-indigo-50/70 p-4 ring-1 ring-indigo-100">
          {preferences.isPaid ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="block w-full text-sm font-bold text-slate-700 sm:w-48">
                Variação patrimonial para notificar
                <span className="mt-1 flex items-center rounded-xl bg-white px-3 ring-1 ring-indigo-200">
                  <input type="number" min={preferences.minimumPercent} max={preferences.maximumPercent} step="0.1" value={threshold.replace(",", ".")} onChange={(event) => setThreshold(event.target.value.replace(".", ","))} className="min-w-0 w-full bg-transparent py-3 text-base font-black text-slate-900 outline-none" />
                  <span className="font-black text-slate-500">%</span>
                </span>
              </label>
              <button type="button" onClick={save} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60">{loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar limite</button>
            </div>
          ) : (
            <p className="text-sm font-bold leading-6 text-indigo-950">No plano Grátis, o limite é fixo em <strong>{preferences.thresholdPercent}%</strong>. Planos Premium e Super Premium podem escolher um valor entre 0,5% e 20%.</p>
          )}
        </div>
      ) : null}
      {loading && !preferences ? <p className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-slate-500"><Loader2 size={16} className="animate-spin" /> Carregando configuração…</p> : null}
      {message ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-700 ring-1 ring-slate-200">{message}</p> : null}
    </section>
  );
}
