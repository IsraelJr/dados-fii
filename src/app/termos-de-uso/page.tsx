import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, FileText, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "Termos de uso do Dados FII para consultas, carteira, relatórios e conteúdos educacionais sobre fundos imobiliários.",
  alternates: { canonical: "/termos-de-uso" },
};

const terms = [
  {
    title: "Finalidade do serviço",
    text: "O Dados FII é uma ferramenta de consulta, organização e estudo sobre fundos imobiliários, dividendos, carteira, indicadores e relatórios educacionais de risco.",
  },
  {
    title: "Não é recomendação individual",
    text: "As informações exibidas não constituem recomendação individual definitiva de compra, venda, manutenção ou substituição de ativos. O usuário deve avaliar sua própria situação, objetivos, riscos e necessidade de liquidez.",
  },
  {
    title: "Dados e limitações",
    text: "O site pode usar dados públicos, dados de mercado, dados calculados e informações informadas pelo próprio usuário. Dados podem estar ausentes, defasados, incompletos, corrigidos posteriormente ou desconsiderados por prudência.",
  },
  {
    title: "Responsabilidade do usuário",
    text: "O usuário é responsável por conferir dados relevantes em relatórios gerenciais, comunicados oficiais, documentos dos fundos, corretora, administradora e demais fontes oficiais antes de tomar decisões financeiras.",
  },
  {
    title: "Relatórios de risco",
    text: "Relatórios gerados pelo site são análises educacionais baseadas nos dados disponíveis no momento. Eles podem ajudar a identificar concentração, liquidez, renda e riscos, mas não garantem rentabilidade futura nem evitam perdas.",
  },
  {
    title: "Disponibilidade",
    text: "O serviço pode passar por instabilidades, manutenção, falhas de fornecedores externos ou limitações técnicas. O Dados FII pode alterar funcionalidades, formatos e regras de uso conforme evolução do produto.",
  },
];

export default function TermsOfUsePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
        <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-700">
          <FileText size={14} /> Termos do produto
        </p>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-5xl">Termos de uso</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          Estes termos explicam, em linguagem simples, como o Dados FII deve ser usado. O objetivo é dar transparência sobre limites, responsabilidades e natureza educacional das informações exibidas.
        </p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {terms.map((item) => (
          <article key={item.title} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-extrabold text-slate-900">{item.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{item.text}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <article className="rounded-3xl bg-amber-50 p-6 shadow-sm ring-1 ring-amber-200">
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-amber-800">
            <AlertTriangle size={14} /> Aviso importante
          </p>
          <h2 className="mt-4 text-2xl font-black text-slate-900">Investimentos envolvem risco</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            FIIs podem sofrer oscilações de preço, cortes de dividendos, perda de liquidez, eventos de crédito, vacância, mudanças regulatórias e deterioração operacional. O passado não garante resultados futuros.
          </p>
        </article>

        <aside className="rounded-3xl bg-slate-900 p-6 text-white shadow-sm">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-100">
            <ShieldCheck size={14} /> Transparência
          </p>
          <h2 className="mt-4 text-2xl font-black">Leia também</h2>
          <div className="mt-5 grid gap-2 text-sm font-bold">
            <Link href="/politica-de-privacidade" className="rounded-full bg-white px-4 py-2 text-center text-slate-900 hover:bg-slate-100">
              Política de privacidade
            </Link>
            <Link href="/fontes-dos-dados" className="rounded-full bg-white/10 px-4 py-2 text-center text-white hover:bg-white/15">
              Fontes dos dados
            </Link>
            <Link href="/metodologia" className="rounded-full bg-white/10 px-4 py-2 text-center text-white hover:bg-white/15">
              Metodologia
            </Link>
          </div>
        </aside>
      </section>
    </main>
  );
}
