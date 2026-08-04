import { NextResponse } from "next/server";
import { AIInsightsError } from "@/lib/ai/AIInsightsEngine";
import {
  PortfolioIntelligenceExplanationError,
  portfolioIntelligenceExplanationService,
  sanitizePortfolioExplanationInput,
} from "@/lib/portfolio-intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;

function requestKey(request: Request) {
  return request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || null;
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function responseHeaders(degraded = false) {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    ...(degraded ? { "X-Dados-FII-AI-Fallback": "1" } : {}),
  };
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "Origem da solicitação não permitida." },
      { status: 403, headers: responseHeaders() },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Solicitação acima do limite permitido." },
      { status: 413, headers: responseHeaders() },
    );
  }

  let input;
  try {
    const body = await request.json() as { result?: unknown };
    input = sanitizePortfolioExplanationInput(body?.result);
    if (JSON.stringify(input).length > MAX_BODY_BYTES) throw new Error("Payload sanitizado acima do limite.");
  } catch {
    return NextResponse.json(
      { ok: false, error: "Resultado da inteligência da carteira inválido." },
      { status: 400, headers: responseHeaders() },
    );
  }

  try {
    const explanation = await portfolioIntelligenceExplanationService.generate(input, {
      requestKey: requestKey(request),
    });
    return NextResponse.json(
      { ok: true, explanation, degraded: explanation.source !== "ai" },
      { headers: responseHeaders(explanation.source !== "ai") },
    );
  } catch (error) {
    const code = error instanceof PortfolioIntelligenceExplanationError || error instanceof AIInsightsError
      ? error.code
      : "PORTFOLIO_EXPLANATION_UNKNOWN_ERROR";
    console.error("Portfolio explanation fallback", { code });
    return NextResponse.json(
      {
        ok: true,
        explanation: portfolioIntelligenceExplanationService.fallback(input),
        degraded: true,
      },
      { headers: responseHeaders(true) },
    );
  }
}
