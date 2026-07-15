import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  legacyWalletSnapshots,
  mergeWalletSnapshots,
  walletSnapshotNumber,
  type WalletSnapshotRecord,
} from "@/lib/walletHistory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function emailOf(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isExpired(value: unknown) {
  if (!value) return true;
  const date = typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate(): Date }).toDate()
    : new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) || date.getTime() < Date.now();
}

async function hasSession(email: string, token: unknown) {
  const sessionToken = String(token || "");
  if (!sessionToken) return false;
  const snapshot = await adminDb.collection("WalletSessions").doc(hash(`${email}:${sessionToken}`)).get();
  if (!snapshot.exists) return false;
  const data = snapshot.data() || {};
  return data.email === email && !isExpired(data.expiresAt);
}

async function findUserByEmail(email: string) {
  const users = adminDb.collection("User");
  const direct = await users.doc(email).get();
  if (direct.exists) return direct.ref;
  const query = await users.where("email", "==", email).limit(1).get();
  return query.empty ? null : query.docs[0].ref;
}

async function readSnapshotsFromUserRef(userRef: FirebaseFirestore.DocumentReference) {
  const [snapshot, userDoc] = await Promise.all([
    userRef.collection("WalletSnapshots").orderBy("monthKey", "asc").limit(120).get(),
    userRef.get(),
  ]);
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
  const legacy = userDoc.exists ? legacyWalletSnapshots(userDoc.data() as Record<string, unknown>) : [];
  return mergeWalletSnapshots(legacy, persisted);
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const anonId = cookieStore.get("anonId")?.value;
    if (!anonId) return NextResponse.json({ ok: true, snapshots: [] });
    const userRef = adminDb.collection("User").doc(anonId);
    const snapshots = await readSnapshotsFromUserRef(userRef);
    return NextResponse.json({ ok: true, source: "anonId", snapshots });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro ao buscar snapshots." }, { status: 500 });
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
    const snapshots = await readSnapshotsFromUserRef(userRef);
    return NextResponse.json({ ok: true, source: "email", snapshots });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro ao buscar snapshots." }, { status: 500 });
  }
}
