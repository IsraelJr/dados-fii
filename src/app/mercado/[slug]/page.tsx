import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MarketArticlePage from "../../components/MarketArticlePage";
import { getPublishedMarketArticle, PUBLISHED_MARKET_ARTICLES } from "@/lib/editorial/copomAugust2026";

export function generateStaticParams() {
  return PUBLISHED_MARKET_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getPublishedMarketArticle(slug);
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
      publishedTime: article.datePublished,
      modifiedTime: article.dateModified,
    },
  };
}

export default async function MarketArticleRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getPublishedMarketArticle(slug);
  if (!article || !article.indexable) notFound();
  return <MarketArticlePage article={article} />;
}
