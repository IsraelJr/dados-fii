'use client';

import { useEffect, useState } from "react";
import { Crown, FileText, Loader2, Lock, ShieldCheck, Sparkles } from "lucide-react";

type ReportStatus = {
  ok: boolean;
  email?: string;
  month?: string;
  isVip?: boolean;
  credits?: number;
  walletCount?: number;
  canGenerate?: boolean;
  hasCurrentReport?: boolean;
  currentReportStatus?: string;
  reportMarkdown?: string;
  error?: string;
};

const EMAIL_KEY = "dados-fii-wallet-email";
const TOKEN_KEY = "dados-fii-wallet-session";

function allowedEmails() {
  return String(process.env.NEXT_PUBLIC_RISK_REPORT_ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedPilotEmail(email: string) {
  const list = allowedEmails();
  return Boolean(email) && list.includes(email.trim().toLowerCase());
}

export default function WalletRiskReportCard({ walletCount }: { walletCount: number }) {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [status, setStatus] = useState<ReportStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [reportMarkdown, setReportMarkdown] = useState("");

  useEffect(() => {
    const storedEmail = window.localStorage.getItem(EMAIL_KEY) || "";
    const storedToken = window.localStorage.getItem(TOKEN_KEY) || "";
    const cleanEmail = storedEmail.trim().toLowerCase();

    if (!isAllowedPilotEmail(cleanEmail)) {
      setVisible(false);
      return;
    }

    setVisible(true);
    setEmail(cleanEmail);
    setSessionToken(storedToken);

    if (!storedToken) return;

    async function loadStatus() {
      setLoadingStatus(true);
      setMessage("");

      try {
        const response = await fetch("/api/wallet-risk-report/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail, sessionToken: storedToken }),
        });
        const json = await response.json().catch(() => ({}));

        if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível consultar o status do relatório.");

        setStatus(json);
        if (json.reportMarkdown) setReportMarkdown(json.reportMarkdown);
      } catch (err: any) {
        setMessage(err.message || "Não foi possível consultar o status do relatório.");
      } finally {
        setLoadingStatus(false);
      }
    }

    loadStatus();
  }, []);

  async function generateReport(forceNew = false) {
    if (!email || !sessionToken) {
      setMessage("Confirme seu e-mail na carteira antes de gerar o relatório.");
      return;
    }

    setGenerating(true);
    setMessage("");

    try {
      const response = await fetch("/api/wallet-risk-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, sessionToken, forceNew }),
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível gerar o relatório.");

      setReportMarkdown(json.reportMarkdown || json.report?.reportMarkdown || "");
      setStatus((current) => ({
        ...(current || { ok: true }),
        isVip: json.vip ?? current?.isVip,
        credits: json.remainingCredits ?? current?.credits,
        hasCurrentReport: true,
        currentReportStatus: "done",
        reportMarkdown: json.reportMarkdown || json.report?.reportMarkdown || current?.reportMarkdown || "",
      }));
      setMessage(json.mode === "cached" ? "Relatório mensal carregado do histórico." : "Relatório gerado e salvo com sucesso.");
    } catch (err: any) {
      setMessage(err.message || "Não foi possível gerar o relatório.");
    } finally {
      setGenerating(false);
    }
  }

  if (!visible) return null;

  const isVip = status?.isVip === true;
  const credits = Number(status?.credits || 0);
  const hasCurrentReport = status?.hasCurrentReport === true;
  const canGenerate = isVip || credits > 0;
  const hasWallet = walletCount > 0 || Number(status?.walletCount || 0) > 0;

  return (
    <section className={`mt-6 overflow-hidden rounded-2xl p-5 shadow-lg ring-1 ${isVip ? "bg-gray-900 text-gray-100 ring-emerald-400/30" : "bg-gradient-to-br from-amber-100 via-white to-indigo-50 text-slate-900 ring-amber-300"}`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <p className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide ${isVip ? "bg-emerald-500/10 text-emerald-200" : "bg-amber-400/30 text-amber-900"}`}>
            {isVip ? <ShieldCheck size={14} /> : <Crown size={14} />}
            {isVip ? "VIP ativo" : "Recurso VIP"}
          </p>

          <h2 className={`mt-3 text-2xl font-extrabold ${isVip ? "text-white" : "text-slate-900"}`}>
            Relatório profissional de risco da carteira
          </h2>

          <p className={`mt-2 text-sm font-medium leading-6 ${isVip ? "text-gray-300" : "text-slate-700"}`}>
            Uma análise completa dos seus FIIs com concentração, sustentabilidade dos dividendos, sensibilidade a juros, stress test, riscos por ativo e plano de rebalanceamento.
          </p>

          {!isVip && (
            <p className="mt-3 rounded-xl bg-white/70 p-3 text-sm font-bold text-slate-800 ring-1 ring-amber-200">
              Este relatório foi pensado como um produto premium. Usuários VIP recebem 1 relatório completo por mês. Relatórios extras poderão ser comprados de forma avulsa.
            </p>
          )}

          {isVip && hasCurrentReport && (
            <p className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-sm font-bold text-emerald-100 ring-1 ring-emerald-400/20">
              Seu relatório deste mês já está disponível. Você pode reabrir o histórico sem gerar custo novo de IA.
            </p>
          )}
        </div>

        <div className="grid w-full gap-3 lg:max-w-xs">
          {loadingStatus ? (
            <div className={`flex items-center justify-center gap-2 rounded-xl p-3 text-sm font-bold ${isVip ? "bg-gray-800 text-gray-200" : "bg-white text-slate-700"}`}>
              <Loader2 className="animate-spin" size={18} /> Consultando status...
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => generateReport(false)}
                disabled={!hasWallet || !canGenerate || generating}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-extrabold shadow-sm transition ${canGenerate
                  ? "bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-500 disabled:text-gray-200"
                  : "cursor-not-allowed bg-slate-300 text-slate-600"
                  }`}
              >
                {generating ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
                {hasCurrentReport ? "Abrir relatório do mês" : "Gerar relatório mensal"}
              </button>

              {!isVip && (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  <button type="button" onClick={() => setMessage("Em breve: fluxo de assinatura VIP.")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-slate-800">
                    <Sparkles size={17} /> Quero ser VIP
                  </button>
                  <button type="button" onClick={() => setMessage("Em breve: compra avulsa de relatório.")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
                    <Lock size={17} /> Comprar avulso
                  </button>
                </div>
              )}

              {isVip && hasCurrentReport && credits > 0 && (
                <button
                  type="button"
                  onClick={() => generateReport(true)}
                  disabled={generating}
                  className="rounded-xl bg-gray-800 px-4 py-3 text-sm font-extrabold text-gray-100 hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
                >
                  Gerar novo usando crédito avulso
                </button>
              )}
            </>
          )}

          {!hasWallet && <p className={`text-xs font-bold ${isVip ? "text-yellow-200" : "text-amber-800"}`}>Adicione FIIs à carteira antes de gerar o relatório.</p>}
          {message && <p className={`rounded-xl p-3 text-sm font-bold ${isVip ? "bg-gray-800 text-yellow-100" : "bg-white/80 text-slate-800 ring-1 ring-slate-200"}`}>{message}</p>}
        </div>
      </div>

      {reportMarkdown && (
        <div className={`mt-5 max-h-[640px] overflow-y-auto rounded-2xl p-4 text-sm leading-6 ${isVip ? "bg-gray-950 text-gray-100 ring-1 ring-white/10" : "bg-white text-slate-800 ring-1 ring-slate-200"}`}>
          <pre className="whitespace-pre-wrap break-words font-sans">{reportMarkdown}</pre>
        </div>
      )}
    </section>
  );
}
