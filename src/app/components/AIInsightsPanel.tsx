"use client";

import { useState } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import type { FundAIInsights } from "@/types/ai-insights";

type ApiResponse = { ok?: boolean; insights?: FundAIInsights; error?: string };

export default function AIInsightsPanel({ ticker }: { ticker: string }) {
  const [insights, setInsights] = useState<FundAIInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadInsights() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/fii/${encodeURIComponent(ticker)}/insights`, { method: "GET" });
      const payload = await response.json().catch(() => ({})) as ApiResponse;
      if (!response.ok || !payload.insights) throw new Error(payload.error || "Não foi possível gerar os insights.");
      setInsights(payload.insights);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível gerar os insights.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-950 to-slate-900 p-5 text-white shadow-lg ring-1 ring-white/10 md:p-7">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-indigo-300"><Sparkles size={15} /> AI Insights Engine</p>
          <h2 className="mt-2 text-2xl font-black">Entenda {ticker} em linguagem simples</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Resumo, mudanças, riscos, oportunidades e alertas gerados a partir do relatório automático.</p>
        </div>
        {!insights && (
          <button type="button" onClick={loadInsights} disabled={loading} className="rounded-full bg-indigo-500 px-5 py-3 text-sm font-extrabold text-white hover:bg-indigo-400 disabled:cursor-wait disabled:opacity-60">
            {loading ? "Gerando insights..." : "Gerar insights"}
          </button>
        )}
      </div>

      {error && <p className="mt-5 flex items-center gap-2 rounded-xl bg-red-950/60 p-4 text-sm text-red-200 ring-1 ring-red-800"><AlertTriangle size={17} /> {error}</p>}

      {insights && (
        <div className="mt-6 space-y-5">
          <InsightSection title="Resumo executivo" text={insights.executiveSummary} />
          <div className="grid gap-4 lg:grid-cols-2">
            <InsightList title="Mudanças" items={insights.changes} />
            <InsightList title="Riscos" items={insights.risks} />
            <InsightList title="Oportunidades para acompanhar" items={insights.opportunities} />
            <InsightList title="Alertas" items={insights.alerts} />
          </div>
          <InsightSection title="Em linguagem simples" text={insights.plainLanguage} />
          <p className="text-xs leading-5 text-slate-400">
            Gerado pelo AI Insights Engine · prompt {insights.metadata.promptVersion} · {insights.metadata.cached ? "resultado reutilizado do cache" : "nova geração"}. Conteúdo informativo, sem recomendação de investimento.
          </p>
        </div>
      )}
    </section>
  );
}

function InsightSection({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10"><h3 className="font-extrabold text-indigo-200">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-200">{text}</p></div>;
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
      <h3 className="font-extrabold text-indigo-200">{title}</h3>
      {!items.length ? <p className="mt-2 text-sm text-slate-400">Nenhum item identificado.</p> : <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-200">{items.map((item, index) => <li key={`${title}-${index}`}>• {item}</li>)}</ul>}
    </div>
  );
}
