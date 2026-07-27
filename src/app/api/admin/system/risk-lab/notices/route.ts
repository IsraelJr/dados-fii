import { NextRequest } from "next/server";
import { adminJson, authorizeAdminRequest } from "@/lib/adminApi";
import { calculateDividendSeriesReadiness } from "@/lib/risk-lab/DividendSeriesReadiness";
import { FnetDividendNoticeImportService } from "@/lib/risk-lab/FnetDividendNoticeImportService";
import { fnetNoticeCandidateStore } from "@/lib/risk-lab/FnetNoticeCandidateStore";
import { verifiedDividendNoticeStore } from "@/lib/risk-lab/VerifiedDividendNoticeStore";
import { pseudonymousLogId, safeLog } from "@/lib/observability/SafeLogger";

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
    const [candidates, mcciNotices, rbryNotices] = await Promise.all([
      service.listRecent(50),
      verifiedDividendNoticeStore.listByTicker("MCCI11"),
      verifiedDividendNoticeStore.listByTicker("RBRY11"),
    ]);
    const series = [
      calculateDividendSeriesReadiness("MCCI11", mcciNotices),
      calculateDividendSeriesReadiness("RBRY11", rbryNotices),
    ];
    return adminJson({ ok: true, enabled: enabled(), candidates, series });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar candidatos FNET.";
    safeLog("error", "risk-lab.fnet.list.failed", {
      actorId: pseudonymousLogId(authorization.identity.uid),
      correlationId: request.headers.get("x-correlation-id"),
      message,
    });
    return adminJson({ ok: false, error: "Falha ao carregar os avisos regulatórios." }, 500);
  }
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request, "risk-lab-fnet-write", { limit: 20, windowMs: 15 * 60_000 });
  if (authorization.rejection) return authorization.rejection;
  if (!enabled()) return adminJson({ ok: false, error: "Importação FNET desabilitada por feature flag." }, 503);

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "").trim().toLowerCase();
  const actor = `admin:${authorization.identity.uid}`;

  try {
    if (action === "import") {
      const result = await service.importByDocumentId(String(body?.documentId || ""), actor);
      return adminJson({ ok: true, result });
    }

    if (action === "reject") {
      const candidate = await service.reject(
        String(body?.candidateId || ""),
        actor,
        String(body?.reason || ""),
      );
      return adminJson({ ok: true, candidate });
    }

    return adminJson({ ok: false, error: "Ação inválida. Use import ou reject." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida no fluxo FNET.";
    safeLog("error", "risk-lab.fnet.write.failed", {
      action,
      actorId: pseudonymousLogId(authorization.identity.uid),
      correlationId: request.headers.get("x-correlation-id"),
      message,
    });
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
