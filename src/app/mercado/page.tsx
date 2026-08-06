import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, Building2, Factory, Landmark, ShoppingBag, Sprout, Store, WalletCards } from "lucide-react";
import EditorialTelemetry from "../components/EditorialTelemetry";
import { applyAugust2026CopomUpdate } from "@/lib/editorial/copomAugust2026";
import { MARKET_ARTICLES } from "@/lib/editorial/marketContent";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mercado de FIIs e cenários por segmento",
  description: "Cenários com data-base e fontes para FIIs, FIAGRO, logística, shoppings, escritórios, recebíveis e renda urbana.",
  alternates: { canonical: "/mercado" },
  openGraph: {
    type: "website",
    title: "Mercado de FIIs e cenários por segmento",
    description: "Entenda como juros, inflação, crédito e atividade afetam diferentes categorias de fundos.",
    url: "/mercado",
  },
};

const UPDATED_MARKET_ARTICLES = MARKET_ARTICLES.map(applyAugust2026CopomUpdate);

const ICONS = {
  "mercado-de-fiis": BarChart3,
  "fiagro-agronegocio": Sprout,
  "galpoes-logistica": Factory,
  shoppings: ShoppingBag,
  "escritorios-lajes-corporativas": Building2,
  "recebiveis-papel": WalletCards,
  "renda-urbana": Store,
} as const;

export default function MarketHubPage() {
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Mercado de FIIs e cenários por segmento",
    description: metadata.description,
    url: `${SITE_URL}/mercado`,
    inLanguage: "pt-BR",
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: UPDATED_MARKET_ARTICLES.map((article, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: article.title,
        url: `${SITE_URL}/mercado/${article.slug}`,
      })),
    },
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Mercado", item: `${SITE_URL}/mercado` },
    ],
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <EditorialTelemetry page="hub" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <nav aria-label="Navegação estrutural" className="mb-5 text-sm font-bold text-slate-600">
        <Link href="/" className="hover:text-indigo-700">Início</Link>
        <span aria-hidden className="mx-2">›</span>
        Mercado
      </nav>

      <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl md:p-10">
        <p className="inline-flex items-center gap-2 rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-200">
          <Landmark size={14} /> Conteúdo de mercado
        </p>
        <h1 className="mt-5 max-w-4xl text-3xl font-black tracking-tight md:text-5xl">Mercado de FIIs e cenários por segmento</h1>
        <p className="mt-5 max-w-4xl text-base leading-8 text-slate-300 md:text-lg">
          Entenda como juros, inflação, crédito, atividade econômica e ciclos setoriais chegam aos fundos imobiliários. Cada página possui data-base, fontes e limitações explícitas.
        </p>
        <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold text-slate-200">
          <span className="rounded-full bg-white/10 px-3 py-2">Conteúdo original e segmentado</span>
          <span className="rounded-full bg-white/10 px-3 py-2">Fontes oficiais</span>
          <span className="rounded-full bg-white/10 px-3 py-2">Sem indicação de compra ou venda</span>
        </div>
      </header>

      <section aria-labelledby="market-categories" className="mt-8">
        <div className="max-w-3xl">
          <h2 id="market-categories" className="text-2xl font-black text-slate-900 md:text-3xl">Escolha uma leitura</h2>
          <p className="mt-3 text-base leading-7 text-slate-600">As categorias não são intercambiáveis. Crédito, imóveis, contratos, devedores e ciclos econômicos exigem critérios diferentes.</p>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {UPDATED_MARKET_ARTICLES.map((article) => {
            const Icon = ICONS[article.slug];
            return (
              <article key={article.slug} className="flex h-full flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700"><Icon size={22} /></div>
                <p className="mt-4 text-xs font-extrabold uppercase tracking-wide text-indigo-700">Data-base: {new Intl.DateTimeFormat("pt-BR").format(new Date(`${article.asOf}T12:00:00-03:00`))}</p>
                <h3 className="mt-3 text-xl font-black text-slate-900">{article.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">{article.description}</p>
                <Link
                  href={`/mercado/${article.slug}`}
                  data-editorial-destination="editorial"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-indigo-700 hover:text-indigo-900"
                >
                  Abrir análise <ArrowRight size={16} />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-8 rounded-2xl bg-indigo-50 p-6 ring-1 ring-indigo-100">
        <h2 className="text-2xl font-black text-slate-900">Como usar essas páginas</h2>
        <div className="mt-4 grid gap-4 text-sm leading-7 text-slate-700 md:grid-cols-3">
          <p className="rounded-xl bg-white p-4 ring-1 ring-indigo-100"><strong>1. Contexto:</strong> identifique quais variáveis econômicas realmente afetam a categoria.</p>
          <p className="rounded-xl bg-white p-4 ring-1 ring-indigo-100"><strong>2. Fundo:</strong> confirme contratos, ativos, devedores, gestor e qualidade dos dados.</p>
          <p className="rounded-xl bg-white p-4 ring-1 ring-indigo-100"><strong>3. Carteira:</strong> verifique concentração patrimonial e participação na renda antes de agir.</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/carteira" data-editorial-destination="portfolio" className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-indigo-700">Analisar minha carteira <ArrowRight size={15} /></Link>
          <Link href="/guias/risco-em-fiis" data-editorial-destination="editorial" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">Revisar riscos <ArrowRight size={15} /></Link>
        </div>
      </section>
    </main>
  );
}
