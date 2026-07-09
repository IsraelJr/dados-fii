import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { extractSnapshotWallet, saveMonthlyPortfolioSnapshot } from "@/lib/portfolioSnapshots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function allowedSecrets() {
  return [process.env.ADMIN_UPDATE_SECRET, process.env.CRON_SECRET].filter(Boolean);
}

function isAuthorized(req: NextRequest, body?: any) {
  const secrets = allowedSecrets();
  if (!secrets.length) return false;

  const authHeader = req.headers.get("authorization") || "";
  const headerSecret = req.headers.get("x-admin-secret") || authHeader.replace(/^Bearer\s+/i, "");
  const querySecret = req.nextUrl.searchParams.get("secret");
  const bodySecret = body?.secret;

  return [headerSecret, querySecret, bodySecret].some((value) => Boolean(value && secrets.includes(value)));
}

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
      results.push({ docId: doc.id, email, status: "error", error: err.message || "erro" });
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
    if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });

    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 150), 500);
    const force = req.nextUrl.searchParams.get("force") === "true";
    const output = await runSnapshots(limit, force);

    return NextResponse.json({ ok: true, ...output });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao gerar snapshots." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    if (!isAuthorized(req, body)) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });

    const limit = Math.min(Number(body?.limit || 150), 500);
    const force = Boolean(body?.force);
    const output = await runSnapshots(limit, force);

    return NextResponse.json({ ok: true, ...output });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao gerar snapshots." }, { status: 500 });
  }
}
