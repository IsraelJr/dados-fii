import { createHash } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { aiInsightsEngine } from "@/lib/ai/AIInsightsEngine";
import {
  buildFiiRiskReportMessages,
  FII_RISK_REPORT_PROMPT_VERSION,
} from "@/lib/prompts/fiiRiskReport";
import { regulatoryDataService } from "@/lib/regulatoryDataService";
import { isPremiumPreviewEmail } from "@/lib/premiumSecurity";
import {
  buildWalletRiskReportInput,
  removeUndefinedFields,
} from "@/lib/reports/WalletRiskReportInput";
import {
  buildRiskReportRepairInstruction,
  canReuseAutomaticReport,
  isManualPlaceholderReport,
  validateAutomaticRiskReportMarkdown,
  walletRiskReportAutomaticEnabled,
  WALLET_RISK_REPORT_AUTOMATIC_SOURCE,
} from "@/lib/reports/WalletRiskReportAutomationPolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPORT_COLLECTION = "UserRiskReports";
const SESSION_COLLECTION = "WalletSessions";
const USER_COLLECTION = "User";
const TIME_ZONE = "America/Sao_Paulo";
const PROCESSING_TIMEOUT_MS = 15 * 60 * 1000;

type LoadedUser = {
  ref: FirebaseFirestore.DocumentReference;
  docId: string;
  data: Record<string, unknown>;
  email: string;
  authMode: "email-session" | "anon-cookie";
};

function sha256(value: string) {
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
  const timestamp = value as { toDate?: () => Date };
  const date = typeof timestamp.toDate === "function" ? timestamp.toDate() : new Date(String(value));
  return Number.isNaN(date.getTime()) || date.getTime() < Date.now();
}

