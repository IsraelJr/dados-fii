import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { getMarketBenchmarks } from "@/lib/marketBenchmarks";
import { buildPortfolioSnapshot, extractSnapshotWallet, saveMonthlyPortfolioSnapshot } from "@/lib/portfolioSnapshots";
import {
  buildFiiRiskReportUserPrompt,
  FII_RISK_REPORT_PROMPT_VERSION,
  FII_RISK_REPORT_SYSTEM_PROMPT,
  type RiskReportInput,
  type RiskReportPortfolioItem,
} from "@/lib/prompts/fiiRiskReport";

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

function currentDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function removeUndefinedFields<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => removeUndefinedFields(item)) as T;

  if (value && typeof value === "object" && !(value instanceof Date)) {
    if (typeof (value as any).isEqual === "function") return value;

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, fieldValue]) => fieldValue !== undefined)
        .map(([key, fieldValue]) => [key, removeUndefinedFields(fieldValue)])
    ) as T;
  }

  return value;
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
  if (direct.exists) return { ref: direct.ref, docId: direct.id, data: direct.data() || {} };

  const query = await users.where("email", "==", email).limit(1).get();
  if (!query.empty) {
    const doc = query.docs[0];
    return { ref: doc.ref, docId: doc.id, data: doc.data() || {} };
  }

  return null;
}

function toRiskPortfolio(snapshot: any): RiskReportPortfolioItem[] {
  const assets = Array.isArray(snapshot?.assets) ? snapshot.assets : [];
  return assets.map((asset: any) => removeUndefinedFields({
    ticker: asset.ticker,
    quantity: asset.quantity,
    averagePrice: asset.averagePrice,
    currentPrice: asset.currentPrice,
    investedValue: asset.investedValue,
    currentValue: asset.currentValue,
    weight: asset.weight,
    sector: asset.sector,
    segment: asset.segment,
    fundType: asset.fundType,
    manager: asset.manager,
    administrator: asset.administrator,
    dividendYield: asset.dividendYield,
    pvp: asset.pvp,
    extraData: {
      unrealizedResult: asset.unrealizedResult,
      unrealizedReturn: asset.unrealizedReturn,
    },
  }));
}

function buildManualPromptReport(input: RiskReportInput) {
  return `# Relatório de risco da carteira — modo manual

A geração automática está em modo manual. Copie o prompt abaixo, cole no ChatGPT e depois substitua este conteúdo pelo relatório final em \`reportMarkdown\`.

## Prompt completo para copiar

\`\`\`text
${FII_RISK_REPORT_SYSTEM_PROMPT}

${buildFiiRiskReportUserPrompt(input)}
\`\`\`
`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = emailOf(body?.email);
    const sessionToken = body?.sessionToken;

    if (!isEmail(email)) return NextResponse.json({ ok: false, error: "Informe um e-mail válido." }, { status: 400 });
    if (!(await hasSession(email, sessionToken))) {
      return NextResponse.json({ ok: false, error: "Confirme o código da carteira antes de gerar o prompt do relatório." }, { status: 401 });
    }

    const user = await findUserByEmail(email);
    if (!user) return NextResponse.json({ ok: false, error: "Usuário não encontrado." }, { status: 404 });

    const wallet = extractSnapshotWallet(user.data);
    if (!wallet.length) return NextResponse.json({ ok: false, error: "Carteira não encontrada para gerar o prompt." }, { status: 404 });

    const month = currentMonthKey();
    const reportId = sha256(`${user.docId}:${month}:wallet-risk-report`);
    const reportRef = adminDb.collection(REPORT_COLLECTION).doc(reportId);
    const current = await reportRef.get();
    const currentData = current.data() || {};

    if (current.exists && currentData.status === "done" && currentData.source === "manual_prompt") {
      return NextResponse.json({
        ok: true,
        mode: "cached",
        reportId,
        month,
        source: "manual_prompt",
        vip: user.data?.isVip === true,
        remainingCredits: Number(user.data?.riskReportCredits || 0),
        reportMarkdown: currentData.reportMarkdown || "",
      });
    }

    const [benchmarkData, snapshot] = await Promise.all([
      getMarketBenchmarks().catch((err) => ({ unavailable: true, error: err.message || "Benchmarks indisponíveis" })),
      buildPortfolioSnapshot(user.docId, email, wallet),
    ]);

    await saveMonthlyPortfolioSnapshot({ userDocId: user.docId, email, wallet }).catch((err) => {
      console.error("Risk report monthly snapshot error:", err);
    });

    const portfolio = toRiskPortfolio(snapshot);
    const reportInput: RiskReportInput = removeUndefinedFields({
      portfolio,
      totalValue: snapshot.totalValue,
      generatedAt: new Date().toISOString(),
      benchmarkData,
      clientProfile: {
        investorType: "PF",
        objective: user.data?.objective || user.data?.profile?.objective || "renda passiva com FIIs",
        horizon: user.data?.horizon || user.data?.profile?.horizon || "longo prazo",
        riskTolerance: user.data?.riskTolerance || user.data?.profile?.riskTolerance || "unknown",
        dependsOnDividends: Boolean(user.data?.dependsOnDividends || user.data?.profile?.dependsOnDividends),
        hasEmergencyReserve: Boolean(user.data?.hasEmergencyReserve || user.data?.profile?.hasEmergencyReserve),
        monthlyContribution: user.data?.monthlyContribution || user.data?.profile?.monthlyContribution || undefined,
      },
      dataSources: [
        "Carteira salva do usuário no Dados FII",
        "Base de FIIs do Dados FII",
        "Benchmarks de mercado em cache: IFIX, CDI, IPCA e Selic, quando disponíveis",
      ],
      limitations: [
        "A análise de performance fica mais precisa conforme o histórico mensal da carteira aumenta.",
        "Quando algum benchmark não estiver disponível no cache, o relatório deve informar dados insuficientes.",
      ],
    });

    const reportMarkdown = buildManualPromptReport(reportInput);

    await reportRef.set(removeUndefinedFields({
      status: "done",
      source: "manual_prompt",
      reportMarkdown,
      totalValue: snapshot.totalValue,
      portfolio,
      portfolioSnapshot: snapshot,
      benchmarkData,
      portfolioHash: sha256(JSON.stringify(wallet)),
      promptVersion: FII_RISK_REPORT_PROMPT_VERSION,
      model: "manual-prompt",
      userDocId: user.docId,
      email,
      authMode: "email-session",
      month,
      reportDate: currentDateKey(),
      finishedAt: adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
      createdAt: currentData.createdAt || adminFieldValue.serverTimestamp(),
    }), { merge: true });

    return NextResponse.json({
      ok: true,
      mode: "manual_prompt",
      reportId,
      month,
      source: "manual_prompt",
      vip: user.data?.isVip === true,
      remainingCredits: Number(user.data?.riskReportCredits || 0),
      reportMarkdown,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao gerar prompt manual do relatório." }, { status: err.status || 500 });
  }
}
