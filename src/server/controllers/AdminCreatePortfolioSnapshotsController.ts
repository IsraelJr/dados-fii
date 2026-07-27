// Controlador de aplicação; o Route Handler permanece sem acesso à persistência.
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { extractSnapshotWallet, saveMonthlyPortfolioSnapshot } from "@/lib/portfolioSnapshots";
import { internalAuthError, requireAdminOrCron } from "@/lib/security/InternalRequestAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function runSnapshots(limit = 150, force = false) {
  const snap = await adminDb.collection("User").limit(limit).get();
  const results: Array<{ docId: string; email?: string; status: string; snapshotId?: string; reason?: string; error?: string }> = [];

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const email = String(data.email || doc.id || "").trim().toLowerCase();
    const wallet = extractSnapshotWallet(data);

    if (!wallet.length) {
      results.push({ docId: doc.id, email, status: "skipped", reason: "empty_wallet" });
      continue;
    }

    try {
      const result = await saveMonthlyPortfolioSnapshot({ userDocId: doc.id, email, wallet, force });
      results.push({
        docId: doc.id,
        email,
        status: result.saved ? "saved" : "skipped",
        snapshotId: result.snapshotId,
        reason: result.reason,
      });
    } catch (err: any) {
      results.push({ docId: doc.id, email, status: "error", error: "erro" });
    }
  }

  return {
    total: results.length,
    saved: results.filter((item) => item.status === "saved").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    errors: results.filter((item) => item.status === "error").length,
    results,
  };
}

export async function GET(req: NextRequest) {
  try {
    const authorization = await requireAdminOrCron(req, { scope: "create-portfolio-snapshots" });
    if (!authorization.ok) return internalAuthError(authorization);

    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 150), 500);
    const force = req.nextUrl.searchParams.get("force") === "true";
    const output = await runSnapshots(limit, force);

    return NextResponse.json({ ok: true, ...output });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "Erro ao gerar snapshots." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authorization = await requireAdminOrCron(req, { scope: "create-portfolio-snapshots" });
    if (!authorization.ok) return internalAuthError(authorization);
    const body = await req.json().catch(() => ({}));

    const limit = Math.min(Number(body?.limit || 150), 500);
    const force = Boolean(body?.force);
    const output = await runSnapshots(limit, force);

    return NextResponse.json({ ok: true, ...output });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "Erro ao gerar snapshots." }, { status: 500 });
  }
}
