import { NextRequest } from "next/server";
import { adminJson, authorizeAdminRequest } from "@/lib/adminApi";
import { RiskLabAutomaticOrchestrator } from "@/lib/risk-lab/RiskLabAutomaticOrchestrator";
import { RISK_LAB_AUTOMATIC_RATE_LIMIT } from "@/lib/risk-lab/RiskLabAutomaticRateLimit";
import { riskLabAutomaticScanStore } from "@/lib/risk-lab/RiskLabAutomaticScanStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function enabled() {
  return process.env.ENABLE_RISK_LAB_AUTOMATIC_DISCOVERY !== "false";
}

export async function GET(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request, "risk-lab-automatic-status", { limit: 30, windowMs: 60_000 });
  if (authorization.rejection) return authorization.rejection;

  return adminJson({
    ok: true,
    enabled: enabled(),
    input: "ticker_only",
    requiresHumanDocumentValidation: false,
    supportedExamples: ["HCTR11", "MCCI11", "RBRY11"],
    instructions: "Informe apenas o ticker. O sistema pesquisa, valida e bloqueia automaticamente dados inconclusivos.",
  });
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeAdminRequest(
    request,
    "risk-lab-automatic-scan",
    RISK_LAB_AUTOMATIC_RATE_LIMIT,
  );
  if (authorization.rejection) return authorization.rejection;
  if (!enabled()) return adminJson({ ok: false, error: "Pesquisa automática por ticker desabilitada por feature flag." }, 503);

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "").trim().toLowerCase();
  if (action !== "scan") return adminJson({ ok: false, error: "Ação inválida. Use scan." }, 400);

  try {
    const orchestrator = new RiskLabAutomaticOrchestrator({ repository: riskLabAutomaticScanStore });
    const scan = await orchestrator.scan(String(body?.ticker || ""), authorization.identity.email);
    return adminJson({ ok: true, scan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida na pesquisa automática.";
    console.error("Risk Lab automatic scan error", { actor: authorization.identity.email, message });
    const status = /desabilitada/i.test(message)
      ? 503
      : /inválido|não encontrado|CNPJ|catálogo|nenhum ano/i.test(message)
        ? 400
        : /CVM respondeu|tempo limite|indisponível/i.test(message)
          ? 502
          : 500;
    return adminJson({ ok: false, error: message }, status);
  }
}
