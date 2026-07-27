import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { dividendUpdateService } from "@/lib/dividends/DividendUpdateService";
import { DividendUpdateConflictError } from "@/lib/dividends/DividendUpdateRepository";
import { normalizeTicker } from "@/lib/regulatory/RegulatoryNormalizer";
import { internalAuthError, requireAdminOrCron } from "@/lib/security/InternalRequestAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{16,128}$/;

export async function POST(request: NextRequest) {
  const authorization = await requireAdminOrCron(request, { scope: "update-dividends", limit: 10 });
  if (!authorization.ok) return internalAuthError(authorization);
  const parsed = await request.json().catch(() => null);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return NextResponse.json({ error: "Payload JSON inválido." }, { status: 400 });
  }
  const body = parsed as Record<string, unknown>;
  const unknownFields = Object.keys(body).filter((field) => field !== "ticker");
  if (unknownFields.length) {
    return NextResponse.json({
      error: "O payload contém campos não permitidos.",
      fields: unknownFields.sort(),
    }, { status: 400 });
  }
  const idempotencyKey = String(request.headers.get("idempotency-key") || "").trim();
  if (!IDEMPOTENCY_KEY.test(idempotencyKey)) {
    return NextResponse.json({
      error: "O header Idempotency-Key é obrigatório e deve possuir entre 16 e 128 caracteres seguros.",
    }, { status: 400 });
  }
  const ticker = normalizeTicker(body.ticker);
  if (!ticker) return NextResponse.json({ error: "Ticker ausente ou inválido." }, { status: 400 });
  try {
    const result = await dividendUpdateService.update(ticker, {
      actor: authorization.identity.actor,
      origin: authorization.identity.type,
      correlationId: request.headers.get("x-correlation-id") || randomUUID(),
      idempotencyKey,
    });
    if (result.status === "not_found") return NextResponse.json({ error: "Fundo não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true, result }, {
      headers: { "Idempotency-Replayed": result.replayed ? "true" : "false" },
    });
  } catch (error) {
    if (error instanceof DividendUpdateConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Não foi possível atualizar os rendimentos." }, { status: 503 });
  }
}
