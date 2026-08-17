"use client";

import Link from "next/link";
import { Bell, BellOff, ExternalLink, Loader2, Radar, RefreshCw, Search, Trash2 } from "lucide-react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { fundRadarRequest } from "@/lib/fund-radar/FundRadarClient";

type RadarFund = Readonly<{
  ticker: string;
  status: "active" | "paused_by_plan" | "in_portfolio";
  notificationsEnabled: boolean;
  name: string | null;
  segment: string | null;
  type: string | null;
  quality: { status: string; confidence: number | null; missingFields: string[]; invalidFields: string[] };
  lastDividend: { competence: string; amount: number; paymentDate: string | null; source: string } | null;
  recentEvents: Array<{ id: string; title: string; type: string; source: string; asOf: string | null; url: string | null }>;
  signals: { riskScore: number | null; confidence: number | null; level: string | null; reasons: string[] };
  asOf: string | null;
  insufficientData: boolean;
  dataUnavailable: boolean;
}>;

type RadarUpdate = Readonly<{
  fingerprint: string;
  ticker: string;
  title: string;
  whatChanged: string;
  whyItMatters: string;
  source: string;
  asOf: string | null;
  missingData: string[];
  createdAt: string;
}>;

type RadarPayload = Readonly<{
  plan: "free" | "premium" | "super_premium";
  planLabel: string;
  limit: number;
  activeCount: number;
  funds: RadarFund[];
  updates: RadarUpdate[];
}>;

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

function date(value: string | null) {
  if (!value) return "Data-base não informada";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(parsed) : value;
}

function statusLabel(status: RadarFund["status"]) {
  if (status === "paused_by_plan") return "Pausado pelo plano";
  if (status === "in_portfolio") return "Acompanhado pela Inteligência da Carteira";
  return "Ativo";
}

