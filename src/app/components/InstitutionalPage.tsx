import Link from "next/link";
import { EDITORIAL_REVIEW_DATE } from "@/lib/site";

export type InstitutionalSection = {
  title: string;
  paragraphs: string[];
  items?: string[];
};

export default function InstitutionalPage({ eyebrow, title, description, sections }: { eyebrow: string; title: string; description: string; sections: InstitutionalSection[] }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
        <p className="text-xs font-extrabold uppercase tracking-wide text-indigo-700">{eyebrow}</p>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-5xl">{title}</h1>
        <p className="mt-4 max-w-4xl text-base leading-7 text-slate-600">{description}</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
          <span className="rounded-full bg-slate-100 px-3 py-2">Última revisão: {EDITORIAL_REVIEW_DATE}</span>
          <Link href="/autores/israel-alves" className="rounded-full bg-indigo-50 px-3 py-2 text-indigo-700 hover:bg-indigo-100">Responsável editorial: Israel Alves</Link>
        </div>
      </header>
      <div className="mt-8 space-y-5">
        {sections.map((section) => (
          <section key={section.title} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-2xl font-black text-slate-900">{section.title}</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-slate-700">{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
            {section.items && <ul className="mt-4 grid gap-2 text-sm leading-6 text-slate-700">{section.items.map((item) => <li key={item} className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">{item}</li>)}</ul>}
          </section>
        ))}
      </div>
      <aside className="mt-8 rounded-2xl bg-slate-900 p-6 text-white">
        <h2 className="text-xl font-extrabold">Documentação relacionada</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/metodologia" className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-900">Metodologia</Link>
          <Link href="/fontes-dos-dados" className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white">Fontes</Link>
          <Link href="/politica-de-correcoes" className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white">Correções</Link>
          <Link href="/como-usamos-ia" className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white">Uso de IA</Link>
        </div>
      </aside>
    </main>
  );
}
