import { NextRequest } from "next/server";
import { adminJson, authorizeAdminRequest } from "@/lib/adminApi";
import { RiskLabTickerOrchestrator } from "@/lib/risk-lab/RiskLabTickerOrchestrator";

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
  const authorization = await authorizeAdminRequest(request, "risk-lab-automatic-scan", { limit: 3, windowMs: 15 * 60_000 });
  if (authorization.rejection) return authorization.rejection;
  if (!enabled()) return adminJson({ ok: false, error: "Pesquisa automática por ticker desabilitada por feature flag." }, 503);

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "").trim().toLowerCase();
  if (action !== "scan") return adminJson({ ok: false, error: "Ação inválida. Use scan." }, 400);

  try {
    const orchestrator = new RiskLabTickerOrchestrator();
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
