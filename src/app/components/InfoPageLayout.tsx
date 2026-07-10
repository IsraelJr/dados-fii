import Link from "next/link";
import type { ReactNode } from "react";
import PageHeader from "./PageHeader";

type InfoPageSection = {
  title: string;
  body: ReactNode;
};

type InfoPageLayoutProps = {
  title: string;
  subtitle: string;
  eyebrow?: string;
  sections: InfoPageSection[];
  calloutTitle?: string;
  calloutBody?: ReactNode;
};

export default function InfoPageLayout({
  title,
  subtitle,
  eyebrow = "Transparência",
  sections,
  calloutTitle,
  calloutBody,
}: InfoPageLayoutProps) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader title={title} subtitle={subtitle} />

      <section className="rounded-3xl bg-gray-900 p-6 text-gray-100 shadow-lg ring-1 ring-white/10 md:p-8">
        <p className="inline-flex rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-200">
          {eyebrow}
        </p>
        <h2 className="mt-4 text-2xl font-black text-white md:text-3xl">Informação clara antes da decisão</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-300">
          O Dados FII organiza dados, indicadores e leituras de risco para estudo. A decisão final continua sendo do investidor, com confirmação em fontes oficiais quando necessário.
        </p>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <article key={section.title} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-extrabold text-slate-850">{section.title}</h2>
            <div className="mt-3 text-sm leading-6 text-slate-600">{section.body}</div>
          </article>
        ))}
      </section>

      {(calloutTitle || calloutBody) && (
        <section className="mt-6 rounded-2xl bg-indigo-50 p-5 ring-1 ring-indigo-100">
          {calloutTitle && <h2 className="text-xl font-extrabold text-indigo-950">{calloutTitle}</h2>}
          {calloutBody && <div className="mt-2 text-sm leading-6 text-indigo-950/80">{calloutBody}</div>}
        </section>
      )}

      <section className="mt-6 rounded-2xl bg-white p-5 text-sm leading-6 text-slate-600 shadow-sm ring-1 ring-slate-200">
        <p className="font-bold text-slate-800">Lembrete importante</p>
        <p className="mt-2">
          O conteúdo do Dados FII é educacional e informativo. Ele não substitui análise própria, recomendação profissional individualizada, leitura de relatórios gerenciais ou comunicados oficiais dos fundos.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/fontes-dos-dados" className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">
            Fontes dos dados
          </Link>
          <Link href="/metodologia" className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">
            Metodologia
          </Link>
          <Link href="/glossario" className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">
            Glossário
          </Link>
        </div>
      </section>
    </main>
  );
}
