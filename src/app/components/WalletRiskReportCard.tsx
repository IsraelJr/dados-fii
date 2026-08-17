'use client';

import { useEffect, useState } from "react";
import { Crown, Download, FileText, Lock, ShieldCheck, Sparkles } from "lucide-react";
import {
  WALLET_SESSION_INVALID_EVENT,
  WALLET_SESSION_UPDATED_EVENT,
} from "@/lib/users/WalletSessionRecoveryClient";
import LottieAnimation from "./LottieAnimation";

type ReportStatus = {
  ok: boolean;
  email?: string;
  month?: string;
  isVip?: boolean;
  credits?: number;
  walletCount?: number;
  canGenerate?: boolean;
  automaticEnabled?: boolean;
  manualFallbackEnabled?: boolean;
  hasCurrentReport?: boolean;
  currentReportStatus?: string;
  generationMode?: string;
  reportMarkdown?: string;
  error?: string;
};

type GeneratedReport = {
  mode?: string;
  vip?: boolean;
  remainingCredits?: number;
  generationMode?: string;
  reportMarkdown?: string;
  report?: { reportMarkdown?: string };
};

const EMAIL_KEY = "dados-fii-wallet-email";
const TOKEN_KEY = "dados-fii-wallet-session";

function filenameFromDisposition(value: string | null) {
  const match = value?.match(/filename="?([^";]+)"?/i);
  return match?.[1] || "relatorio-risco-carteira.pdf";
}

function ReportLoadingState({ mode, isVip }: { mode: "generating" | "pdf" | "status"; isVip: boolean }) {
  const text = mode === "pdf"
    ? "Gerando o relatório e preparando o PDF..."
    : mode === "status"
      ? "Consultando seu relatório..."
      : "Analisando riscos da carteira...";
  const detail = mode === "pdf"
    ? "Se o relatório deste mês ainda não existir, ele será criado automaticamente antes do download."
    : mode === "status"
      ? "Verificando se já existe relatório disponível para este mês."
      : "Concentração, dividendos, liquidez, valuation e cenário macro em processamento pela análise automática.";

  return (
    <div className={`rounded-2xl p-4 text-center ring-1 ${isVip ? "bg-gray-950/70 ring-white/10" : "bg-white/80 ring-indigo-100"}`}>
      <div className="mx-auto flex justify-center">
        <LottieAnimation src="/lottie/risk-report.json" label={text} className="h-28 w-28" />
      </div>
      <p className={`mt-2 text-sm font-extrabold ${isVip ? "text-emerald-100" : "text-slate-900"}`}>{text}</p>
      <p className={`mt-1 text-xs font-medium leading-5 ${isVip ? "text-gray-400" : "text-slate-600"}`}>{detail}</p>
    </div>
  );
}

