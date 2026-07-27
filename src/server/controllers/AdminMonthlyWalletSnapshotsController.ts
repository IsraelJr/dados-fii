// Controlador de aplicação; o Route Handler permanece sem acesso à persistência.
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { buildWalletSnapshot, getAllPricesFromSheet, getPreviousMonthKey, normalizeWallet, parseMonthKey } from "@/lib/walletSnapshots";
import { internalAuthError, requireAdminOrCron } from "@/lib/security/InternalRequestAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function runMonthlySnapshot(req: NextRequest, body?: any) {
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
      errors.push({ userId: userDoc.id, error: "Erro desconhecido" });
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
  const authorization = await requireAdminOrCron(req, { scope: "monthly-wallet-snapshots" });
  if (!authorization.ok) return internalAuthError(authorization);
  return runMonthlySnapshot(req);
}

export async function POST(req: NextRequest) {
  const authorization = await requireAdminOrCron(req, { scope: "monthly-wallet-snapshots" });
  if (!authorization.ok) return internalAuthError(authorization);
  const body = await req.json().catch(() => ({}));
  return runMonthlySnapshot(req, body);
}
