// Controlador de aplicação; o Route Handler permanece sem acesso à persistência.
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  walletSnapshotNumber,
  type WalletSnapshotRecord,
} from "@/lib/walletHistory";
import { walletSessionStore } from "@/server/auth/FirebaseWalletSessionStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function emailOf(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function hasSession(email: string, token: unknown) {
  return walletSessionStore.verify(email, token);
}

async function findUserByEmail(email: string) {
  const users = adminDb.collection("User");
  const direct = await users.doc(email).get();
  if (direct.exists) return direct.ref;
  const query = await users.where("email", "==", email).limit(1).get();
  return query.empty ? null : query.docs[0].ref;
}

async function readPersistedSnapshots(userRef: FirebaseFirestore.DocumentReference) {
  const snapshot = await userRef.collection("WalletSnapshots").orderBy("monthKey", "asc").limit(120).get();
  const persisted: WalletSnapshotRecord[] = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      monthKey: String(data.monthKey || doc.id),
      year: data.year ? String(data.year) : undefined,
      month: data.month ? String(data.month) : undefined,
      label: data.label ? String(data.label) : undefined,
      totalValue: walletSnapshotNumber(data.totalValue),
      estimatedDividendIncome: walletSnapshotNumber(data.estimatedDividendIncome ?? data.estimatedMonthlyIncome ?? data.announcedMonthlyIncome),
      walletCount: walletSnapshotNumber(data.walletCount),
      totalQuotas: walletSnapshotNumber(data.totalQuotas),
      topWeightTicker: String(data.topWeightTicker || ""),
      topIncomeTicker: String(data.topIncomeTicker || ""),
      source: String(data.source || "monthly_job"),
      dataQuality: String(data.dataQuality || "snapshot"),
      closedAt: data.closedAt || "",
    };
  });

  return Object.freeze(persisted.sort((left, right) => left.monthKey.localeCompare(right.monthKey)));
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const anonId = cookieStore.get("anonId")?.value;
    if (!anonId) return NextResponse.json({ ok: true, snapshots: [] });
    const userRef = adminDb.collection("User").doc(anonId);
    const snapshots = await readPersistedSnapshots(userRef);
    return NextResponse.json({ ok: true, source: "anonId", snapshots });
  } catch {
    return NextResponse.json({ ok: false, error: "Erro ao buscar snapshots." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = emailOf(body?.email);
    if (!isEmail(email)) return NextResponse.json({ ok: false, error: "Informe um e-mail válido." }, { status: 400 });
    if (!(await hasSession(email, body?.sessionToken))) {
      return NextResponse.json({ ok: false, error: "Confirme o código antes de carregar o histórico." }, { status: 401 });
    }
    const userRef = await findUserByEmail(email);
    if (!userRef) return NextResponse.json({ ok: true, source: "email", snapshots: [] });
    const snapshots = await readPersistedSnapshots(userRef);
    return NextResponse.json({ ok: true, source: "email", snapshots });
  } catch {
    return NextResponse.json({ ok: false, error: "Erro ao buscar snapshots." }, { status: 500 });
  }
}
