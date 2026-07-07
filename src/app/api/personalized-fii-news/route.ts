import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AI_SUMMARY_CACHE_COLLECTION = "FiiAiSummaries";
const AI_SUMMARY_CACHE_TTL_DAYS = 5;
const AI_SUMMARY_CACHE_TTL_MS = AI_SUMMARY_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

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

function readableSourceLabel(value: string) {
  return value
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/[\])}.,;:]+$/g, "")
    .trim();
}

function sanitizeAiText(value: unknown) {
  return String(value || "")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]*)\)/gi, (_match, label) => readableSourceLabel(String(label || "")))
    .replace(/\(\s*\[([^\]]+)\]\((?!https?:\/\/)([^)]*)\)\s*\)/gi, (_match, label, target) => {
      const cleanLabel = readableSourceLabel(String(label || ""));
      const cleanTarget = readableSourceLabel(String(target || ""));
      return cleanTarget && /ver fonte/i.test(cleanTarget) ? cleanTarget : cleanLabel || cleanTarget;
    })
    .replace(/\[([^\]]+)\]\((?!https?:\/\/)([^)]*)\)/gi, (_match, label, target) => {
      const cleanLabel = readableSourceLabel(String(label || ""));
      const cleanTarget = readableSourceLabel(String(target || ""));
      return cleanTarget && /ver fonte/i.test(cleanTarget) ? cleanTarget : cleanLabel || cleanTarget;
    })
    .replace(/\((https?:\/\/[^\s)]+)\)/gi, (_match, url) => `(${readableSourceLabel(url)})`)
    .replace(/https?:\/\/[^\s)]+/gi, (url) => readableSourceLabel(url))
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeInsight(ticker: string, value: any, fallback: FiiInsight): FiiInsight {
  const reportUrl = normalizeUrl(value?.reportUrl);
  const reportTitle = reportUrl ? sanitizeAiText(value?.reportTitle || `Relatório gerencial de ${ticker}`) : "";

  return {
    ticker,
    title: sanitizeAiText(value?.title || `${ticker} – Resumo das notícias mais recentes`),
    summary: sanitizeAiText(value?.summary || fallback.summary || ""),
    attentionPoints: Array.isArray(value?.attentionPoints)
      ? value.attentionPoints.map((point: unknown) => sanitizeAiText(point)).filter(Boolean).slice(0, 3)
      : fallback.attentionPoints,
    searchUrl: normalizeUrl(value?.searchUrl) || buildGoogleSearchUrl(ticker),
    reportTitle,
    reportUrl,
  };
}

function normalizeInsights(tickers: string[], aiInsights: any[], fallback: FiiInsight[]) {
  return tickers.map((ticker: string) => {
    const found = aiInsights.find((item: any) => String(item?.ticker || "").toUpperCase() === ticker);
    const fallbackItem = fallback.find((item) => item.ticker === ticker);
    if (!found || !fallbackItem) return fallbackItem || fallback[0];
    return normalizeInsight(ticker, found, fallbackItem);
  });
}

function getTimestampMs(value: any) {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return new Date(value).getTime() || 0;
}

function isCacheFresh(value: any) {
  const expiresAtMs = getTimestampMs(value?.expiresAt);
  return expiresAtMs > Date.now();
}

async function readCachedInsights(tickers: string[], fallback: FiiInsight[]) {
  const cached = new Map<string, FiiInsight>();

  await Promise.all(
    tickers.map(async (ticker) => {
      const snap = await adminDb.collection(AI_SUMMARY_CACHE_COLLECTION).doc(ticker).get();
      const data = snap.data();
      const fallbackItem = fallback.find((item) => item.ticker === ticker);

      if (!snap.exists || !data || !fallbackItem || !isCacheFresh(data)) return;

      const insight = normalizeInsight(ticker, data.insight || data, fallbackItem);
      if (!insight.summary) return;

      cached.set(ticker, insight);
    })
  );

  return cached;
}

async function saveCachedInsights(insights: FiiInsight[]) {
  await Promise.all(
    insights
      .filter((insight) => insight.summary)
      .map(async (insight) => {
        const ref = adminDb.collection(AI_SUMMARY_CACHE_COLLECTION).doc(insight.ticker);
        const snap = await ref.get();
        const now = Date.now();

        await ref.set({
          ticker: insight.ticker,
          insight,
          source: "openai",
          ttlDays: AI_SUMMARY_CACHE_TTL_DAYS,
          expiresAt: new Date(now + AI_SUMMARY_CACHE_TTL_MS),
          updatedAt: adminFieldValue.serverTimestamp(),
          ...(snap.exists ? {} : { createdAt: adminFieldValue.serverTimestamp() }),
        }, { merge: true });
      })
  );
}

function uniqueTickers(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .map((ticker: unknown) => String(ticker || "").trim().toUpperCase())
      .filter((ticker: string) => Boolean(ticker))
  )).slice(0, 3);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const tickers = uniqueTickers(body?.tickers);

  if (!tickers.length) {
    return NextResponse.json({ ok: true, mode: "empty", insights: [] });
  }

  const fallback = fallbackInsights(tickers);

  try {
    const cached = await readCachedInsights(tickers, fallback);
    const missingTickers = tickers.filter((ticker) => !cached.has(ticker));
    let freshInsights: FiiInsight[] = [];

    if (missingTickers.length) {
      const missingFallback = fallbackInsights(missingTickers);
      const openAiPayload = await callOpenAI(buildPrompt(missingTickers));

      if (openAiPayload) {
        const text = extractOutputText(openAiPayload);
        const parsed = safeJsonParse(text);
        const aiInsights = Array.isArray(parsed?.insights) ? parsed.insights : [];

        if (aiInsights.length) {
          freshInsights = normalizeInsights(missingTickers, aiInsights, missingFallback).filter((insight) => insight.summary);
          await saveCachedInsights(freshInsights).catch((err) => console.error("FII AI summary cache save error:", err));
        }
      }
    }

    const freshByTicker = new Map(freshInsights.map((insight) => [insight.ticker, insight]));
    const fallbackByTicker = new Map(fallback.map((insight) => [insight.ticker, insight]));
    const insights = tickers.map((ticker) => cached.get(ticker) || freshByTicker.get(ticker) || fallbackByTicker.get(ticker)).filter(Boolean) as FiiInsight[];
    const hasSummary = insights.some((insight) => Boolean(insight.summary));

    return NextResponse.json({
      ok: true,
      mode: hasSummary ? (freshInsights.length ? "openai" : "cache") : "fallback",
      insights,
      cache: {
        ttlDays: AI_SUMMARY_CACHE_TTL_DAYS,
        hits: cached.size,
        misses: missingTickers.length,
        refreshed: freshInsights.length,
      },
    });
  } catch (err) {
    console.error("Personalized FII news exception:", err);
    return NextResponse.json({ ok: true, mode: "fallback", insights: fallback });
  }
}
