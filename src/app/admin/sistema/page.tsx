"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Activity, BellRing, CheckCircle2, Database, FileClock, Gauge, History, Home, LogOut, PlayCircle, RefreshCw, RotateCcw, ShieldCheck, Stethoscope, UploadCloud } from "lucide-react";
import { auth } from "@/lib/firebase";
import type { ParserHealth, SystemHealth, ValidationRun } from "@/types/regulatory";
import type { SystemObservability } from "@/types/observability";
import type { MonitorStatus } from "@/types/monitor";

const INACTIVITY_MS = 60_000;

type DashboardData = {
  health: SystemHealth | null;
  parsers: ParserHealth[];
  history: ValidationRun[];
  observability: SystemObservability | null;
  monitor: MonitorStatus | null;
};

async function post<T>(url: string, body: Record<string, unknown> = {}) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Falha HTTP ${response.status}`);
  return payload as T;
}

async function get<T>(url: string) {
  const response = await fetch(url, { method: "GET", credentials: "same-origin", cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Falha HTTP ${response.status}`);
  return payload as T;
}

function dateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function statusStyle(status: ParserHealth["status"]) {
  if (status === "healthy") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "degraded") return "bg-amber-50 text-amber-800 ring-amber-100";
  return "bg-red-50 text-red-700 ring-red-100";
}

