import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { fundSeoManifestService } from "@/lib/seo/FundSeoManifestRuntime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function validSecret(request: NextRequest) {
  const expected = String(process.env.CRON_SECRET || "");
  const authorization = request.headers.get("authorization") || "";
  const received = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function GET(request: NextRequest) {
  if (!validSecret(request)) {
    return NextResponse.json({ ok: false, error: "Cron não autorizado." }, { status: 401 });
  }
  try {
    const manifest = await fundSeoManifestService.rebuild("cron:seo-manifest");
    return NextResponse.json({
      ok: true,
      manifest: {
        generatedAt: manifest.generatedAt,
        total: manifest.total,
        indexableTotal: manifest.indexableTotal,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("SEO manifest cron error", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, error: "Não foi possível reconstruir o manifesto SEO." }, { status: 500 });
  }
}
