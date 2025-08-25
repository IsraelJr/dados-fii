// app/api/fii-summary/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { ticker } = await req.json();
  const rawPrompt = process.env.PERPLEXITY_PROMPT_ABOUT_FII ?? "";

  try {
    if (!ticker) {
      return NextResponse.json({ error: "Ticker não fornecido" }, { status: 400 });
    }

    const prompt = rawPrompt ? rawPrompt.replace("{ticker}", ticker) : ticker;

    // Chamada para Perplexity
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro Perplexity: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    // console.log("Resposta do Perplexity:", JSON.stringify(data, null, 2));

    let summary = "Sem resumo disponível";

    if (data?.choices?.[0]?.message?.content) {
      summary = (data?.choices?.[0]?.message?.content ?? summary).replace(/\[\d+\]/g, "");
    }

    let sources = data?.choices?.[0]?.citations ?? [];

    return NextResponse.json({ ticker, summary, sources });

  } catch (err: any) {
    console.error(`Erro ao buscar resumo do FII: ${ticker}`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
