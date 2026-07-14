"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Crown, LockKeyhole, RefreshCw } from "lucide-react";
import { auth } from "@/lib/firebase";
import type { PremiumFundReport } from "@/types/premium-report";

type PremiumResponse = { ok?: boolean; report?: PremiumFundReport; error?: string; access?: { plan?: string } };

function value(number: number | null, suffix = "") {
  return number === null ? "-" : `${number.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${suffix}`;
}

export default function PremiumReportPanel({ ticker }: { ticker: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [report, setReport] = useState<PremiumFundReport | null>(null);
  const [plan, setPlan] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  async function generate() {
    if (!user) {
      setError("Entre na sua conta Premium/VIP para gerar o relatório.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/fii/${encodeURIComponent(ticker)}/report/premium`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({})) as PremiumResponse;
      if (!response.ok || !payload.report) throw new Error(payload.error || "Não foi possível gerar o Premium.");
      setReport(payload.report);
      setPlan(payload.access?.plan || "premium");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível gerar o Premium.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-amber-300 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm md:p-7">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-amber-700"><Crown size={16} /> Relatório Premium</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">Valuation, stress test, cenários e comparativos</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Análise protegida para assinantes, construída sobre dados regulatórios, ScoreEngine e AI Insights Engine.</p>
        </div>
        {!report && <button type="button" onClick={generate} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-5 py-3 text-sm font-extrabold text-slate-950 hover:bg-amber-400 disabled:opacity-60">{loading ? <RefreshCw className="animate-spin" size={16} /> : <LockKeyhole size={16} />} {loading ? "Gerando…" : "Acessar Premium"}</button>}
      </div>

      {error && <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 ring-1 ring-red-100">{error}</p>}

      {report && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PremiumMetric label="Plano" content={plan.toUpperCase()} />
            <PremiumMetric label="P/VP" content={value(report.valuation.pvp)} />
            <PremiumMetric label="Ágio/desconto" content={value(report.valuation.premiumDiscountPercent, "%")} />
            <PremiumMetric label="Percentil entre pares" content={value(report.comparative.percentile, "%")} />
          </div>

          <PremiumSection title="Leitura de valuation"><p>{report.valuation.explanation}</p><p className="mt-2 text-xs text-slate-500">VP/cota estimado: {value(report.valuation.estimatedNavPerShare)}</p></PremiumSection>

          <div className="grid gap-4 lg:grid-cols-3">
            {report.stressTest.map((item) => <PremiumSection key={item.id} title={item.label}><p>Preço: {value(item.stressedPrice)} · Rendimento: {value(item.stressedMonthlyDividend)}</p><p className="mt-2">Yield anualizado: {value(item.annualizedYieldPercent, "%")} · Score estimado: {value(item.estimatedScore, "/100")}</p></PremiumSection>)}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {report.scenarios.map((scenario) => <PremiumSection key={scenario.id} title={scenario.label}><ul>{scenario.assumptions.map((assumption) => <li key={assumption}>• {assumption}</li>)}</ul><p className="mt-2">Preço sensível: {value(scenario.projectedPrice)} · DY anualizado: {value(scenario.projectedAnnualizedYieldPercent, "%")}</p></PremiumSection>)}
          </div>

          <PremiumSection title={`Comparativo — ${report.comparative.peerGroup}`}><p>{report.comparative.peerCount} fundo(s) comparável(is). Nota composta atual: {value(report.comparative.current.premium, "/100")} · média dos pares: {value(report.comparative.peerAverage.premium, "/100")}.</p></PremiumSection>

          <PremiumSection title="Plano de acompanhamento"><div className="space-y-3">{report.recommendations.map((item, index) => <div key={`${item.category}-${index}`} className="rounded-xl bg-white p-3 ring-1 ring-amber-200"><p className="text-xs font-extrabold uppercase text-amber-700">{item.priority} · {item.category}</p><p className="mt-1 font-bold text-slate-900">{item.action}</p><p className="mt-1 text-xs text-slate-500">Gatilho: {item.trigger}</p></div>)}</div></PremiumSection>

          <PremiumSection title="Análise do AI Insights Engine"><p>{report.aiAnalysis.executiveSummary}</p><p className="mt-3 font-bold text-slate-900">Em linguagem simples</p><p className="mt-1">{report.aiAnalysis.plainLanguage}</p></PremiumSection>

          <div className="text-xs leading-5 text-slate-500">{report.disclaimer.map((item) => <p key={item}>• {item}</p>)}</div>
        </div>
      )}
    </section>
  );
}

function PremiumMetric({ label, content }: { label: string; content: string }) {
  return <div className="rounded-2xl bg-slate-950 p-4 text-white"><p className="text-xs font-bold uppercase text-amber-300">{label}</p><p className="mt-2 text-xl font-black">{content}</p></div>;
}

function PremiumSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <article className="rounded-2xl bg-amber-50/70 p-4 text-sm leading-6 text-slate-700 ring-1 ring-amber-200"><h3 className="mb-2 text-lg font-black text-slate-900">{title}</h3>{children}</article>;
}
