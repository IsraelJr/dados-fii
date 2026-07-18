import { NextRequest } from "next/server";
import { adminJson, authorizeAdminRequest } from "@/lib/adminApi";
import { DividendStressRunService } from "@/lib/risk-lab/DividendStressRunService";
import { dividendStressRunStore } from "@/lib/risk-lab/DividendStressRunStore";
import { verifiedDividendNoticeStore } from "@/lib/risk-lab/VerifiedDividendNoticeStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const service = new DividendStressRunService({
  noticeReader: verifiedDividendNoticeStore,
  runRepository: dividendStressRunStore,
});

function enabled() {
  return process.env.ENABLE_RISK_LAB_STRESS_RUN === "true";
}

export async function GET(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request, "risk-lab-stress-run-list", {
    limit: 30,
    windowMs: 60_000,
  });
  if (authorization.rejection) return authorization.rejection;

  try {
    const featureEnabled = enabled();
    const statuses = await Promise.all([
      service.status("MCCI11", featureEnabled),
      service.status("RBRY11", featureEnabled),
    ]);
    return adminJson({ ok: true, enabled: featureEnabled, statuses });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar execuções de estresse.";
    console.error("Risk Lab stress run list error", {
      actor: authorization.identity.email,
      message,
    });
    return adminJson({ ok: false, error: message }, 500);
  }
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request, "risk-lab-stress-run-execute", {
    limit: 5,
    windowMs: 15 * 60_000,
  });
  if (authorization.rejection) return authorization.rejection;
  if (!enabled()) {
    return adminJson({ ok: false, error: "Execução manual do detector desabilitada por feature flag." }, 503);
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "").trim().toLowerCase();
  const actor = authorization.identity.email;

  try {
    if (action !== "execute") {
      return adminJson({ ok: false, error: "Ação inválida. Use execute." }, 400);
    }
    if (body?.confirmed !== true) {
      return adminJson({
        ok: false,
        error: "A execução exige confirmação explícita de que não produzirá efeitos externos.",
      }, 400);
    }

    const result = await service.execute(String(body?.ticker || ""), actor);
    return adminJson({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida na execução do detector.";
    console.error("Risk Lab stress run execute error", { action, actor, message });
    const status = /série insuficiente/i.test(message)
      ? 409
      : /inválido|não suportado|confirmação/i.test(message)
        ? 400
        : 500;
    return adminJson({ ok: false, error: message }, status);
  }
}
