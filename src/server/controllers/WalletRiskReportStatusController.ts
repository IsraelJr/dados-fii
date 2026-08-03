// Controlador de aplicação; o Route Handler permanece sem acesso à persistência.
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FII_RISK_REPORT_PROMPT_VERSION } from "@/lib/prompts/fiiRiskReport";
import {
  canReuseAutomaticReport,
  isManualPlaceholderReport,
  walletRiskReportAutomaticEnabled,
  walletRiskReportManualFallbackEnabled,
} from "@/lib/reports/WalletRiskReportAutomationPolicy";
import { walletSessionStore } from "@/server/auth/FirebaseWalletSessionStore";

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

function currentMonthKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}`;
}

function reportCredits(data: Record<string, unknown>) {
  const parsed = Number(data.riskReportCredits ?? data.reportCredits ?? data.walletRiskReportCredits ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function walletCount(data: Record<string, unknown>) {
  const candidates = [
    data.wallet,
    (data.wallet as Record<string, unknown> | undefined)?.items,
    data.carteira,
    (data.carteira as Record<string, unknown> | undefined)?.items,
    data.portfolio,
    (data.portfolio as Record<string, unknown> | undefined)?.items,
    (data.monitored as Record<string, unknown> | undefined)?.fiis,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.length;
    if (candidate && typeof candidate === "object") return Object.keys(candidate).length;
  }

  return 0;
}

async function hasSession(email: string, token: unknown) {
  return walletSessionStore.verify(email, token);
}

async function findUserByEmail(email: string) {
  const users = adminDb.collection("User");
  const direct = await users.doc(email).get();
  if (direct.exists) return { docId: direct.id, data: direct.data() || {} };

  const query = await users.where("email", "==", email).limit(1).get();
  if (query.empty) return null;

  const doc = query.docs[0];
  return { docId: doc.id, data: doc.data() || {} };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const email = emailOf(body.email);
    const sessionToken = body.sessionToken;

    if (!isEmail(email)) {
      return NextResponse.json({ ok: false, error: "Informe um e-mail válido." }, { status: 400 });
    }
    if (!(await hasSession(email, sessionToken))) {
      return NextResponse.json({ ok: false, error: "Confirme o código da carteira antes de consultar o relatório." }, { status: 401 });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Usuário não encontrado." }, { status: 404 });
    }

    const month = currentMonthKey();
    const reportId = sha256(`${user.docId}:${month}:wallet-risk-report`);
    const reportSnap = await adminDb.collection(REPORT_COLLECTION).doc(reportId).get();
    const report = reportSnap.data() || {};
    const isVip = user.data.isVip === true;
    const credits = reportCredits(user.data);
    const automaticReportReady = reportSnap.exists
      && canReuseAutomaticReport(report, FII_RISK_REPORT_PROMPT_VERSION);
    const legacyManualReportAvailable = reportSnap.exists && isManualPlaceholderReport(report);

    return NextResponse.json({
      ok: true,
      email,
      month,
      isVip,
      credits,
      walletCount: walletCount(user.data),
      canGenerate: isVip || credits > 0,
      automaticEnabled: walletRiskReportAutomaticEnabled(),
      manualFallbackEnabled: walletRiskReportManualFallbackEnabled(),
      legacyManualReportAvailable,
      hasCurrentReport: automaticReportReady,
      currentReportStatus: automaticReportReady ? "done" : report.status || "none",
      reportId: automaticReportReady ? reportId : "",
      generationMode: automaticReportReady ? "automatic_openai" : "none",
      reportMarkdown: automaticReportReady ? String(report.reportMarkdown || "") : "",
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Erro ao consultar status do relatório." }, { status: 500 });
  }
}
