'use client';

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  History,
  Loader2,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type {
  PortfolioIncrementalChange,
  PortfolioIncrementalComparison,
  PortfolioIntelligenceResult,
} from "@/lib/portfolio-intelligence";

const EMAIL_KEY = "dados-fii-wallet-email";
const TOKEN_KEY = "dados-fii-wallet-session";

type IncrementalResponse = Readonly<{
  ok?: boolean;
  comparison?: PortfolioIncrementalComparison;
  persistence?: Readonly<{
    stored: boolean;
    baselineState: "found" | "missing" | "invalid";
  }>;
  code?: string;
  error?: string;
}>;

type LoadState = "loading" | "ready" | "unavailable" | "disabled";

const categoryLabels = {
  data: "Dados da carteira",
  rule: "Regra de análise",
  coverage: "Cobertura",
  quality: "Qualidade dos dados",
} as const;

const stateLabels = {
  new: "Nova",
  aggravated: "Agravada",
  reduced: "Reduzida",
  resolved: "Resolvida",
  unchanged: "Inalterada",
} as const;

function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "data não disponível";
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

function formatValue(change: PortfolioIncrementalChange, value: PortfolioIncrementalChange["before"]) {
  if (value === null) return "Não disponível";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "string") {
    const labels: Record<string, string> = {
      info: "Informativa",
      attention: "Atenção",
      warning: "Alerta",
      sufficient: "Suficiente",
      partial: "Parcial",
      insufficient: "Insuficiente",
    };
    return labels[value] || value;
  }
  if (/LATEST_INCOME|ESTIMATED_INCOME_TOTAL/.test(change.code)) {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (/COVERAGE|CONCENTRATION|POSITION|TREND|VOLATILITY/.test(change.code)) {
    return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  }
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function ChangeIcon({ change }: { change: PortfolioIncrementalChange }) {
  if (change.state === "aggravated") return <TrendingUp size={17} aria-hidden="true" />;
  if (change.state === "reduced") return <TrendingDown size={17} aria-hidden="true" />;
  if (change.state === "resolved") return <CheckCircle2 size={17} aria-hidden="true" />;
  if (change.category === "rule" || change.category === "quality") return <AlertTriangle size={17} aria-hidden="true" />;
  return <CircleAlert size={17} aria-hidden="true" />;
}

function ChangeCard({ change }: { change: PortfolioIncrementalChange }) {
  const [expanded, setExpanded] = useState(false);
  const tone = change.state === "aggravated"
    ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
    : change.state === "resolved" || change.state === "reduced"
      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
      : "border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/30";

  return (
    <article data-incremental-change={change.code} className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-200">
            <ChangeIcon change={change} /> {categoryLabels[change.category]} · {stateLabels[change.state]}
          </p>
          <h4 className="mt-2 text-base font-black text-slate-950 dark:text-white">{change.title}</h4>
          <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{change.summary}</p>
        </div>
        <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-extrabold text-slate-700 ring-1 ring-slate-300 dark:bg-slate-950/70 dark:text-slate-200 dark:ring-slate-600">
          Material
        </span>
      </div>

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-lg bg-white/80 p-2.5 ring-1 ring-black/5 dark:bg-slate-950/60 dark:ring-white/10">
          <dt className="font-bold text-slate-600 dark:text-slate-300">Antes</dt>
          <dd className="mt-1 break-words font-black text-slate-950 dark:text-white">{formatValue(change, change.before)}</dd>
        </div>
        <div className="rounded-lg bg-white/80 p-2.5 ring-1 ring-black/5 dark:bg-slate-950/60 dark:ring-white/10">
          <dt className="font-bold text-slate-600 dark:text-slate-300">Agora</dt>
          <dd className="mt-1 break-words font-black text-slate-950 dark:text-white">{formatValue(change, change.after)}</dd>
        </div>
      </dl>

      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={`incremental-evidence-${change.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`}
        onClick={() => setExpanded((current) => !current)}
        className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs font-extrabold text-indigo-800 outline-none hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-indigo-600 dark:text-indigo-200 dark:hover:bg-slate-950/50"
      >
        {expanded ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
        {expanded ? "Ocultar evidências" : "Ver evidências da comparação"}
      </button>

      {expanded && (
        <dl
          id={`incremental-evidence-${change.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`}
          className="mt-2 grid gap-2 rounded-lg bg-white/70 p-3 text-xs ring-1 ring-black/5 dark:bg-slate-950/50 dark:ring-white/10 sm:grid-cols-2"
        >
          <div><dt className="font-bold text-slate-600 dark:text-slate-300">Análise anterior</dt><dd className="mt-1 text-slate-900 dark:text-white">{formatDate(change.evidence.previousAsOf)}</dd></div>
          <div><dt className="font-bold text-slate-600 dark:text-slate-300">Análise atual</dt><dd className="mt-1 text-slate-900 dark:text-white">{formatDate(change.evidence.currentAsOf)}</dd></div>
          <div><dt className="font-bold text-slate-600 dark:text-slate-300">Política de materialidade</dt><dd className="mt-1 text-slate-900 dark:text-white">{change.evidence.threshold || "Regra estrutural"}</dd></div>
          <div><dt className="font-bold text-slate-600 dark:text-slate-300">Referências</dt><dd className="mt-1 break-all font-mono text-slate-900 dark:text-white">{change.evidence.previousFingerprint.slice(0, 8)} → {change.evidence.currentFingerprint.slice(0, 8)}</dd></div>
        </dl>
      )}
    </article>
  );
}

export default function PortfolioIncrementalReportPanel({ result }: { result: PortfolioIntelligenceResult }) {
  const [state, setState] = useState<LoadState>("loading");
  const [response, setResponse] = useState<IncrementalResponse | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    setResponse(null);

    async function load() {
      try {
        const email = window.localStorage.getItem(EMAIL_KEY) || "";
        const token = window.localStorage.getItem(TOKEN_KEY) || "";
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (email && token) {
          headers["x-wallet-email"] = email;
          headers["x-wallet-session"] = token;
        }
        const fetchResponse = await fetch("/api/portfolio/incremental-analysis", {
          method: "POST",
          credentials: "same-origin",
          headers,
          body: JSON.stringify({ portfolioId: "default", result }),
          signal: controller.signal,
        });
        const body = await fetchResponse.json().catch(() => null) as IncrementalResponse | null;
        if (fetchResponse.status === 404 && body?.code === "PORTFOLIO_INCREMENTAL_DISABLED") {
          setState("disabled");
          return;
        }
        if (!fetchResponse.ok || !body?.ok || !body.comparison) {
          setResponse(body);
          setState("unavailable");
          return;
        }
        setResponse(body);
        setState("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResponse({ error: "Não foi possível comparar as análises agora." });
        setState("unavailable");
      }
    }

    void load();
    return () => controller.abort();
  }, [result]);

  const comparison = response?.comparison ?? null;
  const visibleChanges = useMemo(() => {
    if (!comparison) return [];
    return expanded ? comparison.materialChanges : comparison.materialChanges.slice(0, 3);
  }, [comparison, expanded]);

  if (state === "disabled") return null;

  return (
    <section
      aria-labelledby="portfolio-incremental-title"
      data-testid="portfolio-incremental-report"
      data-incremental-state={comparison?.status || state}
      className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-indigo-700 dark:text-indigo-200">
            <History size={15} aria-hidden="true" /> Relatório incremental
          </p>
          <h3 id="portfolio-incremental-title" className="mt-2 text-base font-black text-slate-950 dark:text-white">
            O que mudou desde a última análise
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-200">
            A comparação é determinística. Mudanças de regra, cobertura e qualidade ficam separadas das mudanças da carteira.
          </p>
        </div>
        {comparison?.previous && (
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-700">
            Base: {formatDate(comparison.previous.asOf)}
          </span>
        )}
      </div>

      {state === "loading" && (
        <p role="status" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Loader2 className="motion-safe:animate-spin" size={16} aria-hidden="true" /> Comparando com a última análise válida.
        </p>
      )}

      {state === "unavailable" && (
        <p role="status" className="mt-4 inline-flex items-start gap-2 rounded-xl bg-white p-3 text-sm leading-6 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-700">
          <Minus className="mt-1 shrink-0" size={16} aria-hidden="true" />
          {response?.error || "A comparação exige uma carteira identificada e está temporariamente indisponível."}
        </p>
      )}

      {comparison?.status === "baseline" && (
        <div className="mt-4 rounded-xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-700">
          <p className="inline-flex items-center gap-2 font-black text-slate-950 dark:text-white">
            <History size={17} aria-hidden="true" /> Primeira referência criada
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
            {response?.persistence?.baselineState === "invalid"
              ? "A referência anterior era incompatível e foi ignorada com segurança. A análise atual passa a ser a nova base."
              : comparison.summary.message}
          </p>
        </div>
      )}

      {comparison?.status === "unchanged" && (
        <div className="mt-4 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:ring-emerald-900">
          <p className="inline-flex items-center gap-2 font-black text-emerald-900 dark:text-emerald-100">
            <CheckCircle2 size={17} aria-hidden="true" /> Nada material mudou
          </p>
          <p className="mt-2 text-sm leading-6 text-emerald-900 dark:text-emerald-100">{comparison.summary.message}</p>
          {comparison.summary.unchangedSignalCount > 0 && (
            <p className="mt-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
              {comparison.summary.unchangedSignalCount} sinal(is) permaneceu(ram) inalterado(s) e não foi(ram) repetido(s) como novidade.
            </p>
          )}
        </div>
      )}

      {comparison?.status === "changed" && (
        <div className="mt-4">
          <p className="rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-950 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-white dark:ring-slate-700">
            {comparison.summary.message}
          </p>
          <div id="portfolio-incremental-changes" className="mt-3 grid gap-3">
            {visibleChanges.map((item) => <ChangeCard key={item.id} change={item} />)}
          </div>
          {comparison.materialChanges.length > 3 && (
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls="portfolio-incremental-changes"
              onClick={() => setExpanded((current) => !current)}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-extrabold text-slate-800 ring-1 ring-slate-200 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 dark:bg-slate-950 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-900"
            >
              {expanded ? <ChevronUp size={17} aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}
              {expanded ? "Mostrar somente as principais" : `Ver todas as ${comparison.materialChanges.length} mudanças`}
            </button>
          )}
        </div>
      )}

      <p className="mt-4 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">
        Mudanças financeiras são decididas pelo domínio determinístico. A IA não cria nem altera esta comparação.
      </p>
    </section>
  );
}
