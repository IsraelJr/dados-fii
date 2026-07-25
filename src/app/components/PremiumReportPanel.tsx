"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Crown, LockKeyhole, RefreshCw } from "lucide-react";
import { auth } from "@/lib/firebase";
import { productPlanLabel } from "@/lib/productPlans";
import type { PremiumFundReport } from "@/types/premium-report";

type PremiumResponse = { ok?: boolean; report?: PremiumFundReport; error?: string; access?: { plan?: string } };
type WalletItem = { ticker?: string; quotas?: number; quantity?: number };
const WALLET_STORAGE_KEY = "dados-fii-wallet-v1";

function value(number: number | null, suffix = "", digits = 2) {
  return number === null ? "-" : `${number.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}${suffix}`;
}

function currency(number: number | null) {
  return number === null ? "-" : number.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function signedCurrency(number: number | null) {
  if (number === null) return "-";
  return `${number > 0 ? "+" : ""}${currency(number)}`;
}

function wallet() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WALLET_STORAGE_KEY) || "[]") as WalletItem[];
    return Array.isArray(parsed) ? parsed.map((item) => ({ ticker: item.ticker, quotas: item.quotas || item.quantity })) : [];
  } catch {
    return [];
  }
}

export default function PremiumReportPanel({ ticker }: { ticker: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [report, setReport] = useState<PremiumFundReport | null>(null);
  const [plan, setPlan] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => auth ? onAuthStateChanged(auth, setUser) : undefined, []);

  async function generate() {
    if (!user) {
      setError("Entre na sua conta Premium ou Super Premium para gerar o relatório.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/fii/${encodeURIComponent(ticker)}/report/premium`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ holdings: wallet() }),
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
          <h2 className="mt-2 text-2xl font-black text-slate-900">Risk Lab, valuation, cenários e Modo Gestor informativo</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Análise protegida para assinantes, construída sobre dados regulatórios, ScoreEngine e AI Insights Engine.</p>
        </div>
        {!report && <button type="button" onClick={generate} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-5 py-3 text-sm font-extrabold text-slate-950 hover:bg-amber-400 disabled:opacity-60">{loading ? <RefreshCw className="animate-spin" size={16} /> : <LockKeyhole size={16} />} {loading ? "Gerando…" : "Acessar Premium"}</button>}
      </div>

      {error && <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 ring-1 ring-red-100">{error}</p>}

      {report && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <PremiumMetric label="Plano" content={productPlanLabel(plan)} description="Plano comercial que dá acesso a este relatório." />
            <PremiumMetric label="P/VP" content={value(report.valuation.pvp)} description="Preço da cota dividido pelo valor patrimonial por cota." />
            <PremiumMetric label="Ágio/desconto" content={value(report.valuation.premiumDiscountPercent, "%")} description="Positivo indica preço acima do VP; negativo indica preço abaixo do VP." />
            <PremiumMetric label="Percentil entre pares" content={report.comparative.percentile === null ? "Amostra insuficiente" : value(report.comparative.percentile, "%")} description="Posição da nota composta diante de fundos comparáveis; não mede retorno futuro." />
            <PremiumMetric label="Risk Lab" content={report.riskLab.availability === "available" ? (report.riskLab.disposition || "Disponível") : report.riskLab.availability === "inconclusive" ? "Inconclusivo" : "Indisponível"} description="Leitura histórica homologada e read-only; não envia alertas nem recomenda operações." />
          </div>

          <PremiumSection title="Leitura de valuation"><p>{report.valuation.explanation}</p><p className="mt-2 text-xs text-slate-500">VP/cota estimado: {value(report.valuation.estimatedNavPerShare)}</p><p className="mt-3"><strong>Na prática:</strong> ágio ou desconto não muda o valor da carteira sozinho; mostra quanto o preço se afastou do patrimônio contábil. O peso da posição indica quanto essa avaliação merece atenção.</p></PremiumSection>

          <PremiumSection title="Impacto na sua carteira">
            <p>{report.portfolioImpact.summary}</p>
            {report.portfolioImpact.available ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><PortfolioMetric label="Cotas" content={value(report.portfolioImpact.holdingQuotas, "", 0)} /><PortfolioMetric label="Valor da posição" content={currency(report.portfolioImpact.currentPositionValue)} /><PortfolioMetric label="Renda mensal estimada" content={currency(report.portfolioImpact.estimatedMonthlyIncome)} /><PortfolioMetric label="Peso na carteira" content={value(report.portfolioImpact.portfolioWeightPercent, "%")} /></div> : <p className="mt-3 rounded-xl bg-white p-3 text-sm ring-1 ring-amber-200">Adicione este fundo à carteira neste navegador para ver o efeito em reais.</p>}
            {!!report.portfolioImpact.totalHoldings && <p className="mt-3 text-xs text-slate-500">Cobertura de cotações: {report.portfolioImpact.coveredHoldings} de {report.portfolioImpact.totalHoldings} posições.</p>}
          </PremiumSection>

          <PremiumSection title="Risk Lab — leitura histórica homologada">
            <p>{report.riskLab.summary}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><PortfolioMetric label="Disponibilidade" content={report.riskLab.availability} /><PortfolioMetric label="Disposição" content={report.riskLab.disposition || "-"} /><PortfolioMetric label="Ruleset" content={report.riskLab.rulesetVersion} /><PortfolioMetric label="Modo" content="Somente leitura" /></div>
            {report.riskLab.stressDetectedAt && <p className="mt-3 text-xs text-slate-500">Estresse conhecido em {new Date(report.riskLab.stressDetectedAt).toLocaleDateString("pt-BR")}{report.riskLab.recoveryDetectedAt ? ` · recuperação conhecida em ${new Date(report.riskLab.recoveryDetectedAt).toLocaleDateString("pt-BR")}` : ""}.</p>}
            <ul className="mt-3 space-y-1 text-xs text-slate-500">{report.riskLab.limitations.map((item) => <li key={item}>• {item}</li>)}</ul>
          </PremiumSection>

          <PremiumSection title="Modo Gestor — qualidade e limites da decisão">
            <div className="grid gap-3 sm:grid-cols-3"><PortfolioMetric label="Qualidade dos dados" content={`${report.managerMode.dataQualityScore}/100`} /><PortfolioMetric label="Nível" content={report.managerMode.dataQualityLevel} /><PortfolioMetric label="Ação permitida" content="Monitoramento" /></div>
            <p className="mt-4 font-bold text-slate-900">Leitura objetiva</p>
            <ul className="mt-1 space-y-1">{report.managerMode.objectiveReading.map((item) => <li key={item}>• {item}</li>)}</ul>
            <p className="mt-4 font-bold text-slate-900">Dados ainda indisponíveis para uma decisão de aporte</p>
            <p className="mt-1">{report.managerMode.missingInputs.join("; ")}.</p>
            <p className="mt-4 rounded-xl bg-white p-3 font-bold text-slate-900 ring-1 ring-amber-200">{report.managerMode.controlPrinciple}</p>
          </PremiumSection>

          <div className="grid gap-4 lg:grid-cols-3">
            {report.stressTest.map((item) => { const impact = report.portfolioImpact.stressTests.find((entry) => entry.id === item.id); return <PremiumSection key={item.id} title={item.label}><p>{item.explanation}</p><p className="mt-3"><strong>Hipótese:</strong> preço {value(item.priceShockPercent, "%", 0)} e rendimento {value(item.dividendShockPercent, "%", 0)}.</p><p className="mt-2">Preço por cota: {currency(item.stressedPrice)} · rendimento por cota: {value(item.stressedMonthlyDividend, "", 3)}</p>{impact && <PortfolioProjection impact={impact} />}</PremiumSection>; })}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {report.scenarios.map((scenario) => { const impact = report.portfolioImpact.scenarios.find((entry) => entry.id === scenario.id); return <PremiumSection key={scenario.id} title={scenario.label}><p>{scenario.explanation}</p><p className="mt-3 font-bold text-slate-900">Hipóteses da simulação</p><ul className="mt-1">{scenario.assumptions.map((assumption) => <li key={assumption}>• {assumption}</li>)}</ul><p className="mt-2">Preço por cota: {currency(scenario.projectedPrice)} · DY anualizado: {value(scenario.projectedAnnualizedYieldPercent, "%")}</p>{impact && <PortfolioProjection impact={impact} />}</PremiumSection>; })}
          </div>

          <PremiumSection title={`Comparativo — ${report.comparative.peerGroup}`}><p>{report.comparative.explanation}</p><p className="mt-3">Nota composta atual: {value(report.comparative.current.premium, "/100")} · média dos pares: {value(report.comparative.peerAverage.premium, "/100")}.</p><p className="mt-3 font-bold text-slate-900">Impacto na carteira</p><p className="mt-1">O percentil não altera o patrimônio. Ele apenas contextualiza a nota; sua relevância cresce quando este fundo tem peso elevado na carteira.</p></PremiumSection>

          <PremiumSection title="Plano de acompanhamento"><div className="space-y-3">{report.recommendations.map((item, index) => <div key={`${item.category}-${index}`} className="rounded-xl bg-white p-3 ring-1 ring-amber-200"><p className="text-xs font-extrabold uppercase text-amber-700">{item.priority} · {item.category}</p><p className="mt-1 font-bold text-slate-900">{item.action}</p><p className="mt-1 text-xs text-slate-500">Gatilho: {item.trigger}</p></div>)}</div></PremiumSection>

          <PremiumSection title="Análise exclusiva do relatório Premium">
            <p>{report.aiAnalysis.executiveSummary}</p>
            <p className="mt-4 font-bold text-slate-900">O que esta análise acrescenta</p>
            <p className="mt-1">{report.aiAnalysis.differentiatedInsight}</p>
            <p className="mt-4 font-bold text-slate-900">Impacto na sua carteira</p>
            <p className="mt-1">{report.aiAnalysis.portfolioReading}</p>
            <p className="mt-4 font-bold text-slate-900">Contexto entre pares</p>
            <p className="mt-1">{report.aiAnalysis.peerReading}</p>
            <p className="mt-4 font-bold text-slate-900">Leitura do Risk Lab</p>
            <p className="mt-1">{report.aiAnalysis.riskLabReading}</p>
            <p className="mt-4 font-bold text-slate-900">Qualidade dos dados e conclusão do Modo Gestor</p>
            <p className="mt-1">{report.aiAnalysis.dataQualityReading}</p>
            <p className="mt-2">{report.aiAnalysis.managerModeConclusion}</p>
            {!!report.aiAnalysis.positiveTriggers.length && <><p className="mt-4 font-bold text-slate-900">Gatilhos positivos</p><ul className="mt-1 space-y-1">{report.aiAnalysis.positiveTriggers.map((item) => <li key={item}>• {item}</li>)}</ul></>}
            {!!report.aiAnalysis.negativeTriggers.length && <><p className="mt-4 font-bold text-slate-900">Gatilhos negativos</p><ul className="mt-1 space-y-1">{report.aiAnalysis.negativeTriggers.map((item) => <li key={item}>• {item}</li>)}</ul></>}
            <p className="mt-4 font-bold text-slate-900">Gatilhos objetivos para acompanhar</p>
            <ul className="mt-1 space-y-1">{report.aiAnalysis.monitoringTriggers.map((item) => <li key={item}>• {item}</li>)}</ul>
            <p className="mt-4 font-bold text-slate-900">Em linguagem simples</p>
            <p className="mt-1">{report.aiAnalysis.plainLanguage}</p>
          </PremiumSection>

          <div className="text-xs leading-5 text-slate-500">{report.disclaimer.map((item) => <p key={item}>• {item}</p>)}</div>
        </div>
      )}
    </section>
  );
}

function PremiumMetric({ label, content, description }: { label: string; content: string; description: string }) {
  return <div className="rounded-2xl bg-slate-950 p-4 text-white"><p className="text-xs font-bold uppercase text-amber-300">{label}</p><p className="mt-2 text-xl font-black">{content}</p><p className="mt-2 text-xs leading-5 text-slate-300">{description}</p></div>;
}

function PortfolioMetric({ label, content }: { label: string; content: string }) {
  return <div className="rounded-xl bg-white p-3 ring-1 ring-amber-200"><p className="text-xs font-bold uppercase text-amber-700">{label}</p><p className="mt-1 font-black text-slate-900">{content}</p></div>;
}

function PortfolioProjection({ impact }: { impact: PremiumFundReport["portfolioImpact"]["scenarios"][number] }) {
  return <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-amber-200"><p className="font-bold text-slate-900">Na sua carteira</p><p className="mt-1">Valor da posição: {currency(impact.projectedPositionValue)} ({signedCurrency(impact.positionValueChange)}).</p><p>Renda mensal estimada: {currency(impact.projectedMonthlyIncome)} ({signedCurrency(impact.monthlyIncomeChange)}).</p></div>;
}

function PremiumSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <article className="rounded-2xl bg-amber-50/70 p-4 text-sm leading-6 text-slate-700 ring-1 ring-amber-200"><h3 className="mb-2 text-lg font-black text-slate-900">{title}</h3>{children}</article>;
}
