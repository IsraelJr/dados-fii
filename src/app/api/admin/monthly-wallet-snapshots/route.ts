import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { buildWalletSnapshot, getAllPricesFromSheet, getPreviousMonthKey, normalizeWallet, parseMonthKey } from "@/lib/walletSnapshots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest, bodySecret?: string) {
  const secret = process.env.ADMIN_UPDATE_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;

  const querySecret = req.nextUrl.searchParams.get("secret");
  const headerSecret = req.headers.get("x-admin-secret") || req.headers.get("x-cron-secret");
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";

  return [querySecret, headerSecret, bearer, bodySecret].some((value) => value === secret);
}

async function runMonthlySnapshot(req: NextRequest, body?: any) {
  if (!isAuthorized(req, body?.secret)) {
    return NextResponse.json({ ok: false, error: "Nao autorizado." }, { status: 401 });
  }

  const monthKey = String(body?.monthKey || req.nextUrl.searchParams.get("monthKey") || getPreviousMonthKey());
  const { year, month } = parseMonthKey(monthKey);
  const pricesByTicker = await getAllPricesFromSheet();
  const users = await adminDb.collection("User").get();

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ userId: string; error: string }> = [];

  for (const userDoc of users.docs) {
    const data = userDoc.data();
    const wallet = normalizeWallet(data.wallet || data.walletWeb || []);

    if (!wallet.length) {
      skipped += 1;
      continue;
    }

    try {
      const snapshot = await buildWalletSnapshot({ wallet, monthKey, pricesByTicker, source: "monthly_job" });
      await userDoc.ref.collection("WalletSnapshots").doc(monthKey).set(snapshot, { merge: true });
      await userDoc.ref.set(
        {
          patrimony: { [year]: { [month]: snapshot.totalValue } },
          earnings: { [year]: { [month]: snapshot.estimatedDividendIncome } },
          lastWalletSnapshotMonth: monthKey,
          lastWalletSnapshotAt: snapshot.closedAt,
        },
        { merge: true }
      );
      processed += 1;
    } catch (err: any) {
      failed += 1;
      errors.push({ userId: userDoc.id, error: err.message || "Erro desconhecido" });
    }
  }

  return NextResponse.json({
    ok: failed === 0,
    monthKey,
    year,
    month,
    users: users.size,
    processed,
    skipped,
    failed,
    errors: errors.slice(0, 20),
    generatedAt: new Date().toISOString(),
  });
}

export async function GET(req: NextRequest) {
  return runMonthlySnapshot(req);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return runMonthlySnapshot(req, body);
}
