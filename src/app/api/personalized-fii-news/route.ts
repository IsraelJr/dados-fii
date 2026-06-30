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
  const query = `${ticker} FII site oficial administradora gestor relatório gerencial fatos relevantes dividendos relatório gerencial`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function fallbackInsights(tickers: string[]): FiiInsight[] {
  return tickers.map((ticker: string) => ({
    ticker,
    title: `Pesquisar ${ticker}`,
    summary: `Não foi possível gerar um resumo com IA para ${ticker} neste momento. Consulte fontes oficiais, relatórios gerenciais, fatos relevantes e notícias recentes antes de tomar qualquer decisão.`,
    attentionPoints: [
      "Abrir a busca por fontes oficiais e relatório gerencial.",
      "Verificar último dividendo, data-com, pagamento e DY mensal.",
      "Confirmar aquisições, vendas e riscos diretamente nos comunicados do fundo.",
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

function buildPrompt(tickers: string[]) {
  const basePrompt = process.env.OPENAI_PROMPT_ABOUT_FII?.trim() || `
Resuma as notícias mais recentes e relevantes sobre o FII {ticker} em 3-4 linhas.
Destaque o último dividendo, o respectivo DY mensal, possíveis aquisições ou vendas e como está a saúde do fundo.
`;

  const promptByTicker = tickers
    .map((ticker) => `Para ${ticker}: ${basePrompt.replace(/\{ticker\}/g, ticker)}`)
    .join("\n\n");

  return `
Você é um analista editorial do site Dados FII.

Faça uma pesquisa na web e responda com um resumo útil, no estilo de uma resposta direta de chat, para os FIIs abaixo.

${promptByTicker}

Regras:
- Use informações recentes encontradas na web, relatórios gerenciais, comunicados oficiais, notícias de mercado e dados públicos.
- Não use dados internos da base Dados FII como fonte principal.
- Não dê recomendação de compra ou venda.
- Se não encontrar algum dado, diga isso de forma natural, sem inventar.
- A resposta deve ser específica por ticker, não genérica.
- Preserve todos os tickers recebidos: ${tickers.join(", ")}.
- Retorne somente JSON válido, sem markdown.

Formato obrigatório:
{
  "insights": [
    {
      "ticker": "TGAR11",
      "title": "TGAR11 – Resumo das notícias mais recentes",
      "summary": "Resumo corrido em 3-4 linhas, citando dividendo, DY mensal, aquisições/vendas quando houver e saúde do fundo.",
      "attentionPoints": [
        "Ponto específico 1, baseado na pesquisa.",
        "Ponto específico 2, baseado na pesquisa.",
        "Ponto específico 3, baseado na pesquisa."
      ]
    }
  ]
}
`;
}

function responseBody(prompt: string) {
  const shouldUseWebSearch = process.env.OPENAI_USE_WEB_SEARCH !== "false";

  return {
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    input: prompt,
    temperature: 0.2,
    ...(shouldUseWebSearch
      ? {
        tools: [
          {
            type: "web_search_preview",
            search_context_size: "medium",
          },
        ],
      }
      : {}),
  };
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

  const prompt = buildPrompt(tickers);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(responseBody(prompt)),
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
        title: String(found.title || `${ticker} – Resumo das notícias mais recentes`),
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
