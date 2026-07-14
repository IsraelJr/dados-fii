import { NextRequest } from "next/server";
import { adminJson, authorizeAdminRequest } from "@/lib/adminApi";
import { regulatoryDataService } from "@/lib/regulatoryDataService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authorizeAdminRequest(req, "parser-health", { limit: 30 });
  if (auth.rejection) return auth.rejection;
  try {
    const parsers = await regulatoryDataService.getParserHealth();
    return adminJson({ ok: true, generatedAt: new Date().toISOString(), parsers });
  } catch (error) {
    return adminJson({ ok: false, error: error instanceof Error ? error.message : "Erro ao consultar a saúde dos parsers." }, 500);
  }
}