export default function AdminSystemPage() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [runningMonitor, setRunningMonitor] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<DashboardData>({ health: null, parsers: [], history: [], observability: null, monitor: null });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocked = useRef(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [healthPayload, parserPayload, historyPayload, observabilityPayload, monitorPayload] = await Promise.all([
        get<{ health: SystemHealth }>("/api/admin/system/health"),
        get<{ parsers: ParserHealth[] }>("/api/admin/system/parser-health"),
        get<{ history: ValidationRun[] }>("/api/admin/system/validation-history?limit=20"),
        get<{ observability: SystemObservability }>("/api/admin/system/observability"),
        get<{ monitor: MonitorStatus }>("/api/admin/system/monitor-status"),
      ]);
      setData({ health: healthPayload.health, parsers: parserPayload.parsers || [], history: historyPayload.history || [], observability: observabilityPayload.observability, monitor: monitorPayload.monitor });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar o painel.");
    } finally {
      setLoading(false);
    }
  }, []);

  const createSession = useCallback(async (user: User) => {
    const idToken = await user.getIdToken(true);
    const session = await post<{ email: string }>("/api/admin/session", { action: "login", idToken });
    setAdminEmail(session.email);
    await loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    let active = true;
    post<{ email: string }>("/api/admin/session", { action: "status" })
      .then(async (session) => {
        if (!active) return;
        setAdminEmail(session.email);
        await loadDashboard();
      })
      .catch(() => undefined)
      .finally(() => { if (active) setReady(true); });
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!active) return;
      setFirebaseUser(user);
      if (user && !adminEmail && !blocked.current) createSession(user).catch((caught) => setError(caught instanceof Error ? caught.message : "Acesso administrativo negado."));
    });
    return () => { active = false; unsubscribe(); };
  }, [adminEmail, createSession, loadDashboard]);

  const logout = useCallback(async (message?: string) => {
    blocked.current = true;
    await post("/api/admin/session", { action: "logout" }).catch(() => undefined);
    setAdminEmail("");
    setData({ health: null, parsers: [], history: [], observability: null, monitor: null });
    if (message) setError(message);
  }, []);

  useEffect(() => {
    if (!adminEmail) return;
    const touch = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => logout("Sessão bloqueada após 1 minuto sem atividade."), INACTIVITY_MS);
    };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, touch, { passive: true }));
    touch();
    return () => {
      events.forEach((event) => window.removeEventListener(event, touch));
      if (timer.current) clearTimeout(timer.current);
    };
  }, [adminEmail, logout]);

  async function runValidation() {
    setRunning(true);
    setError("");
    try {
      await post("/api/admin/system/run-validation", { limit: 400 });
      await loadDashboard();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "A validação falhou.");
    } finally {
      setRunning(false);
    }
  }

  async function runMonitor() {
    setRunningMonitor(true);
    setError("");
    try {
      await post("/api/admin/system/run-monitor");
      await loadDashboard();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "O monitor automático falhou.");
    } finally {
      setRunningMonitor(false);
    }
  }

  const latest = data.history[0] || null;
  const components = data.health?.components;

  if (!ready && !adminEmail) return <main className="grid min-h-screen place-items-center"><RefreshCw className="animate-spin text-indigo-700" /></main>;

  if (!adminEmail) {
    return (
      <main className="mx-auto grid min-h-screen max-w-3xl place-items-center px-4 py-12">
        <section className="w-full rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <ShieldCheck className="mx-auto text-indigo-700" size={42} />
          <h1 className="mt-4 text-3xl font-black text-slate-900">Admin protegido</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Entre no Dados FII com um e-mail verificado e cadastrado em <code>ADMIN_EMAILS</code>. A sessão administrativa será criada em cookie HttpOnly.</p>
          {firebaseUser && <button type="button" onClick={() => { blocked.current = false; createSession(firebaseUser); }} className="mt-6 rounded-full bg-indigo-700 px-5 py-3 text-sm font-extrabold text-white">Validar acesso de {firebaseUser.email}</button>}
          {!firebaseUser && <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-full bg-indigo-700 px-5 py-3 text-sm font-extrabold text-white"><Home size={16} /> Entrar no site</Link>}
          {error && <p className="mt-5 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-3xl bg-gradient-to-br from-indigo-800 to-blue-950 p-6 text-white shadow-lg md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="text-xs font-extrabold uppercase tracking-widest text-indigo-200">Fase 2 · Operação e Monitoramento</p><h1 className="mt-3 text-3xl font-black md:text-5xl">Saúde dos dados regulatórios</h1><p className="mt-3 text-sm text-indigo-100">{adminEmail} · sessão HttpOnly · bloqueio após 1 minuto sem atividade</p></div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={loadDashboard} disabled={loading} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-indigo-800 disabled:opacity-60"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Atualizar</button><button type="button" onClick={() => logout()} className="inline-flex items-center gap-2 rounded-full bg-red-500/20 px-4 py-2 text-sm font-extrabold text-white ring-1 ring-white/20"><LogOut size={16} /> Sair</button></div>
          </div>
        </header>

        {error && <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-800 ring-1 ring-red-100">{error}</div>}

        <section className="mt-6">
          <div className="mb-3"><p className="text-xs font-extrabold uppercase tracking-widest text-indigo-700">Resumo operacional</p><h2 className="mt-1 text-2xl font-black text-slate-900">Status dos sistemas</h2></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric title="Saúde" value={`${data.health?.score || 0}%`} detail={data.health?.ok ? "Sistema saudável" : `Status: ${data.health?.status || "unknown"}`} icon={Stethoscope} good={Boolean(data.health?.ok)} />
            <Metric title="Parser" value={`${components?.parser.score || 0}%`} detail={components?.parser.message || "Aguardando leitura"} icon={Activity} good={components?.parser.status === "healthy"} />
            <Metric title="Firestore" value={`${components?.firestore.score || 0}%`} detail={components?.firestore.message || "Aguardando leitura"} icon={Database} good={components?.firestore.status === "healthy"} />
            <Metric title="QA" value={`${components?.qa.score || 0}%`} detail={components?.qa.message || "Aguardando validação"} icon={CheckCircle2} good={components?.qa.status === "healthy"} />
            <Metric title="Publicação" value={`${components?.publication.score || 0}%`} detail={components?.publication.message || "Nenhum evento"} icon={UploadCloud} good={components?.publication.status === "healthy"} />
            <Metric title="Rollback" value={`${components?.rollback.score || 0}%`} detail={components?.rollback.message || "Nenhum evento"} icon={RotateCcw} good={components?.rollback.status === "healthy" || components?.rollback.status === "unknown"} />
            <Metric title="Histórico" value={data.history.length} detail={latest ? `Última execução: ${dateTime(latest.finishedAt)}` : "Nenhuma validação registrada"} icon={FileClock} good={latest?.status === "completed"} />
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-wide text-indigo-700">Validação completa</p><h2 className="mt-2 text-2xl font-black text-slate-900">FII + FIAGRO</h2><p className="mt-1 text-sm text-slate-600">Valida tipagem, CNPJ, identificação, segmento e proveniência.</p></div><button type="button" onClick={runValidation} disabled={running} className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-700 px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60"><RefreshCw size={16} className={running ? "animate-spin" : ""} /> {running ? "Validando…" : "Executar validação"}</button></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3"><Small label="Última execução" value={dateTime(latest?.finishedAt)} /><Small label="Duração" value={latest ? `${(latest.durationMs / 1000).toFixed(1)}s` : "-"} /><Small label="Responsável" value={latest?.actor || "-"} /></div>
          </article>

          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><p className="text-xs font-extrabold uppercase tracking-wide text-indigo-700">Cache & Score</p><h2 className="mt-2 text-2xl font-black text-slate-900">RegulatoryDataService</h2><div className="mt-5 grid gap-3 sm:grid-cols-2"><Small label="Entradas" value={data.health?.cache.entries ?? 0} /><Small label="Hit rate" value={`${data.health?.cache.funds.hitRate || 0}%`} /><Small label="TTL dos fundos" value={`${Math.round((data.health?.cache.ttlMs || 0) / 1000)}s`} /><Small label="Score Engine" value={`${components?.score.score || 0}%`} /></div></article>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-2"><Gauge className="text-indigo-700" /><h2 className="text-2xl font-black text-slate-900">Observabilidade</h2></div>
            <p className="mt-2 text-sm text-slate-600">Tempo, retries, falhas, ingestão, parser, QA e publicação.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Small label="Tempo médio" value={`${data.observability?.summary.averageDurationMs || 0}ms`} />
              <Small label="Retries" value={data.observability?.summary.retries || 0} />
              <Small label="Falhas" value={data.observability?.summary.failures || 0} />
              <Small label="Ingestão" value={data.observability?.ingestion.processed || 0} />
              <Small label="Parser" value={`${data.observability?.parser.successRate || 0}%`} />
              <Small label="QA" value={`${data.observability?.qa.healthScore || 0}%`} />
              <Small label="Publicações" value={data.observability?.publication.publications || 0} />
              <Small label="Rollbacks" value={data.observability?.publication.rollbacks || 0} />
            </div>
          </article>

          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-indigo-700"><BellRing size={15} /> Monitor Automático</p><h2 className="mt-2 text-2xl font-black text-slate-900">Alertas sistêmicos</h2></div><button type="button" onClick={runMonitor} disabled={runningMonitor} className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-700 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"><PlayCircle size={16} /> {runningMonitor ? "Executando…" : "Executar"}</button></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3"><Small label="Ativos" value={data.monitor?.activeAlerts.length || 0} /><Small label="Último status" value={data.monitor?.latestRun?.status || "-"} /><Small label="Última execução" value={dateTime(data.monitor?.latestRun?.finishedAt)} /></div>
            <div className="mt-4 space-y-2">{(data.monitor?.activeAlerts || []).slice(0, 4).map((alert) => <div key={alert.fingerprint} className={`rounded-xl p-3 text-sm ring-1 ${alert.severity === "critical" ? "bg-red-50 text-red-800 ring-red-100" : "bg-amber-50 text-amber-900 ring-amber-100"}`}><strong>{alert.title}</strong><p className="mt-1 text-xs">{alert.message}</p></div>)}{!data.monitor?.activeAlerts.length && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">Nenhum alerta ativo.</p>}</div>
          </article>
        </section>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><h2 className="text-2xl font-black text-slate-900">Saúde dos parsers</h2><div className="mt-5 grid gap-4 md:grid-cols-3">{data.parsers.map((parser) => <article key={parser.parser} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><div className="flex items-center justify-between gap-3"><strong className="text-slate-900">{parser.parser}</strong><span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${statusStyle(parser.status)}`}>{parser.status}</span></div><p className="mt-3 text-3xl font-black text-indigo-700">{parser.successRate}%</p><p className="mt-2 text-xs text-slate-500">{parser.successes} sucesso(s) · {parser.failures} falha(s)</p>{parser.lastError && <p className="mt-2 text-xs font-bold text-red-700">{parser.lastError}</p>}</article>)}</div></section>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><div className="flex items-center gap-2"><History className="text-indigo-700" /><h2 className="text-2xl font-black text-slate-900">Histórico de validações</h2></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-indigo-50 text-xs uppercase tracking-wide text-indigo-700"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Health</th><th className="px-4 py-3">Processados</th><th className="px-4 py-3">Erros</th><th className="px-4 py-3">Avisos</th><th className="px-4 py-3">Responsável</th></tr></thead><tbody className="divide-y divide-slate-100">{data.history.map((run) => <tr key={run.id}><td className="px-4 py-3">{dateTime(run.finishedAt)}</td><td className="px-4 py-3 font-black text-indigo-700">{run.healthScore}%</td><td className="px-4 py-3">{run.totals.processed}</td><td className="px-4 py-3 text-red-700">{run.totals.errors}</td><td className="px-4 py-3 text-amber-700">{run.totals.warnings}</td><td className="px-4 py-3">{run.actor}</td></tr>)}{!data.history.length && <tr><td colSpan={6} className="px-4 py-8 text-center font-bold text-slate-500">Execute a primeira validação para criar o histórico.</td></tr>}</tbody></table></div></section>

        <footer className="mt-8 flex flex-wrap gap-3"><Link href="/admin/observabilidade" className="rounded-full bg-white px-4 py-2 text-sm font-bold text-indigo-700 ring-1 ring-slate-200">Observabilidade geral</Link><Link href="/" className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200">Voltar ao site</Link></footer>
      </div>
    </main>
  );
}

function Metric({ title, value, detail, icon: Icon, good }: { title: string; value: string | number; detail: string; icon: typeof ShieldCheck; good: boolean }) {
  return <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><div className="flex items-start justify-between"><div><p className="text-xs font-extrabold uppercase tracking-wide text-indigo-700">{title}</p><p className={`mt-2 text-3xl font-black ${good ? "text-emerald-600" : "text-amber-700"}`}>{value}</p></div><Icon className="text-indigo-700" /></div><p className="mt-3 text-sm text-slate-600">{detail}</p></article>;
}

function Small({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl bg-indigo-50/60 p-3 ring-1 ring-indigo-100"><p className="text-xs font-extrabold uppercase tracking-wide text-indigo-700">{label}</p><p className="mt-1 font-black text-slate-900">{value}</p></div>;
}