export default function FundRadarPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<RadarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [ticker, setTicker] = useState("");
  const [message, setMessage] = useState("");
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [disabled, setDisabled] = useState(false);

  const load = useCallback(async (currentUser: User | null) => {
    setLoading(true);
    setMessage("");
    try {
      const payload = await fundRadarRequest(currentUser, "/api/fund-radar") as unknown as RadarPayload;
      setData(payload);
      setRequiresAuth(false);
    } catch (error) {
      if (error instanceof Error && error.name === "FUND_RADAR_DISABLED") setDisabled(true);
      else if (error instanceof Error && error.name === "FUND_RADAR_AUTH_REQUIRED") setRequiresAuth(true);
      else setMessage(error instanceof Error ? error.message : "Não foi possível carregar o Radar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => onAuthStateChanged(auth, (currentUser) => {
    setUser(currentUser);
    void load(currentUser);
  }), [load]);

  async function mutate(ticker: string, method: "PATCH" | "DELETE", notificationsEnabled?: boolean) {
    setBusy(`${method}:${ticker}`);
    setMessage("");
    try {
      await fundRadarRequest(user, "/api/fund-radar", {
        method,
        body: method === "PATCH" ? { ticker, notificationsEnabled } : { ticker },
      });
      await load(user);
      setMessage(method === "DELETE" ? `${ticker} removido do Radar.` : "Preferência de notificações atualizada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar o Radar.");
    } finally {
      setBusy("");
    }
  }

  async function refresh() {
    setBusy("refresh");
    setMessage("");
    try {
      await fundRadarRequest(user, "/api/fund-radar/refresh", { method: "POST" });
      await load(user);
      setMessage("Radar atualizado com as fontes disponíveis.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar o Radar.");
    } finally {
      setBusy("");
    }
  }

  async function follow(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTicker = ticker.trim().toUpperCase();
    if (!normalizedTicker || busy) return;
    setBusy(`POST:${normalizedTicker}`);
    setMessage("");
    try {
      await fundRadarRequest(user, "/api/fund-radar", {
        method: "POST",
        body: { ticker: normalizedTicker },
      });
      setTicker("");
      await load(user);
      setMessage(`${normalizedTicker} adicionado ao Radar.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível acompanhar o fundo.");
    } finally {
      setBusy("");
    }
  }

  if (disabled) return <p className="rounded-2xl bg-slate-100 p-5 text-sm font-bold text-slate-700">O Radar está temporariamente indisponível.</p>;
  if (loading) return <div className="flex min-h-48 items-center justify-center"><Loader2 className="animate-spin text-indigo-600" aria-label="Carregando Radar" /></div>;
  if (requiresAuth) return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-xl font-black text-slate-900">Confirme seu acesso</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Use a autenticação da carteira para manter seus fundos acompanhados isolados e protegidos.</p>
      <Link href="/carteira" className="mt-4 inline-flex rounded-full bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700">Ir para a carteira</Link>
    </section>
  );

  return (
    <div className="space-y-6" data-testid="fund-radar-panel">
      <section className="flex flex-col justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-indigo-700">Plano {data?.planLabel || "Grátis"}</p>
          <h2 className="mt-1 text-xl font-black text-slate-900">{data?.activeCount || 0} de {data?.limit || 1} fundos ativos</h2>
          <p className="mt-1 text-sm text-slate-600">Itens pausados ou que entraram na carteira não consomem o limite ativo.</p>
        </div>
        <button type="button" onClick={refresh} disabled={busy === "refresh"} className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60">
          <RefreshCw size={16} className={busy === "refresh" ? "animate-spin" : ""} aria-hidden="true" /> Atualizar Radar
        </button>
      </section>

      <form onSubmit={follow} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <label htmlFor="radar-ticker" className="text-sm font-extrabold text-slate-900">Acompanhar um fundo fora da carteira</label>
        <p className="mt-1 text-sm text-slate-600">Informe o ticker. O servidor confirma o fundo, o plano e o limite antes de incluí-lo.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            id="radar-ticker"
            name="ticker"
            value={ticker}
            onChange={(event) => setTicker(event.target.value.toUpperCase())}
            autoComplete="off"
            inputMode="text"
            maxLength={12}
            placeholder="Ex.: MXRF11"
            className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold uppercase text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
          <button type="submit" disabled={!ticker.trim() || Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
            {busy.startsWith("POST:") ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />} Acompanhar
          </button>
        </div>
      </form>

      {message && <p role="status" className="rounded-xl bg-indigo-50 p-3 text-sm font-bold text-indigo-900 ring-1 ring-indigo-100">{message}</p>}

      {!data?.funds.length ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <Radar className="mx-auto text-indigo-600" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-black text-slate-900">Seu Radar está vazio</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">Abra a página de um fundo que ainda não está na carteira e use “Acompanhar”. O Radar informa mudanças; ele não recomenda comprar ou vender.</p>
          <Link href="/" className="mt-4 inline-flex rounded-full bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700">Consultar fundos</Link>
        </section>
      ) : (
        <section aria-labelledby="radar-funds-title">
          <h2 id="radar-funds-title" className="text-2xl font-black text-slate-900">Fundos acompanhados</h2>
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            {data.funds.map((fund) => (
              <article key={fund.ticker} className="rounded-2xl bg-gray-950 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/fii/${fund.ticker}`} className="text-2xl font-black text-white hover:text-indigo-300">{fund.ticker}</Link>
                    <p className="mt-1 text-sm text-gray-300">{fund.name || "Nome não disponível"}</p>
                  </div>
                  <span className="rounded-full bg-indigo-950 px-3 py-1 text-xs font-extrabold text-indigo-200 ring-1 ring-indigo-800">{statusLabel(fund.status)}</span>
                </div>

                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Data label="Segmento" value={fund.segment} />
                  <Data label="Tipo" value={fund.type} />
                  <Data label="Qualidade/cobertura" value={`${fund.quality.status}${fund.quality.confidence === null ? "" : ` · ${fund.quality.confidence}%`}`} />
                  <Data label="Data-base" value={date(fund.asOf)} />
                  <Data label="Último dividendo" value={fund.lastDividend ? `${currency(fund.lastDividend.amount)} · ${fund.lastDividend.competence}` : null} />
                  <Data label="Sinal de risco" value={fund.signals.riskScore === null ? null : `${fund.signals.riskScore}/100 · ${fund.signals.level || "sem faixa"}`} />
                </dl>

                {fund.insufficientData && (
                  <div className="mt-4 rounded-xl bg-amber-950/50 p-3 text-sm text-amber-100 ring-1 ring-amber-800/60">
                    <strong>Dados insuficientes ou parciais.</strong>
                    <p className="mt-1">{[...fund.quality.missingFields, ...fund.quality.invalidFields].slice(0, 6).join(", ") || "A fonte ainda não informou todos os campos necessários."}</p>
                  </div>
                )}

                <div className="mt-4">
                  <h3 className="font-extrabold text-white">Principais riscos e sinais</h3>
                  {fund.signals.reasons.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-300">{fund.signals.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : <p className="mt-2 text-sm text-gray-400">Sinais determinísticos indisponíveis.</p>}
                </div>

                <div className="mt-4">
                  <h3 className="font-extrabold text-white">Eventos e fatos relevantes</h3>
                  {fund.recentEvents.length ? <ul className="mt-2 space-y-2">{fund.recentEvents.map((event) => <li key={event.id} className="rounded-xl bg-gray-900 p-3 text-sm"><span className="font-bold text-gray-100">{event.title}</span><span className="mt-1 block text-xs text-gray-400">{event.source} · {date(event.asOf)}</span>{event.url && <a href={event.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 font-bold text-indigo-300">Abrir fonte <ExternalLink size={13} aria-hidden="true" /></a>}</li>)}</ul> : <p className="mt-2 text-sm text-gray-400">Nenhum evento recente disponível nas fontes canônicas.</p>}
                </div>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-800 pt-4">
                  <button type="button" onClick={() => mutate(fund.ticker, "PATCH", !fund.notificationsEnabled)} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-full bg-gray-800 px-4 py-2 text-sm font-bold text-gray-100 hover:bg-gray-700 disabled:opacity-60">
                    {fund.notificationsEnabled ? <Bell size={15} aria-hidden="true" /> : <BellOff size={15} aria-hidden="true" />} {fund.notificationsEnabled ? "Desativar notificações" : "Ativar notificações"}
                  </button>
                  <button type="button" onClick={() => mutate(fund.ticker, "DELETE")} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-full bg-red-950 px-4 py-2 text-sm font-bold text-red-100 hover:bg-red-900 disabled:opacity-60">
                    <Trash2 size={15} aria-hidden="true" /> Deixar de acompanhar
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="radar-updates-title" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 id="radar-updates-title" className="text-2xl font-black text-slate-900">O que mudou</h2>
        <p className="mt-1 text-sm text-slate-600">Somente eventos novos e materialmente diferentes aparecem aqui.</p>
        {!data?.updates.length ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-medium text-slate-600">Nenhuma atualização nova desde a referência inicial.</p> : <div className="mt-4 space-y-3">{data.updates.map((update) => <article key={update.fingerprint} className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-extrabold uppercase tracking-wide text-indigo-700">{update.ticker} · {date(update.asOf || update.createdAt)}</p><h3 className="mt-1 font-black text-slate-900">{update.title}</h3><p className="mt-2 text-sm leading-6 text-slate-700"><strong>O que mudou:</strong> {update.whatChanged}</p><p className="mt-1 text-sm leading-6 text-slate-700"><strong>Por que merece atenção:</strong> {update.whyItMatters}</p><p className="mt-2 text-xs font-bold text-slate-500">Fonte: {update.source}</p>{update.missingData.length > 0 && <p className="mt-2 text-xs text-amber-800">Dados ainda ausentes: {update.missingData.join(", ")}</p>}</article>)}</div>}
      </section>
    </div>
  );
}

function Data({ label, value }: { label: string; value: string | null }) {
  return <div className="rounded-xl bg-gray-900 p-3"><dt className="text-xs font-extrabold uppercase tracking-wide text-gray-400">{label}</dt><dd className="mt-1 text-sm font-bold text-gray-100">{value ?? "Dados insuficientes"}</dd></div>;
}
