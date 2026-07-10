import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT_PTBR: Record<string, string> = { January: "Jan", February: "Fev", March: "Mar", April: "Abr", May: "Mai", June: "Jun", July: "Jul", August: "Ago", September: "Set", October: "Out", November: "Nov", December: "Dez" };

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function emailOf(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isExpired(value: any) {
  if (!value) return true;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return !date || Number.isNaN(date.getTime()) || date.getTime() < Date.now();
}

function labelFor(year: string, month: string) {
  return `${MONTHS_SHORT_PTBR[month] || month}/${String(year).slice(-2)}`;
}

function numberOf(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value || "0").replace("R$", "").trim();
  const numeric = raw.replace(/[^0-9.,-]/g, "");
  const normalized = numeric.includes(",") ? numeric.replace(/\./g, "").replace(",", ".") : numeric;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function hasSession(email: string, token: unknown) {
  const sessionToken = String(token || "");
  if (!sessionToken) return false;

  const snap = await adminDb.collection("WalletSessions").doc(hash(`${email}:${sessionToken}`)).get();
  if (!snap.exists) return false;

  const data = snap.data() || {};
  return data.email === email && !isExpired(data.expiresAt);
}

async function findUserByEmail(email: string) {
  const users = adminDb.collection("User");
  const direct = await users.doc(email).get();
  if (direct.exists) return direct.ref;

  const query = await users.where("email", "==", email).limit(1).get();
  return query.empty ? null : query.docs[0].ref;
}

function legacySnapshots(data: any) {
  const patrimony = data?.patrimony || {};
  const earnings = data?.earnings || {};
  const results: any[] = [];

  Object.entries(patrimony).forEach(([year, months]: any) => {
    if (!months || typeof months !== "object") return;
    Object.entries(months).forEach(([month, totalValue]: any) => {
      const monthIndex = MONTHS.indexOf(month);
      if (monthIndex < 0) return;
      results.push({
        monthKey: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
        year,
        month,
        label: labelFor(year, month),
        totalValue: numberOf(totalValue),
        estimatedDividendIncome: numberOf(earnings?.[year]?.[month]),
        source: "legacy_ios",
        dataQuality: "aggregate_only",
      });
    });
  });

  return results.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

async function readSnapshotsFromUserRef(userRef: FirebaseFirestore.DocumentReference) {
  const snapshot = await userRef.collection("WalletSnapshots").orderBy("monthKey", "asc").limit(120).get();
  const snapshots = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      monthKey: data.monthKey || doc.id,
      year: data.year,
      month: data.month,
      label: data.label,
      totalValue: numberOf(data.totalValue),
      estimatedDividendIncome: numberOf(data.estimatedDividendIncome ?? data.estimatedMonthlyIncome ?? data.announcedMonthlyIncome),
      walletCount: numberOf(data.walletCount),
      totalQuotas: numberOf(data.totalQuotas),
      topWeightTicker: data.topWeightTicker || "",
      topIncomeTicker: data.topIncomeTicker || "",
      source: data.source || "monthly_job",
      dataQuality: data.dataQuality || "snapshot",
      closedAt: data.closedAt || "",
    };
  });

  if (snapshots.length) return snapshots;

  const userDoc = await userRef.get();
  return userDoc.exists ? legacySnapshots(userDoc.data()) : [];
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const anonId = cookieStore.get("anonId")?.value;

    if (!anonId) return NextResponse.json({ ok: true, snapshots: [] });

    const userRef = adminDb.collection("User").doc(anonId);
    const snapshots = await readSnapshotsFromUserRef(userRef);
    return NextResponse.json({ ok: true, source: "anonId", snapshots });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao buscar snapshots." }, { status: 500 });
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
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao buscar snapshots." }, { status: 500 });
  }
}
