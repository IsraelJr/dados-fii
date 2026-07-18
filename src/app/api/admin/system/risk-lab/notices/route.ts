import { NextRequest } from "next/server";
import { adminJson, authorizeAdminRequest } from "@/lib/adminApi";
import { FnetDividendNoticeImportService } from "@/lib/risk-lab/FnetDividendNoticeImportService";
import { fnetNoticeCandidateStore } from "@/lib/risk-lab/FnetNoticeCandidateStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const service = new FnetDividendNoticeImportService({ repository: fnetNoticeCandidateStore });

function enabled() {
  return process.env.ENABLE_RISK_LAB_FNET_IMPORT === "true";
}

export async function GET(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request, "risk-lab-fnet-list", { limit: 30, windowMs: 60_000 });
  if (authorization.rejection) return authorization.rejection;

  try {
    const candidates = await service.listRecent(50);
    return adminJson({ ok: true, enabled: enabled(), candidates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar candidatos FNET.";
    console.error("Risk Lab FNET list error", { actor: authorization.identity.email, message });
    return adminJson({ ok: false, error: message }, 500);
  }
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request, "risk-lab-fnet-write", { limit: 20, windowMs: 15 * 60_000 });
  if (authorization.rejection) return authorization.rejection;
  if (!enabled()) return adminJson({ ok: false, error: "Importação FNET desabilitada por feature flag." }, 503);

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "").trim().toLowerCase();
  const actor = authorization.identity.email;

  try {
    if (action === "import") {
      const result = await service.importByDocumentId(String(body?.documentId || ""), actor);
      return adminJson({ ok: true, result });
    }

    if (action === "approve") {
      if (body?.confirmed !== true) {
        return adminJson({ ok: false, error: "A aprovação exige confirmação explícita da revisão humana." }, 400);
      }
      const candidate = await service.approve(String(body?.candidateId || ""), actor);
      return adminJson({ ok: true, candidate });
    }

    if (action === "reject") {
      const candidate = await service.reject(
        String(body?.candidateId || ""),
        actor,
        String(body?.reason || ""),
      );
      return adminJson({ ok: true, candidate });
    }

    return adminJson({ ok: false, error: "Ação inválida. Use import, approve ou reject." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida no fluxo FNET.";
    console.error("Risk Lab FNET write error", { action, actor, message });
    const status = /desabilitada/i.test(message)
      ? 503
      : /já revisado|não encontrado|conflito/i.test(message)
        ? 409
        : /inválido|diverge|não pertence|exige|ausente|inesperado|FNET respondeu/i.test(message)
          ? 400
          : 500;
    return adminJson({ ok: false, error: message }, status);
  }
}
