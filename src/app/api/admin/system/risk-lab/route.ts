import { NextRequest } from "next/server";
import { adminJson, authorizeAdminRequest } from "@/lib/adminApi";
import { riskLabService } from "@/lib/risk-lab/RiskLabService";
import { pseudonymousLogId, safeLog } from "@/lib/observability/SafeLogger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request, "risk-lab-status", { limit: 30, windowMs: 60_000 });
  if (authorization.rejection) return authorization.rejection;
  try {
    const status = await riskLabService.status();
    return adminJson({ ok: true, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível carregar o Risk Lab.";
    console.error("Risk Lab status error", { message });
    return adminJson({ ok: false, error: message }, 500);
  }
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request, "risk-lab-generate", { limit: 5, windowMs: 15 * 60_000 });
  if (authorization.rejection) return authorization.rejection;
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "generate").trim().toLowerCase();
  const ticker = String(body?.ticker || "").trim().toUpperCase();

  if (action !== "generate") return adminJson({ ok: false, error: "Ação inválida. Use generate." }, 400);

  try {
    const report = await riskLabService.generate(ticker, `admin:${authorization.identity.uid}`);
    return adminJson({ ok: true, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida na execução do Risk Lab.";
    safeLog("error", "risk-lab.generate.failed", {
      ticker,
      actorId: pseudonymousLogId(authorization.identity.uid),
      correlationId: request.headers.get("x-correlation-id"),
      message,
    });
    const status = /em andamento|concorrente|lock/i.test(message)
      ? 409
      : /desabilitado/i.test(message)
        ? 503
        : /ticker|autorizado|inválido|snapshot|dataset|escopo/i.test(message)
          ? 400
          : 500;
    return adminJson({ ok: false, error: message }, status);
  }
}
