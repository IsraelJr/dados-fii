import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/adminSession";
import { getSystemValidationHistory } from "@/services/system/SystemValidationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return reply({ ok: false, error: "Não autorizado." }, 401);
  }

  try {
    const limit = Number(req.nextUrl.searchParams.get("limit") || 20);
    const history = await getSystemValidationHistory(limit);
    return reply({ ok: true, count: history.length, history });
  } catch (error: any) {
    return reply({
      ok: false,
      error: error?.message || "Falha ao consultar histórico de validações.",
    }, 500);
  }
}
