'use client';

import { useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import type {
  PortfolioIntelligenceDataQuality,
  PortfolioIntelligenceResult,
  PortfolioIntelligenceSignal,
} from "@/lib/portfolio-intelligence";

const EVIDENCE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  monthsAvailable: "Meses válidos",
  monthsRequired: "Meses necessários",
  pricedPositions: "Posições com cotação",
  totalPositions: "Total de posições",
  segmentCoveragePercent: "Cobertura de segmentos",
  incomeKnownPositions: "Posições com renda estimada",
  largestTicker: "Maior posição",
  largestPositionPercent: "Participação da maior posição",
  topThreePercent: "Participação das três maiores",
  hhi: "HHI patrimonial",
  ticker: "Fundo",
  estimatedIncome: "Renda estimada",
  sharePercent: "Participação",
  totalEstimatedIncome: "Renda estimada total",
  segment: "Segmento",
  coveragePercent: "Cobertura",
  previousAverage: "Média dos três meses anteriores",
  recentAverage: "Média dos três meses recentes",
  variationPercent: "Variação",
  sixMonthAverage: "Média de seis meses",
  populationStandardDeviation: "Desvio-padrão populacional",
  coefficientOfVariationPercent: "Coeficiente de variação",
  competence: "Competência",
  value: "Valor do mês",
  baselineMedian: "Mediana dos seis meses anteriores",
  mad: "MAD",
  robustScore: "Índice robusto",
  relativeDeviationPercent: "Desvio relativo",
});

const CURRENCY_EVIDENCE = new Set([
  "estimatedIncome",
  "totalEstimatedIncome",
  "previousAverage",
  "recentAverage",
  "sixMonthAverage",
  "populationStandardDeviation",
  "value",
  "baselineMedian",
  "mad",
]);

function formatEvidence(key: string, value: string | number | boolean | null) {
  if (value === null) return "Não disponível";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number" && CURRENCY_EVIDENCE.has(key)) {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (typeof value === "number" && /Percent$/.test(key)) {
    return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  }
  if (typeof value === "number") {
    return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  }
  return value;
}

function qualityLabel(quality: PortfolioIntelligenceDataQuality) {
  if (quality.state === "sufficient") return "Dados suficientes";
  if (quality.state === "partial") return "Dados parciais";
  return "Dados insuficientes";
}

function SignalCard({ signal }: { signal: PortfolioIntelligenceSignal }) {
  const tone = signal.severity === "warning"
    ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
    : signal.severity === "attention"
      ? "border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/40"
      : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900";
  const evidence = Object.entries(signal.evidence).slice(0, 5);

  return (
    <article data-signal-code={signal.code} className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-extrabold text-slate-950 dark:text-white">{signal.title}</h3>
        <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-950/70 dark:text-slate-300 dark:ring-slate-700">
          Confiança {signal.confidence === "high" ? "alta" : signal.confidence === "medium" ? "média" : "baixa"}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{signal.summary}</p>
      {evidence.length > 0 && (
        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          {evidence.map(([key, value]) => (
            <div key={key} className="rounded-lg bg-white/75 p-2.5 ring-1 ring-black/5 dark:bg-slate-950/60 dark:ring-white/10">
              <dt className="font-bold text-slate-500 dark:text-slate-400">{EVIDENCE_LABELS[key] ?? key}</dt>
              <dd className="mt-1 font-extrabold text-slate-900 dark:text-white">{formatEvidence(key, value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

export default function PortfolioIntelligencePanel({ result }: { result: PortfolioIntelligenceResult }) {
  const [expanded, setExpanded] = useState(false);
  const visibleSignals = expanded ? result.signals : result.signals.slice(0, 3);
  const hasMore = result.signals.length > 3;

  return (
    <section
      aria-labelledby="portfolio-intelligence-title"
      data-testid="portfolio-intelligence"
      className="mt-6 min-w-0 overflow-hidden rounded-2xl bg-white p-5 text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-gray-950 dark:text-gray-100 dark:ring-gray-800"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
            <Info size={14} aria-hidden="true" /> Inteligência da carteira
          </p>
          <h2 id="portfolio-intelligence-title" className="mt-3 text-xl font-black text-slate-950 dark:text-white">
            O que merece atenção na sua carteira
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Leitura determinística baseada no histórico consolidado e nos dados disponíveis das posições.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700 dark:bg-gray-900 dark:text-gray-200">
          {qualityLabel(result.dataQuality)}
        </span>
      </div>

      <div id="portfolio-intelligence-signals" aria-live="polite" className="mt-5 grid gap-3">
        {visibleSignals.map((item) => <SignalCard key={item.code} signal={item} />)}
      </div>

      {hasMore && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="portfolio-intelligence-signals"
          onClick={() => setExpanded((current) => !current)}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-extrabold text-slate-800 outline-none hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
        >
          {expanded ? <ChevronUp size={17} aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}
          {expanded ? "Mostrar menos" : `Ver todos os ${result.signals.length} sinais`}
        </button>
      )}

      <p className="mt-5 border-t border-slate-200 pt-4 text-xs font-semibold leading-5 text-slate-500 dark:border-gray-800 dark:text-gray-400">
        Conteúdo informativo, sem recomendação de investimento.
      </p>
    </section>
  );
}
