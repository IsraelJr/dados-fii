"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Crown, FileText, Gift, Loader2, ShieldCheck, Sparkles, X } from "lucide-react";

const EMAIL_KEY = "dados-fii-wallet-email";
const TOKEN_KEY = "dados-fii-wallet-session";
const SESSION_CHECK_INTERVAL_MS = 2000;

type VipGift = {
  id: string;
  durationDays: number;
  message?: string | null;
  offerExpiresAt?: string | null;
};

type AcceptedResult = {
  durationDays: number;
  endsAt?: string | null;
  permanentAlreadyActive?: boolean;
  vip?: { active?: boolean; expiresAt?: string | null; remainingDays?: number | null };
};

function formatDate(value?: string | null) {
  if (!value) return "sem data definida";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "data indisponível";
  }
}

const benefits = [
  {
    icon: FileText,
    title: "Relatórios completos",
    description: "Acesse análises aprofundadas de risco, dividendos, valuation e qualidade dos fundos.",
  },
  {
    icon: BellRing,
    title: "Alertas avançados",
    description: "Receba análises interpretadas sobre dividendos, concentração, risco e mudanças relevantes.",
  },
  {
    icon: ShieldCheck,
    title: "Visão Premium da carteira",
    description: "Use comparações, diagnósticos e recursos exclusivos para tomar decisões mais bem informadas.",
  },
];

export default function VipGiftPrompt() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [gift, setGift] = useState<VipGift | null>(null);
  const [accepted, setAccepted] = useState<AcceptedResult | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const request = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    if (!email || !sessionToken) throw new Error("Sessão da carteira não encontrada.");
    const response = await fetch("/api/vip-gifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action, email, sessionToken, ...payload }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível processar o presente VIP.");
    return json;
  }, [email, sessionToken]);

  const load = useCallback(async () => {
    if (!email || !sessionToken || accepted) return;
    try {
      const json = await request("list");
      const nextGift = Array.isArray(json.gifts) ? json.gifts[0] : null;
      if (nextGift) {
        setGift(nextGift);
        setOpen(true);
      } else {
        setGift(null);
      }
    } catch (err: any) {
      if (!String(err?.message || "").toLowerCase().includes("sessão expirada")) {
        setError(err?.message || "Não foi possível consultar presentes VIP.");
      }
    }
  }, [accepted, email, request, sessionToken]);

  useEffect(() => {
    function syncSession() {
      const storedEmail = String(window.localStorage.getItem(EMAIL_KEY) || "").trim().toLowerCase();
      const storedToken = String(window.localStorage.getItem(TOKEN_KEY) || "");
      setEmail((current) => current === storedEmail ? current : storedEmail);
      setSessionToken((current) => current === storedToken ? current : storedToken);
      if (!storedEmail || !storedToken) {
        setGift(null);
        setOpen(false);
      }
    }

    syncSession();
    const interval = window.setInterval(syncSession, SESSION_CHECK_INTERVAL_MS);
    window.addEventListener("storage", syncSession);
    window.addEventListener("wallet-session-updated", syncSession);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", syncSession);
      window.removeEventListener("wallet-session-updated", syncSession);
    };
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function acceptGift() {
    if (!gift) return;
    setLoading(true);
    setError("");
    try {
      const json = await request("accept", { giftId: gift.id });
      setAccepted(json);
      window.dispatchEvent(new CustomEvent("vip-status-updated", { detail: json.vip || null }));
    } catch (err: any) {
      setError(err?.message || "Não foi possível ativar o presente VIP.");
    } finally {
      setLoading(false);
    }
  }

  async function ignoreGift() {
    if (!gift) return;
    setLoading(true);
    setError("");
    try {
      await request("ignore", { giftId: gift.id });
      setGift(null);
      setOpen(false);
    } catch (err: any) {
      setError(err?.message || "Não foi possível ignorar o presente VIP.");
    } finally {
      setLoading(false);
    }
  }

  function finishOnboarding() {
    setOpen(false);
    router.push("/carteira");
  }

  if (!open || !gift) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Presente VIP">
      <section className="relative max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl ring-1 ring-white/20">
        <button type="button" onClick={() => setOpen(false)} className="absolute right-4 top-4 z-10 rounded-full bg-white/80 p-2 text-slate-600 shadow hover:bg-white hover:text-slate-900" aria-label="Fechar"><X size={20} /></button>

        {!accepted ? (
          <>
            <header className="overflow-hidden rounded-t-3xl bg-gradient-to-br from-indigo-950 via-indigo-800 to-violet-600 p-6 text-white md:p-8">
              <div className="flex items-start gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-300 text-amber-950 shadow-lg"><Gift size={30} /></span>
                <div>
                  <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-100"><Sparkles size={14} /> Presente exclusivo</p>
                  <h2 className="mt-3 text-3xl font-black">Você recebeu {gift.durationDays} dia{gift.durationDays === 1 ? "" : "s"} de VIP</h2>
                  <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-indigo-100">{gift.message || "Experimente os recursos Premium do Dados FII e veja como as análises avançadas podem melhorar o acompanhamento da sua carteira."}</p>
                </div>
              </div>
            </header>

            <div className="p-6 md:p-8">
              <div className="grid gap-4 md:grid-cols-3">
                {benefits.map(({ icon: Icon, title, description }) => (
                  <article key={title} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                    <Icon className="text-indigo-600" size={24} />
                    <h3 className="mt-3 font-black text-slate-900">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                  </article>
                ))}
              </div>

              <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900 ring-1 ring-amber-200">O convite pode ser aceito até {formatDate(gift.offerExpiresAt)}. O período VIP começa no momento da ativação.</p>
              {error && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 ring-1 ring-red-100">{error}</p>}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={ignoreGift} disabled={loading} className="rounded-xl px-5 py-3 text-sm font-extrabold text-slate-600 hover:bg-slate-100 disabled:opacity-50">Ignorar presente</button>
                <button type="button" onClick={acceptGift} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-extrabold text-white shadow-lg hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Crown size={18} />}
                  Ativar meu VIP
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-7 text-center md:p-10">
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Crown size={40} /></span>
            <p className="mt-5 text-xs font-extrabold uppercase tracking-wide text-emerald-700">VIP ativado</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">Seu presente já está valendo</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
              {accepted.permanentAlreadyActive
                ? "Sua conta já possuía VIP permanente. O presente foi registrado sem alterar o plano atual."
                : `Você terá acesso aos recursos VIP até ${formatDate(accepted.endsAt || accepted.vip?.expiresAt)}.`}
            </p>

            <div className="mt-7 grid gap-3 text-left md:grid-cols-3">
              {benefits.map(({ icon: Icon, title, description }) => (
                <article key={title} className="rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-100">
                  <Icon className="text-indigo-700" size={22} />
                  <h3 className="mt-3 font-black text-slate-900">{title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
                </article>
              ))}
            </div>

            <button type="button" onClick={finishOnboarding} className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 font-extrabold text-white hover:bg-slate-800"><Sparkles size={18} /> Explorar recursos VIP</button>
          </div>
        )}
      </section>
    </div>
  );
}
