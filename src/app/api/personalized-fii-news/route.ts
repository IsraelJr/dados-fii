import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NewsItem = {
  title?: string;
  source?: string;
  publishedAt?: string;
  url?: string;
};

type FiiContext = {
  ticker: string;
  data?: any;
  news: NewsItem[];
  lastDividend?: {
    month: string;
    earnings: string;
    dateWith?: string;
    paymentDate?: string;
    monthlyYield?: string;
  } | null;
  nextPayment?: {
    month: string;
    earnings: string;
    dateWith?: string;
    paymentDate?: string;
  } | null;
};

type FiiInsight = {
  ticker: string;
  title: string;
  summary: string;
  attentionPoints: string[];
  searchUrl: string;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_PTBR: Record<string, string> = {
  January: "Janeiro",
  February: "Fevereiro",
  March: "Março",
  April: "Abril",
  May: "Maio",
  June: "Junho",
  July: "Julho",
  August: "Agosto",
  September: "Setembro",
  October: "Outubro",
  November: "Novembro",
  December: "Dezembro",
};

function buildGoogleSearchUrl(ticker: string) {
  const query = `${ticker} FII site oficial administradora gestor relatório gerencial fatos relevantes dividendos`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function parseCurrency(value: unknown) {
  if (typeof value === "number") return value;
  return Number(
    String(value || "0")
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()
  ) || 0;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "";
  return `${value.toFixed(2).replace(".", ",")}%`;
}

function getCurrentYearData(data: any) {
  const year = new Date().getFullYear();
  return data?.[`earnings${year}`] || data?.[`earnings${year - 1}`] || {};
}

function getOrderedDividends(data: any) {
  const yearData = getCurrentYearData(data);
  return Object.entries(yearData)
    .sort(([a], [b]) => MONTHS.indexOf(a) - MONTHS.indexOf(b))
    .map(([month, info]: any) => ({ month, info }));
}

function parseDate(value: string) {
  const [day, month, year] = String(value || "").split("/").map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day, 23, 59, 59);
}

function getDividendContext(data: any) {
  const ordered = getOrderedDividends(data);
  const price = parseCurrency(data?.price);

  const last = [...ordered]
    .filter(({ info }: any) => info?.earnings)
    .reverse()[0];

  const lastDividend = last
    ? {
      month: MONTHS_PTBR[last.month] || last.month,
      earnings: String(last.info?.earnings || ""),
      dateWith: last.info?.date_with,
      paymentDate: last.info?.payment_date,
      monthlyYield: price ? formatPercent((parseCurrency(last.info?.earnings) / price) * 100) : "",
    }
    : null;

  const today = new Date();
  const next = ordered
    .map(({ month, info }: any) => ({ month, info, date: parseDate(info?.payment_date) }))
    .filter((item: any) => item.date && item.date >= today)
    .sort((a: any, b: any) => a.date.getTime() - b.date.getTime())[0];

  const nextPayment = next
    ? {
      month: MONTHS_PTBR[next.month] || next.month,
      earnings: String(next.info?.earnings || ""),
      dateWith: next.info?.date_with,
      paymentDate: next.info?.payment_date,
    }
    : null;

  return { lastDividend, nextPayment };
}

function fallbackInsights(contexts: FiiContext[]): FiiInsight[] {
  return contexts.map((context) => {
    const segment = context.data?.segment_new || context.data?.segment || "segmento não informado";
    const price = context.data?.price || "preço não informado";
    const lastDividend = context.lastDividend;
    const newsTitles = context.news.map((item) => item.title).filter(Boolean).slice(0, 2).join("; ");

    return {
      ticker: context.ticker,
      title: `Resumo de ${context.ticker}`,
      summary: `${context.ticker} está classificado como ${segment}, com preço atual de ${price}. ${lastDividend ? `O último rendimento encontrado foi ${lastDividend.earnings} em ${lastDividend.month}${lastDividend.monthlyYield ? `, equivalente a DY mensal aproximado de ${lastDividend.monthlyYield}` : ""}.` : "Não há rendimento recente suficiente na base para calcular o DY mensal."} ${newsTitles ? `Últimas notícias encontradas: ${newsTitles}.` : "Consulte fontes oficiais para notícias recentes e relatório gerencial."}`,
      attentionPoints: [
        context.nextPayment ? `Próximo pagamento na base: ${context.nextPayment.earnings} com pagamento em ${context.nextPayment.paymentDate || "data não informada"}.` : "Verifique se há novos pagamentos anunciados no relatório ou comunicado oficial.",
        "Leia o relatório gerencial para avaliar vacância, inadimplência, aquisições, vendas e mudanças de estratégia.",
        "Use notícias como ponto de partida, mas confirme fatos relevantes e comunicados na fonte oficial do fundo.",
      ],
      searchUrl: buildGoogleSearchUrl(context.ticker),
    };
  });
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

function getOrigin(req: Request) {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const protocol = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "https";
  return `${protocol}://${host}`;
}

async function fetchJson(url: string) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function buildFiiContexts(tickers: string[], origin: string): Promise<FiiContext[]> {
  return Promise.all(
    tickers.map(async (ticker: string) => {
      const [data, newsData] = await Promise.all([
        fetchJson(`${origin}/api/fii?ticker=${encodeURIComponent(ticker)}`),
        fetchJson(`${origin}/api/fii-news?ticker=${encodeURIComponent(ticker)}`),
      ]);

      const dividendContext = data ? getDividendContext(data) : { lastDividend: null, nextPayment: null };
      const news = Array.isArray(newsData?.news) ? newsData.news.slice(0, 3) : [];

      return {
        ticker,
        data,
        news,
        ...dividendContext,
      };
    })
  );
}

function buildPrompt(contexts: FiiContext[]) {
  const tickers = contexts.map((context) => context.ticker);
  const basePrompt = process.env.OPENAI_PROMPT_ABOUT_FII?.trim() || `
Resuma de forma prudente os dados disponíveis sobre o FII {ticker}.
Use apenas as informações fornecidas pelo sistema e não invente notícias, aquisições, vendas ou dividendos.
Quando não houver dados suficientes, diga o que o investidor deve verificar em fontes oficiais.
Se houver dados de dividendos, destaque o último rendimento e o DY mensal calculado.
Se houver notícias ou fatos relevantes fornecidos, resuma em 3-4 linhas.
`;

  const promptByTicker = contexts
    .map((context) => `Ticker ${context.ticker}: ${basePrompt.replace(/\{ticker\}/g, context.ticker)}`)
    .join("\n\n");

  const suppliedContext = contexts.map((context) => ({
    ticker: context.ticker,
    price: context.data?.price || null,
    opening: context.data?.opening || null,
    variation: context.data?.variation || null,
    minimum: context.data?.minimum || null,
    maximum: context.data?.maximum || null,
    segment: context.data?.segment_new || context.data?.segment || null,
    socialReason: context.data?.socialReason || context.data?.name || null,
    cnpj: context.data?.cnpj || null,
    dividendYield: context.data?.dividendYield || null,
    pvp: context.data?.pvp || null,
    equityValuePerShare: context.data?.equityValuePerShare || null,
    administrator: context.data?.administrator || context.data?.admin || null,
    report: context.data?.report || context.data?.reportUrl || context.data?.managementReport || null,
    lastDividend: context.lastDividend,
    nextPayment: context.nextPayment,
    latestNews: context.news.map((item) => ({
      title: item.title || null,
      source: item.source || null,
      publishedAt: item.publishedAt || null,
      url: item.url || null,
    })),
  }));

  return `
Você é o assistente editorial do site Dados FII, um site brasileiro de consulta de fundos imobiliários.

Tarefa:
Gerar um resumo curto, útil e fundamentado para os FIIs mais pesquisados pelo usuário.

Instruções configuradas:
${promptByTicker}

Dados fornecidos pelo sistema. Use somente estes dados e não invente nada além deles:
${JSON.stringify(suppliedContext, null, 2)}

Regras obrigatórias:
- Responda em português do Brasil.
- Use linguagem simples, objetiva e prudente.
- Não dê recomendação de compra ou venda.
- Não invente notícias, aquisições, vendas, dividendos ou dados de relatório que não estejam no contexto fornecido.
- Quando não houver relatório gerencial ou dados suficientes, diga claramente que o investidor deve verificar o relatório oficial.
- Use os títulos das notícias fornecidas como base para o resumo de mercado, sem afirmar fatos além do título/fonte.
- Cada ticker deve ter uma frase de resumo e 3 pontos de atenção específicos, não genéricos.
- Preserve todos os tickers recebidos: ${tickers.join(", ")}.
- Retorne somente JSON válido, sem markdown.

Formato esperado:
{
  "insights": [
    {
      "ticker": "TGAR11",
      "title": "Resumo de acompanhamento",
      "summary": "texto curto baseado nos dados fornecidos",
      "attentionPoints": ["ponto específico 1", "ponto específico 2", "ponto específico 3"]
    }
  ]
}
`;
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

  const origin = getOrigin(req);
  const contexts = await buildFiiContexts(tickers, origin);
  const fallback = fallbackInsights(contexts);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ ok: true, mode: "fallback", insights: fallback });
  }

  const prompt = buildPrompt(contexts);

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

    const normalized: FiiInsight[] = contexts.map((context: FiiContext) => {
      const found = aiInsights.find((item: any) => String(item?.ticker || "").toUpperCase() === context.ticker);
      const fallbackItem = fallback.find((item) => item.ticker === context.ticker);
      if (!found || !fallbackItem) return fallbackItem || fallback[0];

      return {
        ticker: context.ticker,
        title: String(found.title || `Resumo de ${context.ticker}`),
        summary: String(found.summary || fallbackItem.summary || ""),
        attentionPoints: Array.isArray(found.attentionPoints)
          ? found.attentionPoints.map((point: unknown) => String(point)).filter(Boolean).slice(0, 3)
          : fallbackItem.attentionPoints,
        searchUrl: buildGoogleSearchUrl(context.ticker),
      };
    });

    return NextResponse.json({ ok: true, mode: "openai", insights: normalized });
  } catch (err) {
    console.error("OpenAI personalized FII news exception:", err);
    return NextResponse.json({ ok: true, mode: "fallback", insights: fallback });
  }
}
