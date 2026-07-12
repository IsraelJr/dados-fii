'use client';

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Database, Gift, Loader2, Lock, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import PageHeader from "../components/PageHeader";

type Result = Record<string, any> | null;

type Session = {
  user: string;
  expiresAt?: string | null;
};

async function parseResponse(response: Response) {
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("admin-session-expired"));
    }
    throw new Error(json?.error || "Erro na operação.");
  }
  return json;
}

function formatSessionExpiration(value?: string | null) {
  if (!value) return "durante esta sessão";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "horário indisponível";
  }
}

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [user, setUser] = useState("");
  const [key, setKey] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const response = await fetch("/api/admin/session", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) return;
        const json = await response.json().catch(() => ({}));
        if (active && json?.authenticated) {
          setSession({ user: json.user, expiresAt: json.expiresAt || null });
        }
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    function expireSession() {
      setSession(null);
      setLoginError("Sua sessão administrativa expirou. Entre novamente.");
    }

    restoreSession();
    window.addEventListener("admin-session-expired", expireSession);
    return () => {
      active = false;
      window.removeEventListener("admin-session-expired", expireSession);
    };
  }, []);

  async function login() {
    setLoginLoading(true);
    setLoginError("");

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ user, token: key }),
      });
      const json = await parseResponse(response);
      setSession({ user: json.user || user, expiresAt: json.expiresAt || null });
      setKey("");
    } catch (err: any) {
      setLoginError(err.message || "Acesso negado.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/session", {
      method: "DELETE",
      credentials: "same-origin",
    }).catch(() => undefined);
    setSession(null);
    setKey("");
  }

  if (checkingSession) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-5xl items-center justify-center px-4 py-8">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 font-bold text-slate-700 shadow-sm ring-1 ring-slate-200">
          <Loader2 className="animate-spin text-indigo-600" size={20} />
          Verificando sessão administrativa…
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <PageHeader
          title="Admin Dados FII"
          subtitle="Acesso restrito para rotinas administrativas e manutenção da base."
          backLabel="← Voltar para Home"
        />

        <section className="mx-auto max-w-xl rounded-3xl bg-gray-900 p-6 text-gray-100 shadow-lg ring-1 ring-white/10">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white">
              <Lock size={24} />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold text-white">Login administrativo</h1>
              <p className="mt-1 text-sm font-medium text-gray-300">Entre uma vez. A sessão segura permanecerá ativa por até oito horas neste navegador.</p>
            </div>
          </div>

          <div className="grid gap-4">
            <Field label="Usuário" value={user} onChange={setUser} placeholder="ADMIN_USER" />
            <Field label="Chave administrativa" value={key} onChange={setKey} placeholder="Chave administrativa" type="password" />
          </div>

          <button
            type="button"
            onClick={login}
            disabled={loginLoading || !user.trim() || !key.trim()}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-extrabold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
          >
            {loginLoading ? <Loader2 className="animate-spin" size={18} /> : <Lock size={18} />}
            Entrar com segurança
          </button>

          <p className="mt-3 text-xs leading-5 text-gray-400">A chave é enviada somente no login e não fica armazenada no JavaScript nem no armazenamento local do navegador.</p>
          {loginError && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm font-bold text-red-200">{loginError}</p>}
        </section>
      </main>
    );
  }

  return <AdminDashboard session={session} onLogout={logout} />;
}

function AdminDashboard({ session, onLogout }: { session: Session; onLogout: () => void }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title="Painel Administrativo"
        subtitle="Central de manutenção do Dados FII."
        action={(
          <button onClick={onLogout} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200">
            Sair
          </button>
        )}
      />

      <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-bold uppercase tracking-wide text-indigo-700">Sessão segura ativa</p>
        <h2 className="mt-1 text-xl font-extrabold text-slate-900">{session.user}</h2>
        <p className="mt-1 text-sm text-slate-500">Válida até {formatSessionExpiration(session.expiresAt)}. A chave administrativa não está exposta nesta página.</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <TgarIngestionCard />
        <VipGiftCard />
        <CreateFiiCard />
        <PendingCard />
        <CleanupCard />
      </div>
    </main>
  );
}

function TgarIngestionCard() {
  const [cnpj, setCnpj] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [delayMinutes, setDelayMinutes] = useState("0");
  const [runId, setRunId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function loadStatus(id = runId, silent = false) {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/admin/fii-ingestion/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ runId: id }),
      });
      setResult(await parseResponse(response));
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    if (!runId) return;
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch("/api/admin/fii-ingestion/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ runId }),
        });
        const json = await parseResponse(response);
        setResult(json);
        const status = String(json?.run?.status || "");
        if (["completed", "failed"].includes(status)) window.clearInterval(interval);
      } catch {
        return;
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [runId]);

  async function run() {
    setLoading(true);
    setResult(null);
    setRunId("");
    try {
      const response = await fetch("/api/admin/fii-ingestion/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ticker: "TGAR11",
          cnpj: cnpj || undefined,
          year: Number(year || new Date().getFullYear()),
          delayMinutes: Number(delayMinutes || 0),
        }),
      });
      const json = await parseResponse(response);
      setRunId(String(json.runId || ""));
      setResult(json);
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminCard icon={<Database />} title="Piloto de ingestão TGAR11" description="Executa o workflow CVM em staging, sem publicar dados na coleção oficial Fiis.">
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="CNPJ" value={cnpj} onChange={setCnpj} placeholder="Opcional" />
        <Field label="Ano" value={year} onChange={setYear} placeholder="2026" type="number" />
        <Field label="Atraso em minutos" value={delayMinutes} onChange={setDelayMinutes} placeholder="0" type="number" />
      </div>
      <div className="flex flex-wrap gap-3">
        <ActionButton label="Iniciar piloto" loading={loading} onClick={run} />
        {runId && (
          <button type="button" onClick={() => loadStatus()} disabled={loading} className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-gray-800 px-5 py-3 font-extrabold text-gray-100 ring-1 ring-gray-700 hover:bg-gray-700 disabled:opacity-50">
            <RefreshCw size={18} /> Atualizar status
          </button>
        )}
      </div>
      {runId && <p className="mt-3 text-xs font-bold text-indigo-200">Execução: {runId}</p>}
      <ResultBox result={result} />
    </AdminCard>
  );
}

