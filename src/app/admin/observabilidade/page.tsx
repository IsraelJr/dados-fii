"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, BarChart3, CheckCircle2, Clock, Database, Eye, FileText, Home, KeyRound, Menu, RefreshCw, Search, ShieldCheck, XCircle } from "lucide-react";

type Service = { key: string; label: string; ok: boolean; detail?: string };
type LookupEvent = { id: string; type?: string; ok: boolean; statusCode: number; ticker?: string | null; error?: string | null; source?: string | null; createdAt?: string | null };
type ObservabilityPayload = {
  ok: boolean;
  generatedAt: string;
  health: { score: number; healthyServices: number; totalServices: number; services: Service[] };
  traffic?: { ok: boolean; visits: number; searches: number; error?: string };
  lookups?: { total: number; success: number; errors: number; notFound: number; successRate: number; recent: LookupEvent[]; byTicker: Array<{ ticker: string; total: number; success: number; errors: number; lastStatusCode: number; lastAt?: string | null }> };
  reports?: { ok: boolean; totalSample: number; done: number; pending: number; failed: number; latest?: { id: string; status?: string | null; month?: string | null; updatedAt?: string | null }; error?: string };
  benchmarks?: any;
  recentEvents?: LookupEvent[];
};

const SESSION_TIMEOUT_MS = 60 * 1000;
const adminLinks = [
  { href: "/admin/observabilidade", label: "Observabilidade", icon: Eye },
  { href: "/api/admin/observability", label: "API observability", icon: Activity },
  { href: "/api/admin/diagnose-data-sources", label: "Diagnóstico de dados", icon: Database },
  { href: "/api/admin/diagnose-market-benchmarks", label: "Benchmarks", icon: BarChart3 },
  { href: "/", label: "Voltar ao site", icon: Home },
];

function allowedAdminEmails() {
  return String(process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch { return "-"; }
}

function statusLabel(statusCode?: number) {
  if (!statusCode) return "Sem status";
  if (statusCode < 300) return "Sucesso";
  if (statusCode === 404) return "Não encontrado";
  if (statusCode < 500) return "Erro de uso";
  return "Erro interno";
}

function valueColor(kind: "success" | "error" | "neutral") {
  if (kind === "success") return "text-emerald-600";
  if (kind === "error") return "text-red-600";
  return "text-indigo-700";
}

function statusClasses(ok?: boolean, statusCode?: number) {
  if (ok && Number(statusCode || 0) < 400) return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (statusCode === 404) return "bg-amber-50 text-amber-800 ring-amber-100";
  return "bg-red-50 text-red-700 ring-red-100";
}

function HealthBadge({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${ok ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-red-50 text-red-700 ring-red-100"}`}>
      {ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}{ok ? "OK" : "Atenção"}
    </span>
  );
}

function MetricCard({ title, value, detail, icon: Icon, kind = "neutral" }: { title: string; value: string | number; detail?: string; icon: any; kind?: "success" | "error" | "neutral" }) {
  return (
    <article className="rounded-3xl bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-5 shadow-sm ring-1 ring-indigo-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-indigo-700">{title}</p>
          <strong className={`mt-2 block text-3xl font-black ${valueColor(kind)}`}>{value}</strong>
        </div>
        <div className="rounded-2xl bg-white p-3 text-indigo-700 shadow-sm ring-1 ring-indigo-100"><Icon size={20} /></div>
      </div>
      {detail && <p className="mt-3 text-sm leading-5 text-slate-600">{detail}</p>}
    </article>
  );
}

function AdminSidebar({ open, onToggle, onLogout }: { open: boolean; onToggle: () => void; onLogout: () => void }) {
  return (
    <aside className={`fixed left-0 top-0 z-50 h-screen bg-gray-950 text-white shadow-2xl transition-all ${open ? "w-72" : "w-16"}`}>
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-3">
        {open && <strong className="text-sm">Admin Dados FII</strong>}
        <button type="button" onClick={onToggle} className="rounded-xl bg-white/10 p-2 hover:bg-white/15" aria-label="Abrir menu admin"><Menu size={20} /></button>
      </div>
      <nav className="grid gap-2 p-3">
        {adminLinks.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold text-gray-200 hover:bg-white/10">
            <Icon size={18} className="shrink-0" />{open && <span>{label}</span>}
          </Link>
        ))}
        <button type="button" onClick={onLogout} className="mt-4 flex items-center gap-3 rounded-2xl bg-red-500/10 px-3 py-3 text-sm font-bold text-red-100 hover:bg-red-500/20">
          <KeyRound size={18} className="shrink-0" />{open && <span>Bloquear agora</span>}
        </button>
      </nav>
    </aside>
  );
}

