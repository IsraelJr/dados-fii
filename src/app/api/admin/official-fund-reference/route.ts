import { NextRequest } from "next/server";
import { adminJson, authorizeAdminRequest } from "@/lib/adminApi";
import { regulatoryDataService } from "@/lib/regulatoryDataService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await authorizeAdminRequest(req, "official-fund-reference", { limit: 5, windowMs: 5 * 60_000 });
  if (auth.rejection) return auth.rejection;
  const body = await req.json().catch(() => ({}));

  try {
    const result = await regulatoryDataService.publishOfficialFundReference(body?.ticker, auth.identity.email);
    return adminJson({ ok: true, result });
  } catch (error) {
    return adminJson({ ok: false, error: "Falha ao publicar a referência oficial." }, 400);
  }
}
