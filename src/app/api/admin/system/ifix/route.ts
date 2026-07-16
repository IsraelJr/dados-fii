import { NextRequest } from "next/server";
import { adminJson, authorizeAdminRequest } from "@/lib/adminApi";
import { regulatoryDataService } from "@/lib/regulatoryDataService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function summary(composition: Awaited<ReturnType<typeof regulatoryDataService.getIfixComposition>>) {
  if (!composition) return null;
  return {
    index: composition.index,
    referenceDate: composition.referenceDate,
    fetchedAt: composition.fetchedAt,
    source: composition.source,
    total: composition.total,
  };
}

export async function GET(request: NextRequest) {
  const auth = await authorizeAdminRequest(request, "ifix-status", { limit: 30, windowMs: 60_000 });
  if (auth.rejection) return auth.rejection;
  try {
    const composition = await regulatoryDataService.getIfixComposition();
    return adminJson({ ok: true, composition: summary(composition) });
  } catch (error) {
    console.error("IFIX admin status error", error instanceof Error ? error.message : "unknown");
    return adminJson({ ok: false, error: "Não foi possível carregar a composição do IFIX." }, 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await authorizeAdminRequest(request, "sync-ifix", { limit: 3, windowMs: 5 * 60_000 });
  if (auth.rejection) return auth.rejection;
  try {
    const result = await regulatoryDataService.syncIfixComposition(auth.identity.email);
    return adminJson({
      ok: true,
      sync: {
        changed: result.changed,
        compositionHash: result.compositionHash,
        previousReferenceDate: result.previousReferenceDate,
        composition: summary(result.composition),
      },
    });
  } catch (error) {
    console.error("IFIX admin sync error", error instanceof Error ? error.message : "unknown");
    return adminJson({ ok: false, error: "Não foi possível consultar a composição oficial do IFIX na B3." }, 502);
  }
}