function VipGiftCard() {
  const [email, setEmail] = useState("");
  const [durationDays, setDurationDays] = useState("5");
  const [claimWindowDays, setClaimWindowDays] = useState("30");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/vip-gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email,
          durationDays: Number(durationDays || 5),
          claimWindowDays: Number(claimWindowDays || 30),
          message: message || undefined,
        }),
      });
      setResult(await parseResponse(response));
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminCard icon={<Gift />} title="Presentear com VIP" description="Cria um convite temporário e parametrizável, exibido em notificação e pop-up para o usuário aceitar ou ignorar.">
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="E-mail do usuário" value={email} onChange={setEmail} placeholder="usuario@email.com" type="email" />
        <Field label="Dias de VIP" value={durationDays} onChange={setDurationDays} placeholder="5" type="number" />
        <Field label="Prazo para aceitar" value={claimWindowDays} onChange={setClaimWindowDays} placeholder="30" type="number" />
      </div>
      <TextArea label="Mensagem opcional" value={message} onChange={setMessage} placeholder="Você ganhou alguns dias para experimentar o Premium." />
      <ActionButton label="Enviar presente VIP" loading={loading} disabled={!email.trim()} onClick={run} />
      <ResultBox result={result} />
    </AdminCard>
  );
}

function CreateFiiCard() {
  const [ticker, setTicker] = useState("");
  const [segment, setSegment] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function run() {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/create-fii", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ticker, segment, segmentNew: segment, cnpj }),
      });
      setResult(await parseResponse(response));
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminCard icon={<Plus />} title="Cadastrar fundo" description="Cria um novo documento em Fiis usando a estrutura padrão e dados do StatusInvest.">
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Ticker" value={ticker} onChange={(value) => setTicker(value.toUpperCase())} placeholder="Ex: ABCD11" />
        <Field label="Segmento" value={segment} onChange={setSegment} placeholder="Opcional" />
        <Field label="CNPJ" value={cnpj} onChange={setCnpj} placeholder="Opcional" />
      </div>
      <ActionButton label="Criar fundo" loading={loading} disabled={!ticker.trim()} onClick={run} />
      <ResultBox result={result} />
    </AdminCard>
  );
}

function PendingCard() {
  const [limit, setLimit] = useState("30");
  const [tickers, setTickers] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function run() {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/update-pending-dividends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          limit: Number(limit || 30),
          tickers: tickers.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean),
        }),
      });
      setResult(await parseResponse(response));
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminCard icon={<RefreshCw />} title="Atualizar pendentes do mês" description="Busca rendimentos apenas dos FIIs sem pagamento cadastrado no mês atual.">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Limite" value={limit} onChange={setLimit} placeholder="30" />
        <Field label="Tickers" value={tickers} onChange={setTickers} placeholder="Opcional: ABCD11, XPTO11" />
      </div>
      <ActionButton label="Atualizar pendentes" loading={loading} onClick={run} />
      <ResultBox result={result} />
    </AdminCard>
  );
}

function CleanupCard() {
  const [limit, setLimit] = useState("50");
  const [cursor, setCursor] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function run() {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/clean-fii-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ limit: Number(limit || 50), cursor: cursor || undefined }),
      });
      const json = await parseResponse(response);
      setResult(json);
      if (json?.nextCursor) setCursor(json.nextCursor);
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminCard icon={<Trash2 />} title="Limpar campos técnicos" description="Remove campos antigos e desnecessários da coleção Fiis em lote.">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Limite" value={limit} onChange={setLimit} placeholder="50" />
        <Field label="Cursor" value={cursor} onChange={setCursor} placeholder="Opcional" />
      </div>
      <ActionButton label="Limpar lote" loading={loading} onClick={run} />
      <ResultBox result={result} />
    </AdminCard>
  );
}

function AdminCard({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white">{icon}</span>
        <div>
          <h2 className="text-xl font-extrabold text-white">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-gray-300">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-gray-300">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-700 bg-gray-800 p-3 text-white outline-none placeholder:text-gray-500 focus:border-indigo-400"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="mt-3 block">
      <span className="mb-1 block text-sm font-bold text-gray-300">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-y rounded-xl border border-gray-700 bg-gray-800 p-3 text-white outline-none placeholder:text-gray-500 focus:border-indigo-400"
      />
    </label>
  );
}

function ActionButton({ label, loading, disabled = false, onClick }: { label: string; loading: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-extrabold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
    >
      {loading ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
      {label}
    </button>
  );
}

function ResultBox({ result }: { result: Result }) {
  if (!result) return null;
  const ok = result.ok || result.success;

  return (
    <pre className={`mt-5 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-2xl p-4 text-xs leading-5 ${ok ? "bg-green-500/10 text-green-100" : "bg-red-500/10 text-red-100"}`}>
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}
