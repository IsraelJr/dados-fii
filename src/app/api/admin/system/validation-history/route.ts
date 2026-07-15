import { NextRequest } from "next/server";
import { adminJson, authorizeAdminRequest } from "@/lib/adminApi";
import { regulatoryDataService } from "@/lib/regulatoryDataService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authorizeAdminRequest(req, "validation-history", { limit: 30 });
  if (auth.rejection) return auth.rejection;
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") || 20), 1), 50);
  try {
    const history = await regulatoryDataService.getValidationHistory(limit);
    return adminJson({ ok: true, count: history.length, history });
  } catch (error) {
    return adminJson({ ok: false, error: error instanceof Error ? error.message : "Erro ao consultar o histórico de validações." }, 500);
  }
}
