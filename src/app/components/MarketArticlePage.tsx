import Link from "next/link";
import { ArrowRight, CalendarDays, ExternalLink, Landmark, ShieldAlert } from "lucide-react";
import EditorialTelemetry from "./EditorialTelemetry";
import type { MarketArticle } from "@/lib/editorial/marketContent";
import { SITE_NAME, SITE_URL } from "@/lib/site";

function formatDate(value: string) {
  const parsed = new Date(`${value}T12:00:00-03:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
}

export default function MarketArticlePage({ article }: { article: MarketArticle }) {
  const canonical = `${SITE_URL}/mercado/${article.slug}`;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    inLanguage: "pt-BR",
    datePublished: article.asOf,
    dateModified: article.asOf,
    mainEntityOfPage: canonical,
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    citation: article.sources.map((source) => source.url),
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Mercado", item: `${SITE_URL}/mercado` },
      { "@type": "ListItem", position: 3, name: article.title, item: canonical },
    ],
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <EditorialTelemetry page={article.slug} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <nav aria-label="Navegação estrutural" className="mb-5 text-sm font-bold text-slate-600">
        <Link href="/" className="hover:text-indigo-700">Início</Link>
        <span aria-hidden className="mx-2">›</span>
        <Link href="/mercado" className="hover:text-indigo-700">Mercado</Link>
      </nav>

      <article>
        <header className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl ring-1 ring-slate-800 md:p-9">
          <p className="inline-flex items-center gap-2 rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-200">
            <Landmark size={14} /> Cenário por segmento
          </p>
          <h1 className="mt-5 max-w-4xl text-3xl font-black tracking-tight md:text-5xl">{article.title}</h1>
          <p className="mt-5 max-w-4xl text-base leading-8 text-slate-300 md:text-lg">{article.description}</p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold text-slate-200">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2"><CalendarDays size={14} /> Data-base: {formatDate(article.asOf)}</span>
            <span className="rounded-full bg-white/10 px-3 py-2">Conteúdo informativo</span>
            <span className="rounded-full bg-white/10 px-3 py-2">Sem recomendação de compra ou venda</span>
          </div>
        </header>

        <section className="mt-6 rounded-2xl bg-indigo-50 p-6 ring-1 ring-indigo-100">
          <h2 className="text-xl font-black text-slate-900">Leitura direta</h2>
          <p className="mt-3 text-base leading-8 text-slate-700">{article.summary}</p>
        </section>

        <section aria-labelledby="market-signals" className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 id="market-signals" className="text-2xl font-black text-slate-900">Indicadores de contexto</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Os números abaixo são contexto macro ou setorial. Eles não substituem a análise de cada fundo, imóvel, contrato ou devedor.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {article.signals.map((signal) => (
              <div key={`${signal.label}-${signal.sourceName}`} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="text-xs font-extrabold uppercase tracking-wide text-indigo-700">{signal.label}</p>
                <p className="mt-2 text-xl font-black text-slate-900">{signal.value}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{signal.interpretation}</p>
                <p className="mt-3 text-xs font-bold text-slate-500">Fonte: {signal.sourceName}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-6 grid gap-6">
          {article.sections.map((section) => (
            <section key={section.title} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-2xl font-black text-slate-900">{section.title}</h2>
              <div className="mt-4 space-y-3 text-base leading-8 text-slate-700">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
              {section.watch && (
                <div className="mt-5 rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200">
                  <p className="inline-flex items-center gap-2 text-sm font-extrabold text-amber-950"><ShieldAlert size={17} /> O que acompanhar</p>
                  <ul className="mt-3 grid gap-2 text-sm leading-6 text-amber-950 md:grid-cols-2">
                    {section.watch.map((item) => <li key={item} className="rounded-xl bg-white/70 px-4 py-3 ring-1 ring-amber-200">{item}</li>)}
                  </ul>
                </div>
              )}
            </section>
          ))}
        </div>

        <section aria-labelledby="market-sources" className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 id="market-sources" className="text-2xl font-black text-slate-900">Fontes e atualização</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">{article.reviewPolicy}</p>
          <ul className="mt-5 grid gap-3 md:grid-cols-2">
            {article.sources.map((source) => (
              <li key={source.url} className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <a href={source.url} target="_blank" rel="noreferrer" className="font-extrabold text-indigo-700 hover:text-indigo-900">
                  {source.name} <ExternalLink size={14} className="ml-1 inline" />
                </a>
                <p className="mt-2 text-xs leading-5 text-slate-600">{source.publisher} · publicado em {formatDate(source.publishedAt)} · consultado em {formatDate(source.accessedAt)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-2xl bg-slate-900 p-6 text-white">
          <h2 className="text-2xl font-black">Continue a análise</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">Use o cenário como ponto de partida e avance para a carteira, os riscos ou outro segmento relacionado.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {article.related.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                data-editorial-destination={item.destination}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-slate-900 hover:bg-slate-100"
              >
                {item.label} <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        </section>
      </article>
    </main>
  );
}
