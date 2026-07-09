import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPORT_COLLECTION = "UserRiskReports";
const TIME_ZONE = "America/Sao_Paulo";

function sha256(value: string) {
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

function currentMonthKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}`;
}

function reportCredits(data: Record<string, any>) {
  const parsed = Number(data?.riskReportCredits ?? data?.reportCredits ?? data?.walletRiskReportCredits ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function walletCount(data: any) {
  const candidates = [
    data?.wallet,
    data?.wallet?.items,
    data?.carteira,
    data?.carteira?.items,
    data?.portfolio,
    data?.portfolio?.items,
    data?.monitored?.fiis,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.length;
    if (candidate && typeof candidate === "object") return Object.keys(candidate).length;
  }

  return 0;
}

async function hasSession(email: string, token: unknown) {
  const sessionToken = String(token || "");
  if (!sessionToken) return false;

  const snap = await adminDb.collection("WalletSessions").doc(sha256(`${email}:${sessionToken}`)).get();
  if (!snap.exists) return false;

  const data = snap.data() || {};
  return data.email === email && !isExpired(data.expiresAt);
}

async function findUserByEmail(email: string) {
  const users = adminDb.collection("User");
  const direct = await users.doc(email).get();
  if (direct.exists) return { docId: direct.id, data: direct.data() || {} };

  const query = await users.where("email", "==", email).limit(1).get();
  if (!query.empty) {
    const doc = query.docs[0];
    return { docId: doc.id, data: doc.data() || {} };
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = emailOf(body?.email);
    const sessionToken = body?.sessionToken;

    if (!isEmail(email)) return NextResponse.json({ ok: false, error: "Informe um e-mail válido." }, { status: 400 });
    if (!(await hasSession(email, sessionToken))) {
      return NextResponse.json({ ok: false, error: "Confirme o código da carteira antes de consultar o relatório." }, { status: 401 });
    }

    const user = await findUserByEmail(email);
    if (!user) return NextResponse.json({ ok: false, error: "Usuário não encontrado." }, { status: 404 });

    const month = currentMonthKey();
    const reportId = sha256(`${user.docId}:${month}:wallet-risk-report`);
    const reportSnap = await adminDb.collection(REPORT_COLLECTION).doc(reportId).get();
    const report = reportSnap.data() || {};
    const isVip = user.data?.isVip === true;
    const credits = reportCredits(user.data);

    return NextResponse.json({
      ok: true,
      email,
      month,
      isVip,
      credits,
      walletCount: walletCount(user.data),
      canGenerate: isVip || credits > 0,
      hasCurrentReport: reportSnap.exists && report.status === "done",
      currentReportStatus: report.status || "none",
      reportId: reportSnap.exists ? reportId : "",
      reportMarkdown: report.status === "done" ? report.reportMarkdown || "" : "",
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao consultar status do relatório." }, { status: 500 });
  }
}