export default function AdminObservabilityPage() {
  const [secret, setSecret] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [allowedEmail, setAllowedEmail] = useState(false);
  const [data, setData] = useState<ObservabilityPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const email = String(window.localStorage.getItem("dados-fii-wallet-email") || "").trim().toLowerCase();
    setAllowedEmail(Boolean(email && allowedAdminEmails().includes(email)));
  }, []);

  function logout(message = "Sessão admin bloqueada. Informe a senha novamente.") {
    setAuthenticated(false);
    setData(null);
    setSecret("");
    setError(message);
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  function touchActivity() {
    if (!authenticated) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => logout("Timeout de inatividade: 1 minuto sem uso."), SESSION_TIMEOUT_MS);
  }

  useEffect(() => {
    if (!authenticated) return;
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, touchActivity, { passive: true }));
    touchActivity();
    return () => {
      events.forEach((event) => window.removeEventListener(event, touchActivity));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [authenticated]);

  async function loadData(secretValue = secret) {
    if (!secretValue.trim()) { setError("Informe a senha admin para carregar a observabilidade."); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/observability", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ secret: secretValue.trim() }) });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.health) throw new Error(json?.error || "Não foi possível carregar observabilidade.");
      setAuthenticated(true); setData(json); setSecret("");
    } catch (err: any) {
      setAuthenticated(false); setData(null); setError(err.message || "Não foi possível carregar observabilidade.");
    } finally { setLoading(false); }
  }

  const expandedEvents = useMemo(() => {
    if (!expandedTicker) return [];
    return data?.recentEvents?.filter((event) => String(event.ticker || "").toUpperCase() === expandedTicker) || [];
  }, [data, expandedTicker]);

  const lookupSummary = data?.lookups;
  const reportSummary = data?.reports;
  const health = data?.health;

  if (!allowedEmail) {
    return <main className="mx-auto max-w-3xl px-4 py-12"><section className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200"><ShieldCheck className="mx-auto text-indigo-700" /><h1 className="mt-4 text-2xl font-black text-slate-900">Acesso admin restrito</h1><p className="mt-2 text-sm text-slate-600">Esta área só aparece para e-mails autorizados no navegador.</p><Link href="/" className="mt-5 inline-flex rounded-full bg-indigo-600 px-4 py-2 text-sm font-bold text-white">Voltar ao site</Link></section></main>;
  }

  return (
    <main className={`min-h-screen px-4 py-8 transition-all ${authenticated ? (sidebarOpen ? "md:pl-80" : "md:pl-24") : ""}`}>
      {authenticated && <AdminSidebar open={sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)} onLogout={() => logout()} />}

      <section className="rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-800 to-blue-900 p-6 text-white shadow-lg ring-1 ring-white/10 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-100"><Eye size={14} /> Admin</p>
            <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">Observabilidade da aplicação</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-indigo-100">Saúde do sistema, benchmarks, pesquisas de FIIs, erros recentes, relatórios e bases principais.</p>
            {authenticated && <p className="mt-3 text-xs font-bold text-indigo-100">Timeout de inatividade: 1 minuto. A senha não fica salva.</p>}
          </div>

          {!authenticated && (
            <div className="grid gap-2 rounded-2xl bg-white/10 p-3 ring-1 ring-white/10 sm:grid-cols-[1fr_auto] lg:min-w-[420px]">
              <input type="password" value={secret} onChange={(event) => setSecret(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") loadData(); }} placeholder="Senha admin" className="min-h-11 rounded-xl border border-white/10 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-300" />
              <button type="button" onClick={() => loadData()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-extrabold text-indigo-800 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:bg-gray-300"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Entrar</button>
            </div>
          )}

          {authenticated && <button type="button" onClick={() => loadData(secret)} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-extrabold text-indigo-800 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:bg-gray-300"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Atualizar</button>}
        </div>
      </section>

      {error && <section className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-800 ring-1 ring-red-100">{error}</section>}
      {!data && !error && <section className="mt-6 rounded-2xl bg-white p-6 text-center text-sm font-bold text-slate-500 shadow-sm ring-1 ring-slate-200">Informe a senha admin para carregar o painel.</section>}

      {data && (
        <div className="mt-6 space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Saúde geral" value={`${health?.score || 0}%`} detail={`${health?.healthyServices || 0} de ${health?.totalServices || 0} serviços OK`} icon={ShieldCheck} kind={(health?.score || 0) >= 90 ? "success" : "error"} />
            <MetricCard title="Pesquisas monitoradas" value={lookupSummary?.total || 0} detail={`${lookupSummary?.success || 0} sucesso · ${lookupSummary?.errors || 0} erro(s)`} icon={Search} kind={(lookupSummary?.errors || 0) > 0 ? "error" : "success"} />
            <MetricCard title="Taxa de sucesso" value={`${lookupSummary?.successRate || 0}%`} detail={`${lookupSummary?.notFound || 0} erro(s) 404 nas últimas consultas`} icon={BarChart3} kind={(lookupSummary?.successRate || 0) >= 90 ? "success" : "error"} />
            <MetricCard title="Relatórios" value={reportSummary?.done || 0} detail={`${reportSummary?.pending || 0} pendente(s) · ${reportSummary?.failed || 0} falha(s)`} icon={FileText} kind={(reportSummary?.failed || 0) > 0 ? "error" : "success"} />
          </section>

          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-indigo-100">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-700"><Activity size={14} /> Saúde do sistema</p><h2 className="mt-3 text-2xl font-black text-slate-900">Serviços principais</h2></div><p className="text-xs font-bold text-slate-500">Atualizado em {formatDateTime(data.generatedAt)}</p></div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{health?.services.map((service) => <article key={service.key} className="rounded-2xl bg-indigo-50/40 p-4 ring-1 ring-indigo-100"><div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold text-slate-900">{service.label}</h3><p className="mt-1 text-sm leading-5 text-slate-600">{service.detail || "Sem detalhe"}</p></div><HealthBadge ok={service.ok} /></div></article>)}</div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-indigo-100"><p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-700"><Search size={14} /> Pesquisas de FIIs</p><h2 className="mt-3 text-2xl font-black text-slate-900">Últimas consultas monitoradas</h2><p className="mt-1 text-sm text-slate-500">Exemplo: 10 pesquisas, 9 com sucesso e 1 com erro 404.</p><div className="mt-5 overflow-hidden rounded-2xl ring-1 ring-indigo-100"><table className="w-full text-left text-sm"><thead className="bg-indigo-50 text-xs uppercase tracking-wide text-indigo-700"><tr><th className="px-4 py-3">Ticker</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Quando</th><th className="px-4 py-3">Detalhe</th></tr></thead><tbody className="divide-y divide-indigo-50 bg-white">{(lookupSummary?.recent || []).map((event) => <tr key={event.id} className="align-top"><td className="px-4 py-3 font-black text-slate-900">{event.ticker || "-"}</td><td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${statusClasses(event.ok, event.statusCode)}`}>{event.statusCode} · {statusLabel(event.statusCode)}</span></td><td className="px-4 py-3 text-slate-600">{formatDateTime(event.createdAt)}</td><td className="px-4 py-3 text-slate-600">{event.error || event.source || "Consulta realizada"}</td></tr>)}{!(lookupSummary?.recent || []).length && <tr><td className="px-4 py-6 text-center text-sm font-bold text-slate-500" colSpan={4}>Ainda não há eventos monitorados. Faça buscas de FIIs após o deploy para alimentar este painel.</td></tr>}</tbody></table></div></article>
            <aside className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-indigo-100"><p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-700"><AlertTriangle size={14} /> Clique para detalhar</p><h2 className="mt-3 text-2xl font-black text-slate-900">Tickers mais consultados</h2><div className="mt-5 grid gap-3">{(lookupSummary?.byTicker || []).map((item) => <button key={item.ticker} type="button" onClick={() => setExpandedTicker(expandedTicker === item.ticker ? null : item.ticker)} className="rounded-2xl bg-indigo-50/50 p-4 text-left ring-1 ring-indigo-100 hover:bg-indigo-50"><div className="flex items-center justify-between gap-3"><strong className="text-lg text-slate-900">{item.ticker}</strong><span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${item.errors ? "bg-red-50 text-red-700 ring-red-100" : "bg-emerald-50 text-emerald-700 ring-emerald-100"}`}>{item.success}/{item.total} OK</span></div><p className="mt-1 text-xs text-slate-500">Último status: {item.lastStatusCode || "-"} · {formatDateTime(item.lastAt)}</p></button>)}{!(lookupSummary?.byTicker || []).length && <p className="rounded-2xl bg-indigo-50/50 p-4 text-sm font-bold text-slate-500 ring-1 ring-indigo-100">Sem tickers monitorados ainda.</p>}</div>{expandedTicker && <div className="mt-5 rounded-2xl bg-indigo-950 p-4 text-indigo-50"><h3 className="font-extrabold">Detalhes de {expandedTicker}</h3><div className="mt-3 space-y-2">{expandedEvents.map((event) => <div key={event.id} className="rounded-xl bg-white/10 p-3 text-xs leading-5"><p className="font-bold">{event.statusCode} · {statusLabel(event.statusCode)}</p><p className="text-indigo-100">{formatDateTime(event.createdAt)} · {event.error || event.source || "Consulta realizada"}</p></div>)}{!expandedEvents.length && <p className="text-sm text-indigo-100">Sem eventos recentes para este ticker.</p>}</div></div>}</aside>
          </section>

          <section className="grid gap-6 xl:grid-cols-3"><article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-indigo-100 xl:col-span-2"><p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-700"><Database size={14} /> Benchmarks e dados</p><h2 className="mt-3 text-2xl font-black text-slate-900">Validações de mercado</h2><div className="mt-5 grid gap-3 md:grid-cols-2"><BenchmarkCard title="IFIX" ok={Boolean(data.benchmarks?.ifix?.ok)} detail={data.benchmarks?.ifix?.currentReady ? `Fechamento ${data.benchmarks.ifix.close} em ${data.benchmarks.ifix.lastDate} (${data.benchmarks.ifix.provider || "fonte"})` : "Sem fechamento atual"} /><BenchmarkCard title="CDI" ok={Boolean(data.benchmarks?.cdi?.ok)} detail={data.benchmarks?.cdi?.lastDate ? `Último dado: ${data.benchmarks.cdi.lastDate}` : "Indisponível"} /><BenchmarkCard title="IPCA" ok={Boolean(data.benchmarks?.ipca?.ok)} detail={data.benchmarks?.ipca?.lastDate ? `Último dado: ${data.benchmarks.ipca.lastDate}` : "Indisponível"} /><BenchmarkCard title="Selic" ok={Boolean(data.benchmarks?.selic?.ok)} detail={data.benchmarks?.selic?.rate ? `${data.benchmarks.selic.rate}% em ${data.benchmarks.selic.date}` : "Indisponível"} /></div></article><article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-indigo-100"><p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-700"><Clock size={14} /> Relatórios</p><h2 className="mt-3 text-2xl font-black text-slate-900">Risco da carteira</h2><div className="mt-5 grid gap-3"><MiniMetric label="Amostra" value={reportSummary?.totalSample || 0} /><MiniMetric label="Concluídos" value={reportSummary?.done || 0} /><MiniMetric label="Pendentes" value={reportSummary?.pending || 0} /><MiniMetric label="Falhas" value={reportSummary?.failed || 0} error={Boolean(reportSummary?.failed)} /></div>{reportSummary?.latest && <p className="mt-4 text-xs leading-5 text-slate-500">Último: {reportSummary.latest.status || "-"} · {reportSummary.latest.month || "sem mês"} · {formatDateTime(reportSummary.latest.updatedAt)}</p>}</article></section>

          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-indigo-100"><h2 className="text-2xl font-black text-slate-900">Eventos recentes</h2><div className="mt-5 grid gap-2">{(data.recentEvents || []).map((event) => <div key={event.id} className="flex flex-col gap-2 rounded-2xl bg-indigo-50/50 p-3 text-sm ring-1 ring-indigo-100 md:flex-row md:items-center md:justify-between"><div><strong className="text-slate-900">{event.type || "evento"}</strong><span className="ml-2 text-slate-500">{event.ticker || event.source || "sistema"}</span></div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${statusClasses(event.ok, event.statusCode)}`}>{event.statusCode || "-"}</span><span className="text-xs text-slate-500">{formatDateTime(event.createdAt)}</span></div></div>)}</div></section>
        </div>
      )}
    </main>
  );
}

function BenchmarkCard({ title, ok, detail }: { title: string; ok: boolean; detail: string }) { return <div className="rounded-2xl bg-indigo-50/40 p-4 ring-1 ring-indigo-100"><div className="flex items-start justify-between gap-3"><div><p className="font-extrabold text-slate-900">{title}</p><p className="mt-1 text-sm leading-5 text-slate-600">{detail}</p></div><HealthBadge ok={ok} /></div></div>; }
function MiniMetric({ label, value, error = false }: { label: string; value: string | number; error?: boolean }) { return <div className="flex items-center justify-between rounded-2xl bg-indigo-50/40 p-3 ring-1 ring-indigo-100"><span className="text-sm font-bold text-slate-600">{label}</span><strong className={`text-lg ${error ? "text-red-600" : "text-emerald-600"}`}>{value}</strong></div>; }
