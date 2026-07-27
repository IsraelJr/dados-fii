import { NextRequest, NextResponse } from "next/server";
import { regulatoryDataService } from "@/lib/regulatoryDataService";
import { requireCron } from "@/lib/security/InternalRequestAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authorization = await requireCron(request);
  if (!authorization.ok) {
    return NextResponse.json({ ok: false, error: authorization.error }, { status: authorization.status });
  }
  try {
    const snapshot = await regulatoryDataService.rebuildPremiumPeerSnapshot(authorization.identity.actor);
    return NextResponse.json({
      ok: true,
      snapshotVersion: snapshot.snapshotVersion,
      generatedAt: snapshot.generatedAt,
      sourceFundCount: snapshot.sourceFundCount,
      sourceHash: snapshot.sourceHash,
      sizeBytes: snapshot.sizeBytes,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Premium peer snapshot rebuild failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { ok: false, error: "Não foi possível reconstruir o snapshot de pares Premium." },
      { status: 503 },
    );
  }
}
