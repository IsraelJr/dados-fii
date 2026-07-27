import { NextRequest } from "next/server";
import { adminJson, authorizeAdminRequest } from "@/lib/adminApi";
import { featureEnabled } from "@/lib/featureFlags";
import { regulatoryDataService, ValidationExecutionError } from "@/lib/regulatoryDataService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await authorizeAdminRequest(req, "run-validation", { limit: 3, windowMs: 5 * 60_000 });
  if (auth.rejection) return auth.rejection;
  if (!featureEnabled("ENABLE_SYSTEM_VALIDATION")) return adminJson({ ok: false, error: "Validation System desabilitado por feature flag." }, 503);
  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body?.limit || 400), 1), 500);
  try {
    const run = await regulatoryDataService.runValidation(auth.identity.email, { limit });
    return adminJson({ ok: true, run });
  } catch (error) {
    if (error instanceof ValidationExecutionError) return adminJson({
      ok: false,
      error: "A validação regulatória falhou. Consulte a execução persistida pelo identificador retornado.",
      run: error.run,
    }, 500);
    return adminJson({ ok: false, error: "Erro ao executar a validação regulatória." }, 500);
  }
}