export default function WalletRiskReportCard({ walletCount }: { walletCount: number }) {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [status, setStatus] = useState<ReportStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [message, setMessage] = useState("");
  const [reportMarkdown, setReportMarkdown] = useState("");

  useEffect(() => {
    let disposed = false;
    let requestGeneration = 0;
    const onSessionInvalid = () => {
      requestGeneration += 1;
      setVisible(false);
      setSessionToken("");
      setStatus(null);
      setLoadingStatus(false);
      setGenerating(false);
      setDownloadingPdf(false);
    };

    async function loadStatus() {
      const generation = ++requestGeneration;
      const cleanEmail = String(window.localStorage.getItem(EMAIL_KEY) || "").trim().toLowerCase();
      const storedToken = window.localStorage.getItem(TOKEN_KEY) || "";
      if (!cleanEmail || !storedToken) {
        onSessionInvalid();
        return;
      }
      setEmail(cleanEmail);
      setSessionToken(storedToken);
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

        if (disposed || generation !== requestGeneration) return;
        setVisible(Boolean(json.isVip || json.canGenerate));
        setStatus(json);
        if (json.reportMarkdown) setReportMarkdown(json.reportMarkdown);
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : "Não foi possível consultar o status do relatório.";
        if (!disposed && generation === requestGeneration) {
          setVisible(false);
          setMessage(reason);
        }
      } finally {
        if (!disposed && generation === requestGeneration) setLoadingStatus(false);
      }
    }

    const onSessionUpdated = () => void loadStatus();
    window.addEventListener(WALLET_SESSION_INVALID_EVENT, onSessionInvalid);
    window.addEventListener(WALLET_SESSION_UPDATED_EVENT, onSessionUpdated);
    void loadStatus();
    return () => {
      disposed = true;
      requestGeneration += 1;
      window.removeEventListener(WALLET_SESSION_INVALID_EVENT, onSessionInvalid);
      window.removeEventListener(WALLET_SESSION_UPDATED_EVENT, onSessionUpdated);
    };
  }, []);

  function applyGeneratedReport(json: GeneratedReport) {
    const markdown = json.reportMarkdown || json.report?.reportMarkdown || "";
    setReportMarkdown(markdown);
    setStatus((current) => ({
      ...(current || { ok: true }),
      isVip: json.vip ?? current?.isVip,
      credits: json.remainingCredits ?? current?.credits,
      hasCurrentReport: true,
      currentReportStatus: "done",
      generationMode: json.generationMode || "automatic_openai",
      reportMarkdown: markdown || current?.reportMarkdown || "",
    }));
    return markdown;
  }

  async function requestAutomaticReport(forceNew = false) {
    const response = await fetch("/api/wallet-risk-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, sessionToken, forceNew }),
    });
    const json = await response.json().catch(() => ({}));

    if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível gerar o relatório.");
    applyGeneratedReport(json);
    return json as GeneratedReport;
  }

  async function generateReport(forceNew = false) {
    if (!email || !sessionToken) {
      setMessage("Confirme seu e-mail na carteira antes de gerar o relatório.");
      return;
    }

    setGenerating(true);
    setMessage("");

    try {
      const json = await requestAutomaticReport(forceNew);
      setMessage(json.mode === "cached"
        ? "Relatório automático carregado do histórico."
        : "Relatório automático gerado e salvo com sucesso.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Não foi possível gerar o relatório.");
    } finally {
      setGenerating(false);
    }
  }

  async function downloadPdf() {
    if (!email || !sessionToken) {
      setMessage("Confirme seu e-mail na carteira antes de baixar o PDF.");
      return;
    }

    setDownloadingPdf(true);
    setMessage("");

    try {
      if (status?.hasCurrentReport !== true || status?.generationMode !== "automatic_openai") {
        await requestAutomaticReport(false);
      }

      const response = await fetch("/api/wallet-risk-report/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, sessionToken }),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json?.error || "Não foi possível gerar o PDF.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFromDisposition(response.headers.get("Content-Disposition"));
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setMessage("Relatório automático e PDF concluídos com sucesso.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Não foi possível gerar o PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  }

  if (!visible) return null;

  const isVip = status?.isVip === true;
  const credits = Number(status?.credits || 0);
  const hasCurrentReport = status?.hasCurrentReport === true;
  const canGenerate = isVip || credits > 0;
  const hasWallet = walletCount > 0 || Number(status?.walletCount || 0) > 0;
  const loadingReportAction = loadingStatus || generating || downloadingPdf;
  const loadingMode = downloadingPdf ? "pdf" : loadingStatus ? "status" : "generating";

  return (
    <section className={`mt-6 overflow-hidden rounded-2xl p-5 shadow-lg ring-1 ${isVip ? "bg-gray-900 text-gray-100 ring-emerald-400/30" : "bg-gradient-to-br from-amber-100 via-white to-indigo-50 text-slate-900 ring-amber-300"}`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <p className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide ${isVip ? "bg-emerald-500/10 text-emerald-200" : "bg-amber-400/30 text-amber-900"}`}>
            {isVip ? <ShieldCheck size={14} /> : <Crown size={14} />}
            {isVip ? "VIP ativo" : "Recurso VIP"}
          </p>

          <h2 className={`mt-3 text-2xl font-extrabold ${isVip ? "text-white" : "text-slate-900"}`}>
            Relatório de risco da carteira
          </h2>

          <p className={`mt-2 text-sm font-medium leading-6 ${isVip ? "text-gray-300" : "text-slate-700"}`}>
            Uma análise automática completa dos seus FIIs com concentração, sustentabilidade dos dividendos, sensibilidade a juros, stress test, riscos por ativo e plano de ação.
          </p>

          {!isVip && (
            <p className="mt-3 rounded-xl bg-white/70 p-3 text-sm font-bold text-slate-800 ring-1 ring-amber-200">
              Este relatório foi pensado como um produto premium. Usuários VIP recebem 1 relatório completo por mês. Relatórios extras poderão ser comprados de forma avulsa.
            </p>
          )}

          {isVip && hasCurrentReport && (
            <p className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-sm font-bold text-emerald-100 ring-1 ring-emerald-400/20">
              Seu relatório automático deste mês já está disponível.
            </p>
          )}
        </div>

        <div className="grid w-full gap-3 lg:max-w-xs">
          {loadingReportAction ? (
            <ReportLoadingState mode={loadingMode as "generating" | "pdf" | "status"} isVip={isVip} />
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
                <FileText size={18} />
                {hasCurrentReport ? "Abrir relatório do mês" : "Gerar relatório automático"}
              </button>

              <button
                type="button"
                onClick={downloadPdf}
                disabled={!hasWallet || !canGenerate || downloadingPdf}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-extrabold shadow-sm transition ${isVip
                  ? "bg-gray-800 text-gray-100 hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
                  : "bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                  }`}
              >
                <Download size={18} />
                {hasCurrentReport ? "Baixar PDF" : "Gerar e baixar PDF"}
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
