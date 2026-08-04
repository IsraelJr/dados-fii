import { NextRequest, NextResponse } from "next/server";
import type { PortfolioIntelligenceResult } from "@/lib/portfolio-intelligence/PortfolioIntelligence";
import {
  PortfolioIntelligenceAIRateLimitError,
  portfolioIntelligenceAIService,
} from "@/lib/portfolio-intelligence/PortfolioIntelligenceAIService";
import { PortfolioIntelligenceAIValidationError } from "@/lib/portfolio-intelligence/PortfolioIntelligenceAIContract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BODY_BYTES = 80_000;

function headers() {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

function requestKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const userAgent = (request.headers.get("user-agent") || "unknown").slice(0, 160);
  return `${forwarded}|${userAgent}`;
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, error: "A análise enviada excedeu o limite permitido.", code: "INPUT_TOO_LARGE" },
        { status: 413, headers: headers() },
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON inválido.", code: "INVALID_JSON" },
        { status: 400, headers: headers() },
      );
    }
    if (!body || typeof body !== "object" || !("result" in body)) {
      return NextResponse.json(
        { ok: false, error: "Resultado determinístico obrigatório.", code: "RESULT_REQUIRED" },
        { status: 400, headers: headers() },
      );
    }

    const explanation = await portfolioIntelligenceAIService.explain(
      (body as { result: PortfolioIntelligenceResult }).result,
      { requestKey: requestKey(request) },
    );
    return NextResponse.json({ ok: true, explanation }, { headers: headers() });
  } catch (error) {
    if (error instanceof PortfolioIntelligenceAIRateLimitError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.status, headers: headers() },
      );
    }
    if (error instanceof PortfolioIntelligenceAIValidationError) {
      return NextResponse.json(
        { ok: false, error: "O resultado determinístico não passou pela validação.", code: error.code },
        { status: error.code === "INPUT_TOO_LARGE" ? 413 : 400, headers: headers() },
      );
    }
    console.error("Portfolio intelligence explanation error", {
      code: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { ok: false, error: "Não foi possível explicar a análise.", code: "EXPLANATION_ERROR" },
      { status: 500, headers: headers() },
    );
  }
}
