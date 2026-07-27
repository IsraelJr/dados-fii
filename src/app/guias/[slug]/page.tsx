import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GuideArticle from "../../components/GuideArticle";
import { getGuide, GUIDES } from "@/lib/editorial/guides";

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return { title: "Guia não encontrado", robots: { index: false, follow: false } };
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `/guias/${guide.slug}` },
    openGraph: { type: "article", title: guide.title, description: guide.description, url: `/guias/${guide.slug}` },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();
  return <GuideArticle guide={guide} />;
}
