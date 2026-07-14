import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized, readAdminSession } from "@/lib/adminSession";
import { runSystemValidation } from "@/services/system/SystemValidationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function reply(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export async function GET() {
  return reply({ ok: false, error: "Método não permitido." }, 405);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  if (!isAdminAuthorized(req, body)) {
    return reply({ ok: false, error: "Não autorizado." }, 401);
  }

  try {
    const session = readAdminSession(req);
    const report = await runSystemValidation({
      requestedBy: session?.user || "admin",
      persist: body?.persist !== false,
    });
    return reply({ ok: true, report });
  } catch (error: any) {
    return reply({
      ok: false,
      error: error?.message || "Falha ao executar validação do sistema.",
    }, 500);
  }
}
