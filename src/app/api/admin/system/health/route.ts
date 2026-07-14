import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/adminSession";
import {
  getLatestSystemValidation,
  type SystemValidationReport,
} from "@/services/system/SystemValidationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PersistedSystemValidation = SystemValidationReport & { id?: string };

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
    const latest = await getLatestSystemValidation() as PersistedSystemValidation | null;
    return reply({
      ok: true,
      health: latest
        ? {
            status: latest.status,
            score: latest.score,
            summary: latest.summary,
            generatedAt: latest.generatedAt,
            runId: latest.runId || latest.id || null,
            version: latest.version,
          }
        : {
            status: "unknown",
            score: null,
            summary: null,
            generatedAt: null,
            runId: null,
            version: "system-validation-v1",
          },
    });
  } catch (error: any) {
    return reply({
      ok: false,
      error: error?.message || "Falha ao consultar saúde do sistema.",
    }, 500);
  }
}
