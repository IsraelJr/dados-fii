import type { Metadata } from "next";
import Link from "next/link";
import { GUIDES } from "@/lib/editorial/guides";

export const metadata: Metadata = { title: "Guias de fundos imobiliários", description: "Guias aprofundados sobre fundamentos, dividendos, riscos e construção de carteira de FIIs.", alternates: { canonical: "/guias" } };

export default function GuidesPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
        <p className="text-xs font-extrabold uppercase tracking-wide text-indigo-700">Educação financeira aplicada</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-900">Guias de fundos imobiliários</h1>
        <p className="mt-4 max-w-4xl text-base leading-8 text-slate-600">Conteúdo criado para explicar como FIIs geram renda, onde surgem perdas, como comparar indicadores e como relacionar cada fundo à carteira — sem atalhos de DY ou P/VP.</p>
      </header>
      <section className="mt-8 grid gap-5 md:grid-cols-2">
        {GUIDES.map((guide) => (
          <article key={guide.slug} className="flex flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-2xl font-black text-slate-900">{guide.title}</h2>
            <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">{guide.description}</p>
            <Link href={`/guias/${guide.slug}`} className="mt-5 inline-flex w-fit rounded-full bg-indigo-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-indigo-700">Ler guia completo</Link>
          </article>
        ))}
      </section>
    </main>
  );
}
