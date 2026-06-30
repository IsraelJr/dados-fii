import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FiiInsight = {
  ticker: string;
  title: string;
  summary: string;
  attentionPoints: string[];
  searchUrl: string;
};

function buildGoogleSearchUrl(ticker: string) {
  const query = `${ticker} FII site oficial administradora gestor relatório gerencial fatos relevantes dividendos`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function fallbackInsights(tickers: string[]): FiiInsight[] {
  return tickers.map((ticker: string) => ({
    ticker,
    title: `Acompanhe ${ticker}`,
    summary: "Consulte notícias, site oficial, administradora, relatórios gerenciais, fatos relevantes e próximos dividendos antes de tomar qualquer decisão.",
    attentionPoints: [
      "Verifique comunicados oficiais e relatórios recentes.",
      "Confira dividendos, vacância, inadimplência e mudanças na gestão.",
      "Evite decidir apenas por notícias ou variação de preço no curto prazo.",
    ],
    searchUrl: buildGoogleSearchUrl(ticker),
  }));
}

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;

  const texts = payload?.output
    ?.flatMap((item: any) => item?.content || [])
    ?.map((content: any) => content?.text)
    ?.filter(Boolean);

  return Array.isArray(texts) ? texts.join("\n") : "";
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const tickers: string[] = Array.isArray(body?.tickers)
    ? body.tickers
      .map((ticker: unknown) => String(ticker || "").trim().toUpperCase())
      .filter((ticker: string) => Boolean(ticker))
      .slice(0, 3)
    : [];

  if (!tickers.length) {
    return NextResponse.json({ ok: true, mode: "empty", insights: [] });
  }

  const fallback = fallbackInsights(tickers);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ ok: true, mode: "fallback", insights: fallback });
  }

  const prompt = `
Você é o assistente editorial do site Dados FII, um site brasileiro de consulta de fundos imobiliários.

Tarefa:
Gerar um resumo curto e útil para os FIIs mais pesquisados pelo usuário: ${tickers.join(", ")}.

Regras obrigatórias:
- Responda em português do Brasil.
- Use linguagem simples, objetiva e prudente.
- Não dê recomendação de compra ou venda.
- Não invente fatos específicos se não tiver fonte confiável.
- Foque no que o investidor deve acompanhar: relatórios gerenciais, dividendos, fatos relevantes, gestão, vacância, inadimplência, segmento e riscos.
- Cada ticker deve ter uma frase de resumo e 3 pontos de atenção.
- Preserve todos os tickers recebidos.
- Retorne somente JSON válido, sem markdown.

Formato esperado:
{
  "insights": [
    {
      "ticker": "TGAR11",
      "title": "Resumo de acompanhamento",
      "summary": "texto curto",
      "attentionPoints": ["ponto 1", "ponto 2", "ponto 3"]
    }
  ]
}
`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        input: prompt,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("OpenAI personalized FII news error:", response.status, detail);
      return NextResponse.json({ ok: true, mode: "fallback", insights: fallback });
    }

    const payload = await response.json();
    const text = extractOutputText(payload);
    const parsed = safeJsonParse(text);
    const aiInsights = Array.isArray(parsed?.insights) ? parsed.insights : [];

    if (!aiInsights.length) {
      return NextResponse.json({ ok: true, mode: "fallback", insights: fallback });
    }

    const normalized: FiiInsight[] = tickers.map((ticker: string) => {
      const found = aiInsights.find((item: any) => String(item?.ticker || "").toUpperCase() === ticker);
      const fallbackItem = fallback.find((item) => item.ticker === ticker);
      if (!found || !fallbackItem) return fallbackItem || fallback[0];

      return {
        ticker,
        title: String(found.title || `Resumo de ${ticker}`),
        summary: String(found.summary || fallbackItem.summary || ""),
        attentionPoints: Array.isArray(found.attentionPoints)
          ? found.attentionPoints.map((point: unknown) => String(point)).filter(Boolean).slice(0, 3)
          : fallbackItem.attentionPoints,
        searchUrl: buildGoogleSearchUrl(ticker),
      };
    });

    return NextResponse.json({ ok: true, mode: "openai", insights: normalized });
  } catch (err) {
    console.error("OpenAI personalized FII news exception:", err);
    return NextResponse.json({ ok: true, mode: "fallback", insights: fallback });
  }
}
