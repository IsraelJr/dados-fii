import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { loadFundSeoPageData } from "@/lib/seo/FundSeoPageData";

type FiiLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ ticker: string }>;
};

async function resolveTicker(params: FiiLayoutProps["params"]) {
  const resolved = await params;
  const rawTicker = String(resolved?.ticker || "").trim();
  const canonicalTicker = rawTicker.toUpperCase();
  const pageData = await loadFundSeoPageData(canonicalTicker);
  return { rawTicker, canonicalTicker, pageData };
}

export async function generateMetadata({ params }: Pick<FiiLayoutProps, "params">): Promise<Metadata> {
  const { canonicalTicker, pageData } = await resolveTicker(params);
  const indexable = pageData.eligibility.decision === "index";
  const exists = pageData.eligibility.decision !== "not-found";

  return {
    alternates: canonicalTicker ? { canonical: `/fii/${canonicalTicker}` } : undefined,
    robots: {
      index: indexable,
      follow: exists,
      noarchive: !indexable,
      googleBot: {
        index: indexable,
        follow: exists,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export default async function FiiLayout({ children, params }: FiiLayoutProps) {
  const { rawTicker, pageData } = await resolveTicker(params);

  if (!pageData.ticker || pageData.eligibility.decision === "not-found") notFound();
  if (rawTicker !== pageData.ticker) permanentRedirect(`/fii/${pageData.ticker}`);

  return children;
}
