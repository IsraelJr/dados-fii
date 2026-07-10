import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT_PTBR: Record<string, string> = { January: "Jan", February: "Fev", March: "Mar", April: "Abr", May: "Mai", June: "Jun", July: "Jul", August: "Ago", September: "Set", October: "Out", November: "Nov", December: "Dez" };

function emailOf(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function numberOf(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value || "").replace("R$", "").trim();
  const numeric = raw.replace(/[^0-9.,-]/g, "");
  const normalized = numeric.includes(",") ? numeric.replace(/\./g, "").replace(",", ".") : numeric;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isAuthorized(req: NextRequest, bodySecret?: string) {
  const secret = process.env.ADMIN_UPDATE_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;

  const querySecret = req.nextUrl.searchParams.get("secret");
  const headerSecret = req.headers.get("x-admin-secret") || req.headers.get("x-cron-secret");
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";

  return [querySecret, headerSecret, bearer, bodySecret].some((value) => value === secret);
}

async function findUser(email: string) {
  const users = adminDb.collection("User");
  const direct = await users.doc(email).get();
  if (direct.exists) return { ref: direct.ref, docId: direct.id, data: direct.data() || {} };

  const query = await users.where("email", "==", email).limit(1).get();
  if (!query.empty) {
    const doc = query.docs[0];
    return { ref: doc.ref, docId: doc.id, data: doc.data() || {} };
  }

  return null;
}

function monthKey(year: string, month: string) {
  const index = MONTHS.indexOf(month);
  if (index < 0) return "";
  return `${year}-${String(index + 1).padStart(2, "0")}`;
}

function labelFor(year: string, month: string) {
  return `${MONTHS_SHORT_PTBR[month] || month}/${String(year).slice(-2)}`;
}

function buildLegacyRows(data: any) {
  const patrimony = data?.patrimony || {};
  const earnings = data?.earnings || {};
  const rows: Array<{ monthKey: string; year: string; month: string; label: string; totalValue: number; estimatedDividendIncome: number }> = [];

  Object.entries(patrimony).forEach(([year, months]: any) => {
    if (!/^\d{4}$/.test(String(year)) || !months || typeof months !== "object") return;

    Object.entries(months).forEach(([month, totalValue]) => {
      const key = monthKey(String(year), String(month));
      if (!key) return;

      rows.push({
        monthKey: key,
        year: String(year),
        month: String(month),
        label: labelFor(String(year), String(month)),
        totalValue: numberOf(totalValue),
        estimatedDividendIncome: numberOf(earnings?.[String(year)]?.[String(month)]),
      });
    });
  });

  return rows
    .filter((row) => row.totalValue > 0 || row.estimatedDividendIncome > 0)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

async function migrate(req: NextRequest, body?: any) {
  if (!isAuthorized(req, body?.secret)) {
    return NextResponse.json({ ok: false, error: "Nao autorizado." }, { status: 401 });
  }

  const email = emailOf(body?.email || req.nextUrl.searchParams.get("email"));
  const dryRun = body?.dryRun !== false && req.nextUrl.searchParams.get("dryRun") !== "false";
  const overwrite = body?.overwrite === true || req.nextUrl.searchParams.get("overwrite") === "true";

  if (!isEmail(email)) return NextResponse.json({ ok: false, error: "Informe um e-mail válido." }, { status: 400 });

  const user = await findUser(email);
  if (!user) return NextResponse.json({ ok: false, error: "Usuário não encontrado." }, { status: 404 });

  const rows = buildLegacyRows(user.data);
  const existingSnap = await user.ref.collection("WalletSnapshots").get();
  const existing = new Set(existingSnap.docs.map((doc) => doc.id));

  const willCreate = rows.filter((row) => overwrite || !existing.has(row.monthKey));
  const willSkip = rows.filter((row) => !overwrite && existing.has(row.monthKey));

  if (!dryRun) {
    const batch = adminDb.batch();
    const now = new Date().toISOString();

    willCreate.forEach((row) => {
      const ref = user.ref.collection("WalletSnapshots").doc(row.monthKey);
      batch.set(ref, {
        ...row,
        source: "legacy_ios_migration",
        dataQuality: "aggregate_only",
        walletCount: 0,
        totalQuotas: 0,
        positions: [],
        closedAt: now,
        migratedAt: adminFieldValue.serverTimestamp(),
        updatedAt: adminFieldValue.serverTimestamp(),
        createdAt: adminFieldValue.serverTimestamp(),
      }, { merge: true });
    });

    batch.set(user.ref, {
      legacyIosMigratedAt: adminFieldValue.serverTimestamp(),
      legacyIosMigratedMonths: willCreate.length,
      legacyIosMigrationSource: "patrimony_and_earnings",
      legacyIosMigrationLastRunAt: now,
      updatedAt: adminFieldValue.serverTimestamp(),
    }, { merge: true });

    await batch.commit();
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    overwrite,
    email,
    docId: user.docId,
    legacyMonthsFound: rows.length,
    alreadyMigratedSnapshots: existing.size,
    willCreate: willCreate.length,
    willSkip: willSkip.length,
    months: rows.map((row) => ({ monthKey: row.monthKey, totalValue: row.totalValue, estimatedDividendIncome: row.estimatedDividendIncome, status: overwrite || !existing.has(row.monthKey) ? "will_create" : "will_skip" })).slice(0, 120),
  });
}

export async function GET(req: NextRequest) {
  return migrate(req);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return migrate(req, body);
}
