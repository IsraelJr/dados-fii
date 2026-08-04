'use client';

import { useState } from "react";
import { CircleAlert, Info, Loader2, Sparkles } from "lucide-react";
import type {
  PortfolioIntelligenceExplanation,
  PortfolioIntelligenceResult,
} from "@/lib/portfolio-intelligence";

type ExplanationResponse = {
  ok?: boolean;
  explanation?: PortfolioIntelligenceExplanation;
  degraded?: boolean;
  error?: string;
};

const confidenceLabels = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
} as const;

export default function PortfolioIntelligenceExplanationPanel({ result }: { result: PortfolioIntelligenceResult }) {
  const [explanation, setExplanation] = useState<PortfolioIntelligenceExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasSignals = result.signals.length > 0;

  async function generateExplanation() {
    if (!hasSignals || loading) return;
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch("/api/portfolio/intelligence/explanation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => null) as ExplanationResponse | null;
      if (!response.ok || !body?.ok || !body.explanation) {
        throw new Error(body?.error || "Não foi possível explicar os sinais agora.");
      }
      setExplanation(body.explanation);
    } catch (caught) {
      const message = caught instanceof DOMException && caught.name === "AbortError"
        ? "A explicação demorou mais que o esperado. Tente novamente."
        : caught instanceof Error
          ? caught.message
          : "Não foi possível explicar os sinais agora.";
      setError(message);
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }

  return (
    <section
      aria-labelledby="portfolio-explanation-title"
      data-testid="portfolio-intelligence-explanation"
      className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/30"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-indigo-700 dark:text-indigo-200">
            <Sparkles size={14} aria-hidden="true" /> Explicação dos sinais
          </p>
          <h3 id="portfolio-explanation-title" className="mt-2 text-base font-black text-slate-950 dark:text-white">
            Entenda o impacto sem recalcular os dados
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-200">
            A explicação usa somente os sinais e evidências já calculados acima. Nenhuma nova métrica ou recomendação é criada.
          </p>
        </div>
        <button
          type="button"
          onClick={generateExplanation}
          disabled={!hasSignals || loading}
          aria-busy={loading}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-extrabold text-white outline-none hover:bg-indigo-800 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          {loading ? <Loader2 className="motion-safe:animate-spin" size={17} aria-hidden="true" /> : <Sparkles size={17} aria-hidden="true" />}
          {loading ? "Explicando..." : explanation ? "Atualizar explicação" : "Explicar estes sinais"}
        </button>
      </div>

      {!hasSignals && (
        <p className="mt-4 rounded-xl bg-white/80 p-3 text-sm text-slate-700 ring-1 ring-indigo-100 dark:bg-slate-950/60 dark:text-slate-200 dark:ring-indigo-900">
          Não há sinal material para explicar com os dados atuais.
        </p>
      )}

      {loading && (
        <p role="status" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-800 dark:text-indigo-100">
          <Loader2 className="motion-safe:animate-spin" size={16} aria-hidden="true" /> Traduzindo os sinais sem alterar os cálculos.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 inline-flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-900">
          <CircleAlert className="mt-0.5 shrink-0" size={16} aria-hidden="true" /> {error}
        </p>
      )}

      {explanation && (
        <div className="mt-5" data-explanation-source={explanation.source}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-indigo-800 ring-1 ring-indigo-200 dark:bg-slate-950 dark:text-indigo-100 dark:ring-indigo-800">
              {explanation.source === "ai" ? "Explicado por IA" : "Explicação determinística"}
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-700">
              Confiança geral {confidenceLabels[explanation.overallConfidence].toLowerCase()}
            </span>
            {explanation.metadata?.cached && (
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-700">
                Resultado reutilizado
              </span>
            )}
          </div>

          <p className="mt-3 text-sm font-semibold leading-6 text-slate-800 dark:text-slate-100">{explanation.summary}</p>

          {explanation.signalExplanations.length > 0 && (
            <div className="mt-4 grid gap-3">
              {explanation.signalExplanations.map((item) => (
                <article key={item.code} data-explained-signal={item.code} className="rounded-xl bg-white/90 p-4 ring-1 ring-indigo-100 dark:bg-slate-950/70 dark:ring-indigo-900">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h4 className="font-black text-slate-950 dark:text-white">{item.title}</h4>
                    <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300">
                      Confiança {confidenceLabels[item.confidence].toLowerCase()}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{item.explanation}</p>
                  <p className="mt-2 inline-flex items-start gap-2 text-sm leading-6 text-indigo-900 dark:text-indigo-100">
                    <Info className="mt-1 shrink-0" size={15} aria-hidden="true" />
                    <span><strong>Por que importa:</strong> {item.whyItMatters}</span>
                  </p>
                </article>
              ))}
            </div>
          )}

          <div className="mt-4 rounded-xl bg-white/80 p-4 ring-1 ring-indigo-100 dark:bg-slate-950/60 dark:ring-indigo-900">
            <h4 className="text-sm font-black text-slate-950 dark:text-white">Limitações desta leitura</h4>
            <ul className="mt-2 grid gap-1.5 text-sm leading-6 text-slate-700 dark:text-slate-200">
              {explanation.limitations.map((limitation) => <li key={limitation}>• {limitation}</li>)}
            </ul>
          </div>

          <p className="mt-4 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">{explanation.disclaimer}</p>
        </div>
      )}
    </section>
  );
}
