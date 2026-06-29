import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NewsItem = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
};

function textOf(value: string) {
  return String(value || "")
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function extractTag(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return textOf(match?.[1] || "");
}

function parseGoogleNewsUrl(value: string) {
  const raw = textOf(value);
  if (!raw) return "";

  try {
    const url = new URL(raw);
    const target = url.searchParams.get("url");
    return target || raw;
  } catch {
    return raw;
  }
}

function newsTimestamp(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function parseItems(xml: string): NewsItem[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

  return items
    .map((item) => {
      const title = extractTag(item, "title");
      const url = parseGoogleNewsUrl(extractTag(item, "link"));
      const source = extractTag(item, "source") || "Google Notícias";
      const publishedAt = extractTag(item, "pubDate");

      return { title, url, source, publishedAt };
    })
    .filter((item) => item.title && item.url)
    .sort((a, b) => newsTimestamp(b.publishedAt) - newsTimestamp(a.publishedAt))
    .slice(0, 3);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ticker = String(url.searchParams.get("ticker") || "").trim().toUpperCase();

    if (!ticker || !/^[A-Z0-9]{4,8}$/.test(ticker)) {
      return NextResponse.json({ error: "Ticker inválido." }, { status: 400 });
    }

    const query = `${ticker} FII fundo imobiliário dividendos relatório`;
    const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;

    const response = await fetch(feedUrl, {
      cache: "no-store",
      headers: {
        Accept: "application/rss+xml,text/xml,*/*",
        "User-Agent": "dados-fii/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Google Notícias HTTP ${response.status}`);
    }

    const xml = await response.text();
    const news = parseItems(xml);

    return NextResponse.json({
      ok: true,
      ticker,
      source: "Google Notícias",
      news,
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err.message || "Erro ao buscar notícias do FII.",
        news: [],
      },
      { status: 200 }
    );
  }
}
