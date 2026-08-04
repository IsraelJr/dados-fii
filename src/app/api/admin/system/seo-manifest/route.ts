import { NextRequest } from "next/server";
import { adminJson, authorizeAdminRequest } from "@/lib/adminApi";
import { fundSeoManifestService } from "@/lib/seo/FundSeoManifestRuntime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function summary(manifest: Awaited<ReturnType<typeof fundSeoManifestService.getCurrent>>) {
  if (!manifest) return null;
  return {
    schemaVersion: manifest.schemaVersion,
    generatedAt: manifest.generatedAt,
    total: manifest.total,
    indexableTotal: manifest.indexableTotal,
    blockedTotal: manifest.total - manifest.indexableTotal,
  };
}

export async function GET(request: NextRequest) {
  const auth = await authorizeAdminRequest(request, "seo-manifest-status", { limit: 30, windowMs: 60_000 });
  if (auth.rejection) return auth.rejection;
  try {
    const manifest = await fundSeoManifestService.getCurrent({ force: true });
    return adminJson({ ok: true, manifest: summary(manifest) });
  } catch (error) {
    console.error("SEO manifest admin status error", error instanceof Error ? error.message : "unknown");
    return adminJson({ ok: false, error: "Não foi possível carregar o manifesto SEO." }, 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await authorizeAdminRequest(request, "seo-manifest-rebuild", { limit: 3, windowMs: 5 * 60_000 });
  if (auth.rejection) return auth.rejection;
  try {
    const manifest = await fundSeoManifestService.rebuild(auth.identity.email);
    return adminJson({ ok: true, manifest: summary(manifest) });
  } catch (error) {
    console.error("SEO manifest admin rebuild error", error instanceof Error ? error.message : "unknown");
    return adminJson({ ok: false, error: "Não foi possível reconstruir o manifesto SEO." }, 500);
  }
}
