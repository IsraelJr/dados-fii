"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, Crown, Database, Loader2, ShieldAlert } from "lucide-react";

type AlertItem = {
  code: string;
  severity: "positive" | "neutral" | "attention" | "risk";
  title: string;
  detail: string;
};

type RegulatoryReportResponse = {
  ok: boolean;
  found?: boolean;
  reportAvailable?: boolean;
  ticker?: string;
  reason?: string;
  report?: {
    headline?: string;
    keyMetrics?: {
      monthsAnalyzed?: number;
      firstReferenceDate?: string | null;
      latestReferenceDate?: string | null;
      latestNetWorth?: number | null;
      latestShareholders?: number | null;
      latestVpCota?: number | null;
      netWorthChangePct?: number | null;
      shareholdersChangePct?: number | null;
      vpCotaChangePct?: number | null;
    };
    alerts?: AlertItem[];
  };
  scores?: {
    overall?: number | null;
    dataQuality?: number | null;
    documentation?: number | null;
    governanceEvidence?: number | null;
    investorBase?: number | null;
    patrimonial?: number | null;
    growth?: number | null;
    stability?: number | null;
    liquidity?: number | null;
    risk?: number | null;
  };
  scoreMeta?: {
    methodologyVersion?: number;
    semaphore?: string;
    unavailableDimensions?: string[];
  };
  regulatory?: {
    source?: string | null;
    documentsCount?: number;
    quality?: {
      qaVerdict?: string | null;
      qaScore?: number | null;
    };
  };
  error?: string;
};

function formatNumber(value: unknown, maximumFractionDigits = 0) {
  if (value === null || value === undefined) return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits }).format(number);
}

function formatCurrency(value: unknown) {
  if (value === null || value === undefined) return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: Math.abs(number) >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(number);
}

function formatPercent(value: unknown) {
  if (value === null || value === undefined) return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `${number > 0 ? "+" : ""}${number.toFixed(2).replace(".", ",")}%`;
}

function scoreTone(value: unknown, inverse = false) {
  if (value === null || value === undefined) return "bg-slate-100 text-slate-600 ring-slate-200";
  const score = Number(value);
  if (!Number.isFinite(score)) return "bg-slate-100 text-slate-600 ring-slate-200";
  const normalized = inverse ? 100 - score : score;
  if (normalized >= 75) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (normalized >= 50) return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-red-50 text-red-700 ring-red-200";
}

function alertStyle(severity: AlertItem["severity"]) {
  if (severity === "risk") return { icon: ShieldAlert, className: "bg-red-50 text-red-800 ring-red-200" };
  if (severity === "attention") return { icon: AlertTriangle, className: "bg-amber-50 text-amber-800 ring-amber-200" };
  return { icon: CheckCircle2, className: "bg-emerald-50 text-emerald-800 ring-emerald-200" };
}

