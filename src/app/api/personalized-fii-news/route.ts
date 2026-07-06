import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FiiInsight = {
  ticker: string;
  title: string;
  summary: string;
  attentionPoints: string[];
  searchUrl: string;
  reportTitle?: string;
  reportUrl?: string;
};

function buildGoogleSearchUrl(ticker: string) {
  const query = `${ticker} FII site oficial administradora gestor relatório gerencial fatos relevantes dividendos relatório gerencial`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function fallbackInsights(tickers: string[]): FiiInsight[] {
  return tickers.map((ticker: string) => ({
    ticker,
    title: `Pesquisar ${ticker}`,
    summary: "",
    attentionPoints: [],
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

Pesquise na web e responda com um resumo útil, direto e específico para os FIIs abaixo.

${promptByTicker}

Regras:
- Use busca web obrigatoriamente.
- Priorize relatórios gerenciais, comunicados oficiais, fatos relevantes, páginas de RI/administradora e notícias recentes de mercado.
- Não use dados internos da base Dados FII como fonte principal.
- Não dê recomendação de compra ou venda.
- Se não encontrar algum dado, diga isso de forma natural, sem inventar.
- A resposta deve ser específica por ticker, não genérica.
- Inclua os pontos de atenção dentro do próprio resumo corrido, sem depender de blocos separados.
- Não coloque URLs puras dentro de summary, title ou attentionPoints; cite a fonte pelo nome do site ou instituição.
- Use URLs somente nos campos reportUrl/searchUrl quando aplicável.
- Se encontrar o relatório gerencial mais recente ou página oficial de relatórios, preencha reportTitle e reportUrl com o melhor link encontrado.
- Se não encontrar relatório gerencial recente ou página oficial de relatórios, deixe reportTitle e reportUrl vazios.
- Preserve todos os tickers recebidos: ${tickers.join(", ")}.
- Retorne somente JSON válido, sem markdown.

Formato obrigatório:
{
  "insights": [
    {
      "ticker": "ABCD11",
      "title": "ABCD11 – Resumo das notícias mais recentes",
      "summary": "Resumo corrido em 4-6 linhas, integrando dividendos, DY mensal, aquisições/vendas quando houver, saúde do fundo e principais pontos de atenção encontrados. Não inclua URL pura aqui; cite apenas o nome da fonte quando necessário.",
      "attentionPoints": [],
      "reportTitle": "Relatório gerencial mais recente de ABCD11",
      "reportUrl": "https://..."
    }
  ]
}
`;
}

async function callOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_SEARCH_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: prompt,
      temperature: 0.2,
      tools: [
        {
          type: "web_search",
          search_context_size: "medium",
        },
      ],
      tool_choice: "required",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("OpenAI personalized FII news error:", response.status, detail);
    return null;
  }

  return response.json();
}

function normalizeUrl(value: unknown) {
  const url = String(value || "").trim();
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : "";
}

function normalizeInsights(tickers: string[], aiInsights: any[], fallback: FiiInsight[]) {
  return tickers.map((ticker: string) => {
    const found = aiInsights.find((item: any) => String(item?.ticker || "").toUpperCase() === ticker);
    const fallbackItem = fallback.find((item) => item.ticker === ticker);
    if (!found || !fallbackItem) return fallbackItem || fallback[0];

    const reportUrl = normalizeUrl(found.reportUrl);
    const reportTitle = reportUrl ? String(found.reportTitle || `Relatório gerencial de ${ticker}`) : "";

    return {
      ticker,
      title: String(found.title || `${ticker} – Resumo das notícias mais recentes`),
      summary: String(found.summary || fallbackItem.summary || ""),
      attentionPoints: Array.isArray(found.attentionPoints)
        ? found.attentionPoints.map((point: unknown) => String(point)).filter(Boolean).slice(0, 3)
        : fallbackItem.attentionPoints,
      searchUrl: buildGoogleSearchUrl(ticker),
      reportTitle,
      reportUrl,
    };
  });
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
  const prompt = buildPrompt(tickers);

  try {
    const openAiPayload = await callOpenAI(prompt);
    if (openAiPayload) {
      const text = extractOutputText(openAiPayload);
      const parsed = safeJsonParse(text);
      const aiInsights = Array.isArray(parsed?.insights) ? parsed.insights : [];

      if (aiInsights.length) {
        return NextResponse.json({ ok: true, mode: "openai", insights: normalizeInsights(tickers, aiInsights, fallback) });
      }
    }

    return NextResponse.json({ ok: true, mode: "fallback", insights: fallback });
  } catch (err) {
    console.error("Personalized FII news exception:", err);
    return NextResponse.json({ ok: true, mode: "fallback", insights: fallback });
  }
}
