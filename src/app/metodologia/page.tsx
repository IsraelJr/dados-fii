import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BarChart3, CheckCircle2, FileText, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Metodologia",
  description: "Entenda como o Dados FII organiza dados de FIIs, carteira, dividendos, benchmarks e relatórios de risco.",
};

const pillars = [
  {
    title: "Carteira e concentração",
    description: "O peso de cada FII é calculado pelo valor financeiro da posição. Isso evita distorções causadas pela quantidade de cotas.",
  },
  {
    title: "Dividendos e renda",
    description: "A renda estimada considera os dividendos disponíveis na base, com atenção para recorrência, cortes e concentração da renda em poucos ativos.",
  },
  {
    title: "Liquidez",
    description: "Quando há liquidez diária disponível, ela é usada para estimar a facilidade de saída da posição e o risco de vender em cenário adverso.",
  },
  {
    title: "Valuation",
    description: "P/VP, VP por cota, patrimônio líquido e valor de mercado só devem ser usados quando os dados estiverem consistentes. Dado incoerente é desconsiderado por prudência.",
  },
  {
    title: "Benchmarks e macro",
    description: "CDI, IPCA, Selic e IFIX são usados como contexto para interpretar juros, inflação, custo de oportunidade e ambiente de mercado para FIIs.",
  },
  {
    title: "Risco e ação",
    description: "O relatório prioriza gestão de risco: pausar novos aportes, diluir concentração, monitorar gatilhos e evitar decisões automáticas de compra ou venda.",
  },
];

const reportSections = [
  "Memorando executivo com a tese central e os principais riscos.",
  "Qualidade dos dados, mostrando o que é confiável e o que limita a análise.",
  "Concentração por ativo, segmento e tipo de fundo.",
  "Sustentabilidade da renda e risco de corte de dividendos.",
  "Liquidez e risco de saída em cenários normais e estressados.",
  "Valuation e margem de segurança quando os dados permitem.",
  "Ranking de qualidade ajustada ao risco dentro da carteira.",
  "Bull case, bear case, red team, stress test e plano de ação.",
];

export default function MetodologiaPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
        <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-700">
          <ShieldCheck size={14} /> Transparência da análise
        </p>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-5xl">Metodologia do Dados FII</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          A metodologia do Dados FII foi construída para transformar dados de fundos imobiliários em leitura prática de risco, renda e concentração. O objetivo é apoiar acompanhamento e estudo, não substituir uma análise profissional individualizada.
        </p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {pillars.map((pillar) => (
          <article key={pillar.title} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
              <BarChart3 size={18} />
            </div>
            <h2 className="mt-4 text-lg font-extrabold text-slate-900">{pillar.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{pillar.description}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.85fr]">
        <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-emerald-700">
            <FileText size={14} /> Relatório de risco
          </p>
          <h2 className="mt-4 text-2xl font-black text-slate-900">Como o relatório é estruturado</h2>
          <div className="mt-5 grid gap-3">
            {reportSections.map((section) => (
              <div key={section} className="flex gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={18} />
                <p className="text-sm leading-6 text-slate-700">{section}</p>
              </div>
            ))}
          </div>
        </article>

        <aside className="rounded-3xl bg-amber-50 p-6 shadow-sm ring-1 ring-amber-200">
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-amber-800">
            <AlertTriangle size={14} /> Limites importantes
          </p>
          <h2 className="mt-4 text-2xl font-black text-slate-900">O que a metodologia não faz</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
            <p>Não promete rentabilidade futura.</p>
            <p>Não recomenda compra ou venda definitiva de ativos.</p>
            <p>Não inventa dados ausentes, como vacância, contratos, devedores, garantias ou qualidade da gestão.</p>
            <p>Não substitui leitura dos relatórios gerenciais, comunicados oficiais e documentos dos fundos.</p>
          </div>
          <Link href="/fontes-dos-dados" className="mt-5 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-extrabold text-white hover:bg-slate-800">
            Ver fontes dos dados
          </Link>
        </aside>
      </section>
    </main>
  );
}
