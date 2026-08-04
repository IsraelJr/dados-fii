import { NextResponse } from "next/server";
import { PortfolioIncrementalValidationError } from "@/lib/portfolio-intelligence/PortfolioIntelligenceIncremental";
import { PortfolioIntelligenceIncrementalService } from "@/lib/portfolio-intelligence/PortfolioIntelligenceIncrementalService";
import { resolveWalletIdentity, WalletIdentityError } from "@/server/auth/WalletIdentityResolver";
import { FirestorePortfolioIntelligenceReferenceRepository } from "@/server/repositories/FirestorePortfolioIntelligenceReferenceRepository";

const MAX_BODY_BYTES = 300_000;
const service = new PortfolioIntelligenceIncrementalService(
  new FirestorePortfolioIntelligenceReferenceRepository(),
);

function featureEnabled() {
  const value = String(process.env.ENABLE_INCREMENTAL_PORTFOLIO_REPORT ?? "true")
    .trim()
    .toLowerCase();
  return !["false", "0", "off", "disabled"].includes(value);
}

function publicError(error: unknown) {
  if (error instanceof WalletIdentityError) {
    return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
  }
  if (error instanceof PortfolioIncrementalValidationError) {
    return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: 400 });
  }
  const code = error instanceof Error ? error.message : "PORTFOLIO_INCREMENTAL_INTERNAL_ERROR";
  const status = code === "PORTFOLIO_INCREMENTAL_REFERENCE_NOT_FOUND" ? 404 : 500;
  return NextResponse.json({
    ok: false,
    code,
    error: status === 404
      ? "Referência da carteira não encontrada."
      : "Erro interno ao comparar as análises da carteira.",
  }, { status });
}

async function bodyFrom(request: Request) {
  const text = await request.text();
  if (!text || Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
    throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", "Payload da análise inválido.");
  }
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid");
    return value as Record<string, unknown>;
  } catch {
    throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", "Payload JSON inválido.");
  }
}

export async function POST(request: Request) {
  if (!featureEnabled()) {
    return NextResponse.json({
      ok: false,
      code: "PORTFOLIO_INCREMENTAL_DISABLED",
      error: "Relatório incremental temporariamente indisponível.",
    }, { status: 404 });
  }

  try {
    const identity = await resolveWalletIdentity(request);
    const body = await bodyFrom(request);
    const output = await service.compareAndStore({
      ownerId: identity.ownerId,
      portfolioId: body.portfolioId,
      result: body.result,
    });
    return NextResponse.json({ ok: true, ...output }, { status: output.persistence.stored ? 201 : 200 });
  } catch (error) {
    return publicError(error);
  }
}