function timestampMs(value: unknown) {
  if (!value) return 0;
  const timestamp = value as { toDate?: () => Date };
  if (typeof timestamp.toDate === "function") return timestamp.toDate().getTime();
  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function currentMonthKey() {
  const parts = dateParts();
  return `${parts.year}-${parts.month}`;
}

function currentDateKey() {
  const parts = dateParts();
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function reportCredits(data: Record<string, unknown>) {
  const parsed = Number(data.riskReportCredits ?? data.reportCredits ?? data.walletRiskReportCredits ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

async function hasSession(email: string, token: unknown) {
  const sessionToken = String(token || "");
  if (!sessionToken) return false;

  const snap = await adminDb
    .collection(SESSION_COLLECTION)
    .doc(sha256(`${email}:${sessionToken}`))
    .get();
  if (!snap.exists) return false;

  const data = snap.data() || {};
  return data.email === email && !isExpired(data.expiresAt);
}

async function findUserByEmail(email: string): Promise<LoadedUser | null> {
  const users = adminDb.collection(USER_COLLECTION);
  const direct = await users.doc(email).get();
  if (direct.exists) {
    return {
      ref: direct.ref,
      docId: direct.id,
      data: direct.data() || {},
      email,
      authMode: "email-session",
    };
  }

  const query = await users.where("email", "==", email).limit(1).get();
  if (query.empty) return null;

  const doc = query.docs[0];
  return {
    ref: doc.ref,
    docId: doc.id,
    data: doc.data() || {},
    email,
    authMode: "email-session",
  };
}

async function findUserByAnonId(anonId: string): Promise<LoadedUser | null> {
  const snap = await adminDb.collection(USER_COLLECTION).doc(anonId).get();
  if (!snap.exists) return null;

  const data = snap.data() || {};
  return {
    ref: snap.ref,
    docId: snap.id,
    data,
    email: emailOf(data.email),
    authMode: "anon-cookie",
  };
}

async function loadUser(body: Record<string, unknown>): Promise<LoadedUser> {
  const email = emailOf(body.email);
  const sessionToken = body.sessionToken;

  if (isEmail(email) && sessionToken) {
    if (!(await hasSession(email, sessionToken))) {
      throw Object.assign(new Error("Confirme o código da carteira antes de gerar o relatório."), {
        status: 401,
        code: "WALLET_SESSION_REQUIRED",
      });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      throw Object.assign(new Error("Usuário não encontrado."), { status: 404, code: "USER_NOT_FOUND" });
    }
    return user;
  }

  const cookieStore = await cookies();
  const anonId = cookieStore.get("anonId")?.value;
  if (!anonId) {
    throw Object.assign(new Error("Usuário não identificado."), { status: 401, code: "USER_NOT_IDENTIFIED" });
  }

  const user = await findUserByAnonId(anonId);
  if (!user) {
    throw Object.assign(new Error("Usuário não encontrado."), { status: 404, code: "USER_NOT_FOUND" });
  }
  return user;
}

function publicGenerationError(error: { code?: string; message?: string }) {
  if (error.code === "OPENAI_INSUFFICIENT_QUOTA") {
    return "A geração automática está temporariamente sem créditos na OpenAI.";
  }
  if (error.code?.endsWith("API_KEY_MISSING")) {
    return "A geração automática ainda não está configurada no servidor.";
  }
  if (error.code === "OPENAI_RATE_LIMIT") {
    return "A OpenAI atingiu um limite temporário. Tente novamente mais tarde.";
  }
  if (error.code === "WALLET_RISK_REPORT_INVALID_OUTPUT") {
    return "A análise automática não atingiu o padrão mínimo de qualidade e não foi salva.";
  }
  return error.message || "Erro ao gerar relatório.";
}

async function reserveReport(args: {
  reportRef: FirebaseFirestore.DocumentReference;
  metadata: Record<string, unknown>;
  forceNew: boolean;
}) {
  await adminDb.runTransaction(async (transaction) => {
    const snap = await transaction.get(args.reportRef);
    const data = snap.data() || {};
    const updatedAtMs = timestampMs(data.updatedAt || data.createdAt);
    const stale = updatedAtMs > 0 && Date.now() - updatedAtMs > PROCESSING_TIMEOUT_MS;

    if (!args.forceNew && canReuseAutomaticReport(data, FII_RISK_REPORT_PROMPT_VERSION)) {
      throw Object.assign(new Error("REPORT_ALREADY_DONE"), {
        code: "REPORT_ALREADY_DONE",
        report: data,
      });
    }

    if (data.status === "processing" && !stale) {
      throw Object.assign(new Error("Relatório já está sendo gerado."), {
        status: 409,
        code: "REPORT_IN_PROGRESS",
      });
    }

    const manualPlaceholder = isManualPlaceholderReport(data);
    transaction.set(args.reportRef, removeUndefinedFields({
      ...args.metadata,
      status: "processing",
      source: WALLET_RISK_REPORT_AUTOMATIC_SOURCE,
      generationMode: "automatic_openai",
      promptVersion: FII_RISK_REPORT_PROMPT_VERSION,
      migratedFromManual: manualPlaceholder || undefined,
      legacyManualReport: manualPlaceholder
        ? {
            reportMarkdown: String(data.reportMarkdown || ""),
            promptVersion: data.promptVersion || null,
            model: data.model || "manual-prompt",
          }
        : undefined,
      createdAt: data.createdAt || adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
    }), { merge: true });
  });
}

async function generateValidatedReport(input: Parameters<typeof buildFiiRiskReportMessages>[0]) {
  const messages = buildFiiRiskReportMessages(input);
  const options = {
    purpose: "wallet-risk-report",
    promptVersion: FII_RISK_REPORT_PROMPT_VERSION,
    model: process.env.OPENAI_RISK_REPORT_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
    maxOutputTokens: Number(process.env.OPENAI_RISK_REPORT_MAX_OUTPUT_TOKENS || 9_000),
  };

  const first = await aiInsightsEngine.generateText({ ...options, input: messages });
  const firstValidation = validateAutomaticRiskReportMarkdown(first.text);
  if (firstValidation.ok) {
    return { generation: first, validation: firstValidation, repairAttempted: false };
  }

  const repairInstruction = buildRiskReportRepairInstruction(firstValidation);
  const second = await aiInsightsEngine.generateText({
    ...options,
    input: [...messages, { role: "user", content: repairInstruction }],
  });
  const secondValidation = validateAutomaticRiskReportMarkdown(second.text);
  if (!secondValidation.ok) {
    throw Object.assign(new Error("A IA não cumpriu o contrato estrutural do relatório."), {
      status: 502,
      code: "WALLET_RISK_REPORT_INVALID_OUTPUT",
      validation: secondValidation,
    });
  }

  return { generation: second, validation: secondValidation, repairAttempted: true };
}

export async function POST(req: Request) {
  let reportRef: FirebaseFirestore.DocumentReference | null = null;

  try {
    if (!walletRiskReportAutomaticEnabled()) {
      return NextResponse.json({
        ok: false,
        error: "A geração automática do relatório está desabilitada.",
        code: "WALLET_RISK_REPORT_AUTOMATIC_DISABLED",
      }, { status: 503 });
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const forceNew = Boolean(body.forceNew);
    const user = await loadUser(body);
    const vip = user.data.isVip === true || isPremiumPreviewEmail(user.email || user.data.email);
    const credits = reportCredits(user.data);

    if (!vip && credits <= 0) {
      return NextResponse.json({
        ok: false,
        error: "Relatório de risco disponível apenas para usuários VIP ou com crédito avulso.",
        access: { vip, credits },
      }, { status: 403 });
    }

    if (forceNew && credits <= 0) {
      return NextResponse.json({
        ok: false,
        error: "Você não possui crédito avulso para gerar outro relatório neste mês.",
      }, { status: 402 });
    }

    const month = currentMonthKey();
    const baseReportId = sha256(`${user.docId}:${month}:wallet-risk-report`);
    const reportId = forceNew
      ? sha256(`${user.docId}:${month}:extra:${Date.now()}`)
      : baseReportId;
    const billingSource = forceNew ? "paid_extra" : vip ? "monthly_vip" : "paid_extra";
    reportRef = adminDb.collection(REPORT_COLLECTION).doc(reportId);

    await reserveReport({
      reportRef,
      forceNew,
      metadata: {
        userDocId: user.docId,
        email: user.email || emailOf(user.data.email),
        authMode: user.authMode,
        month,
        reportDate: currentDateKey(),
        billingSource,
        forceNew,
      },
    });

    const built = await buildWalletRiskReportInput({
      userDocId: user.docId,
      email: user.email || emailOf(user.data.email),
      userData: user.data,
      fundLoader: async (ticker) => {
        const fund = await regulatoryDataService.getByTicker(ticker);
        return fund as unknown as Record<string, unknown> | null;
      },
    });
    const portfolioHash = sha256(JSON.stringify(built.wallet));
    const result = await generateValidatedReport(built.input);
    const reportMarkdown = result.generation.text.trim();

    await reportRef.set(removeUndefinedFields({
      status: "done",
      source: WALLET_RISK_REPORT_AUTOMATIC_SOURCE,
      generationMode: "automatic_openai",
      billingSource,
      reportMarkdown,
      totalValue: built.input.totalValue,
      portfolio: built.portfolio,
      portfolioSnapshot: built.snapshot,
      benchmarkData: built.benchmarkData,
      dataQualitySummary: built.dataQualitySummary,
      portfolioHash,
      promptVersion: FII_RISK_REPORT_PROMPT_VERSION,
      model: result.generation.metadata.model,
      aiEngineVersion: result.generation.metadata.engineVersion,
      aiFingerprint: result.generation.metadata.fingerprint,
      repairAttempted: result.repairAttempted,
      outputValidation: result.validation,
      finishedAt: adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
    }), { merge: true });

    if (billingSource === "paid_extra") {
      await user.ref.set({
        riskReportCredits: Math.max(credits - 1, 0),
        updatedAt: adminFieldValue.serverTimestamp(),
      }, { merge: true });
    }

    return NextResponse.json({
      ok: true,
      mode: "generated",
      generationMode: "automatic_openai",
      reportId,
      month,
      source: WALLET_RISK_REPORT_AUTOMATIC_SOURCE,
      billingSource,
      vip,
      remainingCredits: billingSource === "paid_extra" ? Math.max(credits - 1, 0) : credits,
      repairAttempted: result.repairAttempted,
      reportMarkdown,
    });
  } catch (error: unknown) {
    const err = error as {
      code?: string;
      status?: number;
      message?: string;
      report?: Record<string, unknown>;
      validation?: unknown;
    };

    if (err.code === "REPORT_ALREADY_DONE") {
      return NextResponse.json({
        ok: true,
        mode: "cached",
        generationMode: "automatic_openai",
        reportMarkdown: String(err.report?.reportMarkdown || ""),
        report: err.report,
      });
    }

    if (reportRef) {
      await reportRef.set(removeUndefinedFields({
        status: "error",
        source: WALLET_RISK_REPORT_AUTOMATIC_SOURCE,
        generationMode: "automatic_openai",
        error: publicGenerationError(err),
        errorCode: err.code || "UNKNOWN_ERROR",
        outputValidation: err.validation,
        updatedAt: adminFieldValue.serverTimestamp(),
        finishedAt: adminFieldValue.serverTimestamp(),
      }), { merge: true }).catch(() => undefined);
    }

    return NextResponse.json({
      ok: false,
      error: publicGenerationError(err),
      code: err.code || "UNKNOWN_ERROR",
    }, { status: err.status || 500 });
  }
}
