import Link from "next/link";
import type { Guide } from "@/lib/editorial/guides";
import { EDITORIAL_REVIEW_DATE, SITE_URL } from "@/lib/site";

export default function GuideArticle({ guide }: { guide: Guide }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    inLanguage: "pt-BR",
    datePublished: "2026-07-27",
    dateModified: "2026-07-27",
    mainEntityOfPage: `${SITE_URL}/guias/${guide.slug}`,
    author: { "@type": "Person", name: "Israel Alves", url: `${SITE_URL}/autores/israel-alves` },
    publisher: { "@type": "Organization", name: "Dados FII", url: SITE_URL },
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Guias", item: `${SITE_URL}/guias` },
      { "@type": "ListItem", position: 3, name: guide.title, item: `${SITE_URL}/guias/${guide.slug}` },
    ],
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <nav aria-label="Navegação estrutural" className="mb-4 text-sm font-bold text-slate-600"><Link href="/" className="hover:text-indigo-700">Início</Link> <span aria-hidden>›</span> <Link href="/guias" className="hover:text-indigo-700">Guias</Link></nav>
      <article>
        <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
          <p className="text-xs font-extrabold uppercase tracking-wide text-indigo-700">Guia Dados FII</p>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-5xl">{guide.title}</h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">{guide.description}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-slate-600"><Link href="/autores/israel-alves" className="rounded-full bg-indigo-50 px-3 py-2 text-indigo-700">Por Israel Alves</Link><span className="rounded-full bg-slate-100 px-3 py-2">Revisado em {EDITORIAL_REVIEW_DATE}</span><span className="rounded-full bg-slate-100 px-3 py-2">Conteúdo informativo</span></div>
        </header>
        <section className="mt-6 rounded-2xl bg-indigo-50 p-6 ring-1 ring-indigo-100"><h2 className="text-xl font-black text-slate-900">Resposta direta</h2><p className="mt-3 text-base leading-8 text-slate-700">{guide.answer}</p></section>
        <div className="mt-8 space-y-6">
          {guide.sections.map((section) => (
            <section key={section.title} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-2xl font-black text-slate-900">{section.title}</h2>
              <div className="mt-4 space-y-3 text-base leading-8 text-slate-700">{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
              {section.example && <div className="mt-5 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100"><p className="text-xs font-extrabold uppercase tracking-wide text-amber-800">Exemplo prático</p><p className="mt-2 text-sm leading-7 text-amber-950">{section.example}</p></div>}
              {section.checklist && <ul className="mt-5 grid gap-2 text-sm leading-7 text-slate-700">{section.checklist.map((item) => <li key={item} className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">{item}</li>)}</ul>}
            </section>
          ))}
        </div>
        <section className="mt-8 rounded-2xl bg-slate-900 p-6 text-white"><h2 className="text-xl font-extrabold">Continue a análise</h2><div className="mt-4 flex flex-wrap gap-2">{guide.related.map((item) => <Link key={item.href} href={item.href} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-100">{item.label}</Link>)}</div><p className="mt-5 text-sm leading-6 text-slate-300">Este guia não considera objetivos, patrimônio ou tolerância a risco individuais. Confirme dados materiais em documentos oficiais.</p></section>
      </article>
    </main>
  );
}
