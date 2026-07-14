import { NextRequest } from "next/server";
import { adminJson, authorizeAdminRequest } from "@/lib/adminApi";
import { regulatoryDataService } from "@/lib/regulatoryDataService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await authorizeAdminRequest(req, "system-health", { limit: 30 });
  if (auth.rejection) return auth.rejection;
  try {
    return adminJson({ ok: true, health: await regulatoryDataService.getSystemHealth() });
  } catch (error) {
    return adminJson({ ok: false, error: error instanceof Error ? error.message : "Erro ao consultar a saúde regulatória." }, 500);
  }
}
