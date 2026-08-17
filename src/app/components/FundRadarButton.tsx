"use client";

import Link from "next/link";
import { BellPlus, Check, Loader2, Radar } from "lucide-react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { fundRadarRequest } from "@/lib/fund-radar/FundRadarClient";

type RadarFund = Readonly<{ ticker: string; status: "active" | "paused_by_plan" | "in_portfolio" | "removed" }>;

export default function FundRadarButton({ ticker }: { ticker: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [fund, setFund] = useState<RadarFund | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => onAuthStateChanged(auth, (currentUser) => {
    setUser(currentUser);
    setLoading(true);
    fundRadarRequest(currentUser, "/api/fund-radar")
      .then((payload) => {
        const funds = Array.isArray(payload.funds) ? payload.funds as RadarFund[] : [];
        setFund(funds.find((item) => item.ticker === ticker) || null);
        setRequiresAuth(false);
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "FUND_RADAR_DISABLED") setDisabled(true);
        else if (error instanceof Error && error.name === "FUND_RADAR_AUTH_REQUIRED") setRequiresAuth(true);
        else setMessage(error instanceof Error ? error.message : "Não foi possível consultar o Radar.");
      })
      .finally(() => setLoading(false));
  }), [ticker]);

  async function follow() {
    if (submitting || fund) return;
    setSubmitting(true);
    setMessage("");
    try {
      const payload = await fundRadarRequest(user, "/api/fund-radar", { method: "POST", body: { ticker } });
      setFund(payload.fund as RadarFund);
      setMessage("Fundo adicionado ao Radar.");
    } catch (error) {
      if (error instanceof Error && error.name === "FUND_RADAR_AUTH_REQUIRED") setRequiresAuth(true);
      else setMessage(error instanceof Error ? error.message : "Não foi possível acompanhar o fundo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (disabled) return null;
  if (loading) return <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600"><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Radar</span>;
  if (requiresAuth) {
    return <Link href="/carteira" className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"><Radar size={16} aria-hidden="true" /> Entrar para acompanhar</Link>;
  }

  const label = fund?.status === "active"
    ? "Acompanhando"
    : fund?.status === "paused_by_plan"
      ? "Pausado pelo plano"
      : fund?.status === "in_portfolio"
        ? "Na carteira"
        : "Acompanhar";
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={follow}
        disabled={submitting || Boolean(fund)}
        className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-default disabled:bg-slate-600"
        aria-describedby={message ? `radar-button-message-${ticker}` : undefined}
      >
        {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : fund ? <Check size={16} aria-hidden="true" /> : <BellPlus size={16} aria-hidden="true" />}
        {label}
      </button>
      {message && <span id={`radar-button-message-${ticker}`} role="status" className="max-w-64 text-right text-xs font-medium text-slate-600">{message}</span>}
    </div>
  );
}
