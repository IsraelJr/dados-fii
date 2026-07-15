import { NextRequest } from "next/server";
import { adminJson, authorizeAdminRequest } from "@/lib/adminApi";
import { featureEnabled } from "@/lib/featureFlags";
import { regulatoryDataService } from "@/lib/regulatoryDataService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authorizeAdminRequest(req, "system-health", { limit: 30 });
  if (auth.rejection) return auth.rejection;
  if (!featureEnabled("ENABLE_HEALTH_MONITOR")) return adminJson({ ok: false, error: "Health Monitor desabilitado por feature flag." }, 503);
  try {
    return adminJson({ ok: true, health: await regulatoryDataService.getSystemHealth() });
  } catch (error) {
    return adminJson({ ok: false, error: error instanceof Error ? error.message : "Erro ao consultar a saúde regulatória." }, 500);
  }
}
