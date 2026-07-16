import { NextRequest } from "next/server";
import { adminJson, authorizeAdminRequest } from "@/lib/adminApi";
import { regulatoryDataService } from "@/lib/regulatoryDataService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request, "fund-catalog-status", { limit: 30, windowMs: 60_000 });
  if (authorization.rejection) return authorization.rejection;
  try {
    const status = await regulatoryDataService.getFundCatalogStatus();
    return adminJson({ ok: true, ...status });
  } catch (error) {
    console.error("Fund catalog status error", error instanceof Error ? error.message : "unknown");
    return adminJson({ ok: false, error: "Não foi possível carregar o estado do catálogo de fundos." }, 500);
  }
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request, "fund-catalog-write", { limit: 4, windowMs: 15 * 60_000 });
  if (authorization.rejection) return authorization.rejection;
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "").trim().toLowerCase();
  try {
    if (action === "preview") {
      const run = await regulatoryDataService.previewFundCatalog(authorization.identity.email);
      return adminJson({ ok: true, run });
    }
    if (action === "apply") {
      const runId = String(body?.runId || "");
      const approvalHash = String(body?.approvalHash || "");
      const result = await regulatoryDataService.applyFundCatalog(runId, approvalHash, authorization.identity.email);
      return adminJson({ ok: true, ...result });
    }
    if (action === "audit") {
      const audit = await regulatoryDataService.auditFundCatalog(authorization.identity.email, body?.runId ? String(body.runId) : null);
      return adminJson({ ok: true, audit });
    }
    return adminJson({ ok: false, error: "Ação inválida. Use preview, apply ou audit." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida no catálogo de fundos.";
    console.error("Fund catalog admin error", { action, message });
    const status = /bloquead|integridade|hash|prévia|inativaç/i.test(message) ? 409 : /oficial|HTTP|arquivo|consultar/i.test(message) ? 502 : 500;
    return adminJson({ ok: false, error: message }, status);
  }
}
