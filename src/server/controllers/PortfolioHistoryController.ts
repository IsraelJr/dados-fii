import { NextResponse } from "next/server";
import { PortfolioHistoryValidationError } from "@/lib/portfolio/PortfolioHistory";
import { PortfolioHistoryService } from "@/lib/portfolio/PortfolioHistoryService";
import { FirestorePortfolioHistoryRepository } from "@/server/repositories/FirestorePortfolioHistoryRepository";
import { resolveWalletIdentity, WalletIdentityError } from "@/server/auth/WalletIdentityResolver";

const service = new PortfolioHistoryService(new FirestorePortfolioHistoryRepository());

function publicError(error: unknown) {
  if (error instanceof WalletIdentityError) {
    return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
  }
  if (error instanceof PortfolioHistoryValidationError) {
    return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : "Erro ao processar histórico.";
  const status = message === "HISTORY_ENTRY_NOT_FOUND" ? 404
    : message === "HISTORY_ENTRY_ALREADY_EXISTS" || message === "HISTORY_ENTRY_CONFLICT_REQUIRES_RESOLUTION" ? 409
      : 500;
  const safeMessage = status === 500 ? "Erro interno ao processar histórico." : message;
  return NextResponse.json({ ok: false, code: message, error: safeMessage }, { status });
}

async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  } catch {
    throw new PortfolioHistoryValidationError("EMPTY_ENTRY", "Payload JSON inválido.");
  }
}

function portfolioIdFrom(request: Request, body?: Record<string, unknown>) {
  const url = new URL(request.url);
  return String(body?.portfolioId ?? url.searchParams.get("portfolioId") ?? "default");
}

export async function GET(request: Request) {
  try {
    const identity = await resolveWalletIdentity(request);
    const entries = await service.list({ ownerId: identity.ownerId }, portfolioIdFrom(request));
    return NextResponse.json({ ok: true, entries });
  } catch (error) {
    return publicError(error);
  }
}

export async function POST(request: Request) {
  try {
    const identity = await resolveWalletIdentity(request);
    const body = await jsonBody(request);
    const entry = await service.createManual({ ownerId: identity.ownerId }, {
      portfolioId: portfolioIdFrom(request, body),
      year: body.year,
      month: body.month,
      dividends: body.dividends,
    });
    return NextResponse.json({ ok: true, entry }, { status: 201 });
  } catch (error) {
    return publicError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const identity = await resolveWalletIdentity(request);
    const body = await jsonBody(request);
    const entries = await service.list({ ownerId: identity.ownerId }, portfolioIdFrom(request, body));
    const competence = String(body.competence ?? "");
    const current = entries.find((entry) => entry.competence === competence);
    if (!current) throw new Error("HISTORY_ENTRY_NOT_FOUND");

    const entry = await service.updateManual(
      { ownerId: identity.ownerId },
      current,
      { dividends: body.dividends },
    );
    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    return publicError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const identity = await resolveWalletIdentity(request);
    const body = await jsonBody(request);
    const entries = await service.list({ ownerId: identity.ownerId }, portfolioIdFrom(request, body));
    const competence = String(body.competence ?? "");
    const current = entries.find((entry) => entry.competence === competence);
    if (!current) throw new Error("HISTORY_ENTRY_NOT_FOUND");

    await service.deleteManual({ ownerId: identity.ownerId }, current);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return publicError(error);
  }
}
