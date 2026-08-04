'use client';

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Info,
  Loader2,
} from "lucide-react";
import {
  buildPortfolioIntelligencePresentation,
  visiblePortfolioIntelligenceSignals,
  type PortfolioIntelligenceResult,
  type PortfolioIntelligenceSignalView,
} from "@/lib/portfolio-intelligence";
import PortfolioIntelligenceExplanationPanel from "./PortfolioIntelligenceExplanationPanel";

function SignalSeverityIcon({ signal }: { signal: PortfolioIntelligenceSignalView }) {
  if (signal.severity === "warning") return <AlertTriangle size={16} aria-hidden="true" />;
  if (signal.severity === "attention") return <CircleAlert size={16} aria-hidden="true" />;
  return <Info size={16} aria-hidden="true" />;
}

function SignalCard({ signal }: { signal: PortfolioIntelligenceSignalView }) {
  const tone = signal.severity === "warning"
    ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
    : signal.severity === "attention"
      ? "border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/40"
      : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900";

  return (
    <article data-signal-code={signal.code} className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            <SignalSeverityIcon signal={signal} /> {signal.severityLabel}
          </p>
          <h4 className="mt-2 text-base font-extrabold text-slate-950 dark:text-white">{signal.title}</h4>
        </div>
        <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-300 dark:bg-slate-950/70 dark:text-slate-200 dark:ring-slate-600">
          Confiança {signal.confidenceLabel.toLowerCase()}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{signal.summary}</p>
      {signal.evidence.length > 0 && (
        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          {signal.evidence.map((item) => (
            <div key={item.key} className="rounded-lg bg-white/75 p-2.5 ring-1 ring-black/5 dark:bg-slate-950/60 dark:ring-white/10">
              <dt className="font-bold text-slate-600 dark:text-slate-300">{item.label}</dt>
              <dd className="mt-1 break-words font-extrabold text-slate-950 dark:text-white">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

export function PortfolioIntelligenceLoading() {
  return (
    <section
      aria-busy="true"
      aria-labelledby="portfolio-intelligence-loading-title"
      data-testid="portfolio-intelligence-loading"
      className="mt-6 min-w-0 overflow-hidden rounded-2xl bg-white p-5 text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-gray-950 dark:text-gray-100 dark:ring-gray-800"
    >
      <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
        <Loader2 className="motion-safe:animate-spin" size={14} aria-hidden="true" /> Inteligência da carteira
      </p>
      <h2 id="portfolio-intelligence-loading-title" className="mt-3 text-xl font-black text-slate-950 dark:text-white">
        Atualizando a análise da carteira
      </h2>
      <p role="status" className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
        Aguardando os dados regulatórios das posições. Nenhuma conclusão foi emitida durante o carregamento.
      </p>
    </section>
  );
}

export default function PortfolioIntelligencePanel({ result }: { result: PortfolioIntelligenceResult }) {
  const [expanded, setExpanded] = useState(false);
  const presentation = useMemo(() => buildPortfolioIntelligencePresentation(result), [result]);
  const visibleSignals = visiblePortfolioIntelligenceSignals(presentation, expanded);

  return (
    <section
      aria-labelledby="portfolio-intelligence-title"
      data-testid="portfolio-intelligence"
      data-analysis-state={presentation.state}
      className="mt-6 min-w-0 overflow-hidden rounded-2xl bg-white p-5 text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-gray-950 dark:text-gray-100 dark:ring-gray-800"
    >
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

      <dl aria-label="Resumo da inteligência da carteira" className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <dt className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-300">Estado da renda</dt>
          <dd data-testid="portfolio-income-state" className="mt-1 text-lg font-black text-slate-950 dark:text-white">{presentation.summary.incomeLabel}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <dt className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-300">Qualidade dos dados</dt>
          <dd data-testid="portfolio-quality-state" className="mt-1 text-lg font-black text-slate-950 dark:text-white">{presentation.summary.qualityLabel}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <dt className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-300">Pontos de atenção</dt>
          <dd data-testid="portfolio-attention-count" className="mt-1 text-lg font-black text-slate-950 dark:text-white">{presentation.summary.attentionLabel}</dd>
        </div>
      </dl>

      <p
        role={presentation.state === "invalid" ? "alert" : undefined}
        className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"
      >
        {presentation.stateMessage}
      </p>

      <div className="mt-6">
        <h3 className="text-base font-black text-slate-950 dark:text-white">Sinais prioritários</h3>
        <div id="portfolio-intelligence-signals" className="mt-3 grid gap-3">
          {visibleSignals.length > 0
            ? visibleSignals.map((item) => <SignalCard key={item.code} signal={item} />)
            : <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">Nenhum sinal foi emitido com os dados atuais.</p>}
        </div>

        {presentation.hasMoreSignals && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="portfolio-intelligence-signals"
            onClick={() => setExpanded((current) => !current)}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-extrabold text-slate-800 outline-none hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
          >
            {expanded ? <ChevronUp size={17} aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}
            {expanded ? "Recolher sinais" : `Ver todos os ${presentation.allSignals.length} sinais`}
          </button>
        )}
      </div>

      <div className="mt-6 border-t border-slate-200 pt-5 dark:border-gray-800">
        <h3 className="flex items-center gap-2 text-base font-black text-slate-950 dark:text-white">
          <BarChart3 size={17} aria-hidden="true" /> Dados usados nesta análise
        </h3>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="font-bold text-slate-600 dark:text-slate-300">Histórico</dt><dd className="mt-1 text-slate-900 dark:text-white">{presentation.dataUsed.monthsLabel}</dd></div>
          <div><dt className="font-bold text-slate-600 dark:text-slate-300">Cotações</dt><dd className="mt-1 text-slate-900 dark:text-white">{presentation.dataUsed.positionsLabel}</dd></div>
          <div><dt className="font-bold text-slate-600 dark:text-slate-300">Cobertura de segmentos</dt><dd className="mt-1 text-slate-900 dark:text-white">{presentation.dataUsed.segmentCoverageLabel}</dd></div>
          <div><dt className="font-bold text-slate-600 dark:text-slate-300">Cobertura de renda</dt><dd className="mt-1 text-slate-900 dark:text-white">{presentation.dataUsed.incomeCoverageLabel}</dd></div>
        </dl>

        {presentation.dataUsed.reasons.length > 0 ? (
          <ul aria-label="Ressalvas da análise" className="mt-4 grid gap-2">
            {presentation.dataUsed.reasons.map((reason) => (
              <li key={reason.code} data-quality-reason={reason.code} className="rounded-lg bg-slate-50 p-3 text-sm leading-6 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                <strong className="block text-slate-950 dark:text-white">{reason.impactLabel}</strong>
                <span className="text-slate-700 dark:text-slate-200">{reason.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Nenhuma ressalva de cobertura foi identificada.</p>
        )}
      </div>

      <PortfolioIntelligenceExplanationPanel key={`${result.generatedAt}:${result.asOf}`} result={result} />

      <p className="mt-5 border-t border-slate-200 pt-4 text-xs font-semibold leading-5 text-slate-600 dark:border-gray-800 dark:text-gray-300">
        Conteúdo informativo, sem recomendação de investimento.
      </p>
    </section>
  );
}