export default function FiiRegulatoryReport({ ticker }: { ticker: string }) {
  const normalizedTicker = String(ticker || "").trim().toUpperCase();
  const [state, setState] = useState<"idle" | "loading" | "ready" | "unavailable" | "error">("idle");
  const [data, setData] = useState<RegulatoryReportResponse | null>(null);

  useEffect(() => {
    if (!normalizedTicker) return;
    const controller = new AbortController();

    async function load() {
      setState("loading");
      setData(null);
      try {
        const response = await fetch(`/api/fii-regulatory-report?ticker=${encodeURIComponent(normalizedTicker)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok && response.status !== 404) throw new Error(payload?.error || "Falha ao carregar relatório regulatório.");
        setData(payload);
        setState(payload?.reportAvailable ? "ready" : "unavailable");
      } catch (error: any) {
        if (error?.name === "AbortError") return;
        setData({ ok: false, error: error?.message || "Falha ao carregar relatório regulatório." });
        setState("error");
      }
    }

    load();
    return () => controller.abort();
  }, [normalizedTicker]);

  const metrics = data?.report?.keyMetrics;
  const cards = useMemo(() => [
    { label: "Patrimônio", value: formatCurrency(metrics?.latestNetWorth), trend: formatPercent(metrics?.netWorthChangePct) },
    { label: "Cotistas", value: formatNumber(metrics?.latestShareholders), trend: formatPercent(metrics?.shareholdersChangePct) },
    { label: "VP por cota", value: formatCurrency(metrics?.latestVpCota), trend: formatPercent(metrics?.vpCotaChangePct) },
    { label: "Competências", value: formatNumber(metrics?.monthsAnalyzed), trend: metrics?.latestReferenceDate || "—" },
  ], [metrics]);

  if (!normalizedTicker) return null;

  if (state === "loading" || state === "idle") {
    return (
      <section className="mt-5 rounded-2xl bg-white p-5 text-left shadow-sm ring-1 ring-slate-200">
        <p className="flex items-center gap-2 text-sm font-extrabold text-slate-700">
          <Loader2 className="animate-spin" size={18} /> Verificando dados regulatórios oficiais...
        </p>
      </section>
    );
  }

  if (state === "unavailable") {
    return (
      <section className="mt-5 rounded-2xl bg-slate-50 p-5 text-left ring-1 ring-slate-200">
        <div className="flex items-start gap-3">
          <Database className="mt-0.5 text-slate-500" size={20} />
          <div>
            <h2 className="font-extrabold text-slate-800">Relatório regulatório em preparação</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Os dados oficiais de {normalizedTicker} ainda não foram publicados na base revisada. A consulta tradicional continua disponível normalmente.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (state === "error" || !data?.report || !data?.scores) return null;

  return (
    <section className="mt-5 overflow-hidden rounded-3xl bg-white text-left shadow-sm ring-1 ring-slate-200">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 to-indigo-950 p-5 text-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-100">
              <BarChart3 size={14} /> Saúde regulatória
            </p>
            <h2 className="mt-3 text-xl font-black">{data.report.headline}</h2>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              Leitura determinística de informações oficiais. Não é recomendação de compra ou venda.
            </p>
          </div>
          <div className={`min-w-28 rounded-2xl px-4 py-3 text-center ring-1 ${scoreTone(data.scores.overall)}`}>
            <span className="block text-xs font-extrabold uppercase tracking-wide">Score geral</span>
            <strong className="mt-1 block text-3xl">{formatNumber(data.scores.overall)}</strong>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{card.label}</p>
              <strong className="mt-2 block text-xl text-slate-900">{card.value}</strong>
              <span className="mt-1 block text-xs font-bold text-indigo-700">{card.trend}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Score label="Qualidade dos dados" value={data.scores.dataQuality} />
          <Score label="Patrimônio" value={data.scores.patrimonial} />
          <Score label="Risco observado" value={data.scores.risk} inverse />
        </div>

        {!!data.report.alerts?.length && (
          <div className="mt-5 space-y-2">
            <h3 className="text-sm font-extrabold text-slate-800">Pontos de atenção</h3>
            {data.report.alerts.map((alert) => {
              const style = alertStyle(alert.severity);
              const Icon = style.icon;
              return (
                <div key={alert.code} className={`rounded-2xl p-4 ring-1 ${style.className}`}>
                  <p className="flex items-center gap-2 text-sm font-extrabold"><Icon size={17} /> {alert.title}</p>
                  <p className="mt-1 text-sm leading-6">{alert.detail}</p>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-100 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-extrabold text-indigo-950"><Crown size={17} /> Relatório completo</p>
            <p className="mt-1 text-sm leading-6 text-indigo-800">
              Veja todas as notas, timeline regulatória, documentos e pontos de atenção.
            </p>
          </div>
          <Link
            href={`/fii/${normalizedTicker}/relatorio`}
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-indigo-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-indigo-800"
          >
            Abrir relatório
          </Link>
        </div>

        <p className="mt-4 text-xs leading-5 text-slate-500">
          Fonte regulatória: {data.regulatory?.source || "base oficial revisada"} · {formatNumber(data.regulatory?.documentsCount)} documentos vinculados · metodologia v{data.scoreMeta?.methodologyVersion || 1}.
        </p>
      </div>
    </section>
  );
}

function Score({ label, value, inverse = false }: { label: string; value: unknown; inverse?: boolean }) {
  return (
    <div className={`rounded-2xl px-4 py-3 ring-1 ${scoreTone(value, inverse)}`}>
      <p className="text-xs font-extrabold uppercase tracking-wide">{label}</p>
      <strong className="mt-1 block text-2xl">{formatNumber(value)}</strong>
    </div>
  );
}
