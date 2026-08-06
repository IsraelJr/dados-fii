import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MarketArticlePage from "../../components/MarketArticlePage";
import { applyAugust2026CopomUpdate } from "@/lib/editorial/copomAugust2026";
import { getMarketArticle, MARKET_ARTICLES } from "@/lib/editorial/marketContent";

export function generateStaticParams() {
  return MARKET_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const baseArticle = getMarketArticle(slug);
  const article = baseArticle ? applyAugust2026CopomUpdate(baseArticle) : undefined;
  if (!article || !article.indexable) {
    return { title: "Cenário não encontrado", robots: { index: false, follow: false } };
  }
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: `/mercado/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.description,
      url: `/mercado/${article.slug}`,
      publishedTime: article.asOf,
      modifiedTime: article.asOf,
    },
  };
}

export default async function MarketArticleRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const baseArticle = getMarketArticle(slug);
  if (!baseArticle || !baseArticle.indexable) notFound();
  return <MarketArticlePage article={applyAugust2026CopomUpdate(baseArticle)} />;
}
