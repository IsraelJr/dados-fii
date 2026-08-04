'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { BadgeCheck, Crown, FlaskConical, Loader2, Radar, ShieldCheck } from "lucide-react";
import { auth } from "@/lib/firebase";
import type { PremiumDiscoveryStatus } from "@/lib/premium-discovery";

type DiscoveryResponse = Readonly<{
  ok?: boolean;
  status?: PremiumDiscoveryStatus;
  error?: string;
  code?: string;
}>;

const ORIGIN = "portfolio_intelligence";

async function discoveryRequest(user: User, method: "GET" | "POST") {
  const token = await user.getIdToken();
  const response = await fetch(
    method === "GET" ? `/api/premium/discovery?origin=${ORIGIN}` : "/api/premium/discovery",
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      body: method === "POST"
        ? JSON.stringify({ origin: ORIGIN, motivation: "portfolio_analysis" })
        : undefined,
      cache: "no-store",
    },
  );
  const payload = await response.json().catch(() => ({})) as DiscoveryResponse;
  if (!response.ok || !payload.status) {
    const error = new Error(payload.error || "Não foi possível consultar o beta Premium.");
    error.name = payload.code || "PREMIUM_DISCOVERY_ERROR";
    throw error;
  }
  return payload.status;
}

export default function PremiumDiscoveryPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<PremiumDiscoveryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setStatus(null);
      setError("");
      if (!currentUser) {
        setLoading(false);
        return;
      }
      setLoading(true);
      discoveryRequest(currentUser, "GET")
        .then(setStatus)
        .catch((caught) => {
          if (caught instanceof Error && caught.name === "PREMIUM_DISCOVERY_DISABLED") setDisabled(true);
          else setError(caught instanceof Error ? caught.message : "Não foi possível consultar o beta Premium.");
        })
        .finally(() => setLoading(false));
    });
  }, []);

  async function requestAccess() {
    if (!user || submitting || disabled) return;
    setSubmitting(true);
    setError("");
    try {
      setStatus(await discoveryRequest(user, "POST"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível registrar seu interesse.");
    } finally {
      setSubmitting(false);
    }
  }

  const accessGranted = status?.hasPremiumAccess === true;
  const requested = status?.interestRequested === true;

  return (
    <section
      aria-labelledby="premium-discovery-title"
      data-testid="premium-discovery"
      className="mt-6 overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-amber-50 p-5 text-slate-900 shadow-sm dark:border-indigo-900 dark:from-indigo-950/50 dark:via-gray-950 dark:to-amber-950/30 dark:text-gray-100"
    >
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100">
            <FlaskConical size={14} aria-hidden="true" /> Premium em validação
          </p>
          <h3 id="premium-discovery-title" className="mt-3 text-xl font-black text-slate-950 dark:text-white">
            Ajude a definir o próximo nível do Dados FII
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-200">
            Estamos validando o Premium com um grupo controlado antes de definir preço ou assinatura. Solicitar acesso registra interesse; não cria cobrança e não garante liberação automática.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-extrabold text-slate-700 ring-1 ring-slate-200 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700">
          <ShieldCheck size={15} aria-hidden="true" /> Beta liberado somente pelo servidor
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Benefit icon={<Crown size={17} aria-hidden="true" />} title="Análises Premium" description="Relatórios aprofundados, cenários e leitura objetiva do Modo Gestor." />
        <Benefit icon={<BadgeCheck size={17} aria-hidden="true" />} title="Risk Lab" description="Contexto histórico homologado, somente leitura e sem recomendação automática." />
        <Benefit icon={<Radar size={17} aria-hidden="true" />} title="Próximas funções" description="Mudanças desde a última análise e acompanhamento de fundos fora da carteira." />
      </div>

      <div className="mt-5 rounded-xl bg-white/85 p-4 ring-1 ring-slate-200 dark:bg-gray-950/80 dark:ring-gray-800">
        {loading ? (
          <p role="status" className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
            <Loader2 className="motion-safe:animate-spin" size={16} aria-hidden="true" /> Consultando seu acesso…
          </p>
        ) : accessGranted ? (
          <p role="status" className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">{status?.message}</p>
        ) : requested ? (
          <p role="status" className="text-sm font-extrabold text-indigo-700 dark:text-indigo-200">{status?.message}</p>
        ) : disabled ? (
          <p role="status" className="text-sm font-bold text-slate-600 dark:text-slate-300">A lista de interesse está pausada. Nenhum acesso ou recurso gratuito foi alterado.</p>
        ) : !user ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-700 dark:text-slate-200">Entre em uma conta com e-mail verificado para solicitar participação.</p>
            <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-full bg-indigo-600 px-5 py-2 text-sm font-extrabold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2">Entrar para participar</Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-700 dark:text-slate-200">Seu pedido ficará na lista de interesse até uma liberação manual e controlada.</p>
            <button type="button" onClick={requestAccess} disabled={submitting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 py-2 text-sm font-extrabold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2">
              {submitting && <Loader2 className="motion-safe:animate-spin" size={16} aria-hidden="true" />}
              {submitting ? "Registrando…" : "Quero participar do beta"}
            </button>
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-sm font-bold text-red-700 dark:text-red-300">{error}</p>}
      </div>

      <p className="mt-4 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">
        Não existe checkout nesta etapa. A solicitação não envia carteira, patrimônio, dividendos, posições, token ou e-mail para a telemetria de produto.
      </p>
    </section>
  );
}

function Benefit({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <article className="rounded-xl bg-white/80 p-4 ring-1 ring-slate-200 dark:bg-gray-950/70 dark:ring-gray-800">
      <p className="inline-flex items-center gap-2 font-extrabold text-slate-950 dark:text-white">{icon}{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
    </article>
  );
}
