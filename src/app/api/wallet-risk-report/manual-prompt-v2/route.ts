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

function hasValue(value: unknown) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return Boolean(value);
}

function percent(value: number, total: number) {
  return total ? Number(((value / total) * 100).toFixed(1)) : 0;
}

function buildPortfolioDataQuality(portfolio: RiskReportPortfolioItem[]) {
  const fields = [
    { key: "currentPrice", label: "preço atual", impact: "valuation e valor de mercado" },
    { key: "currentValue", label: "valor financeiro da posição", impact: "concentração por ativo e segmento" },
    { key: "segment", label: "segmento", impact: "concentração setorial" },
    { key: "fundType", label: "tipo de fundo", impact: "análise por crédito, agro, infraestrutura, tijolo ou FoF" },
    { key: "dailyLiquidity", label: "liquidez diária", impact: "risco de saída" },
    { key: "numberShares", label: "cotas emitidas", impact: "tamanho do fundo e liquidez estrutural" },
    { key: "numberShareholders", label: "cotistas", impact: "institucionalização e pulverização" },
    { key: "pvp", label: "P/VP", impact: "valuation e margem de segurança" },
    { key: "vpCota", label: "valor patrimonial por cota", impact: "valuation e prêmio/desconto" },
    { key: "netWorth", label: "patrimônio líquido", impact: "porte do fundo" },
    { key: "marketCap", label: "valor de mercado", impact: "porte em mercado" },
    { key: "dividendYield", label: "DY 12m informado", impact: "renda e comparação" },
    { key: "lastDividend", label: "último dividendo", impact: "renda recente" },
    { key: "averageDividend12m", label: "média de dividendos em 12 meses", impact: "sustentabilidade da renda" },
    { key: "monthsPaidLast12", label: "meses pagos em 12 meses", impact: "recorrência dos dividendos" },
    { key: "manager", label: "gestor", impact: "governança" },
    { key: "administrator", label: "administrador", impact: "estrutura operacional" },
  ];

  const fieldCoverage = fields.map((field) => {
    const present = portfolio.filter((asset) => hasValue((asset as any)[field.key])).length;
    return {
      field: field.label,
      present,
      missing: portfolio.length - present,
      coverage: percent(present, portfolio.length),
      impact: field.impact,
    };
  });

  const criticalFields = ["currentPrice", "currentValue", "segment", "fundType", "dailyLiquidity", "pvp", "vpCota", "dividendYield", "lastDividend", "averageDividend12m"];
  const criticalScore = percent(
    criticalFields.reduce((sum, key) => sum + portfolio.filter((asset) => hasValue((asset as any)[key])).length, 0),
    Math.max(portfolio.length * criticalFields.length, 1)
  );

  const missingByAsset = portfolio.map((asset) => {
    const missing = fields
      .filter((field) => !hasValue((asset as any)[field.key]))
      .map((field) => field.label);

    return {
      ticker: asset.ticker,
      missingCount: missing.length,
      missing: missing.slice(0, 8),
    };
  }).filter((asset) => asset.missingCount > 0)
    .sort((a, b) => b.missingCount - a.missingCount || a.ticker.localeCompare(b.ticker));

  return {
    totalAssets: portfolio.length,
    criticalCoverageScore: criticalScore,
    fieldCoverage,
    mainDataGaps: fieldCoverage
      .filter((field) => field.coverage < 70)
      .sort((a, b) => a.coverage - b.coverage),
    assetsWithMoreMissingData: missingByAsset.slice(0, 8),
    interpretation: criticalScore >= 75
      ? "Base suficiente para relatório de risco v1, com limitações pontuais."
      : criticalScore >= 55
        ? "Base utilizável para relatório de risco v1, mas as conclusões devem destacar limitações relevantes."
        : "Base ainda limitada; o relatório deve priorizar diagnóstico de qualidade dos dados antes de recomendações fortes.",
  };
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
    vpCota: asset.vpCota,
    netWorth: asset.netWorth,
    marketCap: asset.marketCap,
    lastDividend: asset.lastDividend,
    lastDividendDate: asset.lastDividendDate,
    averageDividend12m: asset.averageDividend12m,
    monthsPaidLast12: asset.monthsPaidLast12,
    dividendVolatility12m: asset.dividendVolatility12m,
    dividendCuts12m: asset.dividendCuts12m,
    dy6m: asset.dy6m,
    dy12mCalculated: asset.dy12mCalculated,
    liquidity: asset.dailyLiquidity,
    dailyLiquidity: asset.dailyLiquidity,
    numberShares: asset.numberShares,
    numberShareholders: asset.numberShareholders,
    isIFIX: asset.isIFIX,
    marketDataSource: asset.marketDataSource,
    marketDataUpdatedAt: asset.marketDataUpdatedAt,
    lastDividends: Array.isArray(asset.dividendsLast12Months) ? asset.dividendsLast12Months : undefined,
    extraData: {
      unrealizedResult: asset.unrealizedResult,
      unrealizedReturn: asset.unrealizedReturn,
      dailyLiquidity: asset.dailyLiquidity,
      numberShares: asset.numberShares,
      numberShareholders: asset.numberShareholders,
      marketCap: asset.marketCap,
      vpCota: asset.vpCota,
      netWorth: asset.netWorth,
      lastDividend: asset.lastDividend,
      lastDividendDate: asset.lastDividendDate,
      averageDividend12m: asset.averageDividend12m,
      monthsPaidLast12: asset.monthsPaidLast12,
      dividendVolatility12m: asset.dividendVolatility12m,
      dividendCuts12m: asset.dividendCuts12m,
      dy6m: asset.dy6m,
      dy12mCalculated: asset.dy12mCalculated,
      isIFIX: asset.isIFIX,
      marketDataSource: asset.marketDataSource,
      marketDataUpdatedAt: asset.marketDataUpdatedAt,
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
    const forceNew = Boolean(body?.forceNew);

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
    const canUseCachedPrompt = current.exists
      && currentData.status === "done"
      && currentData.source === "manual_prompt"
      && currentData.promptVersion === FII_RISK_REPORT_PROMPT_VERSION
      && currentData.benchmarkData
      && !forceNew;

    if (canUseCachedPrompt) {
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
      dataQualitySummary: buildPortfolioDataQuality(portfolio),
      clientProfile: {
        investorType: "PF",
        objective: user.data?.objective || user.data?.profile?.objective || "renda passiva com FIIs",
        horizon: user.data?.horizon || user.data?.profile?.horizon || "longo prazo",
        riskTolerance: user.data?.riskTolerance || user.data?.profile?.riskTolerance || "unknown",
        dependsOnDividends: user.data?.dependsOnDividends ?? user.data?.profile?.dependsOnDividends ?? undefined,
        hasEmergencyReserve: user.data?.hasEmergencyReserve ?? user.data?.profile?.hasEmergencyReserve ?? undefined,
        monthlyContribution: user.data?.monthlyContribution || user.data?.profile?.monthlyContribution || undefined,
      },
      dataSources: [
        "Carteira salva do usuário no Dados FII",
        "Base de FIIs do Dados FII enriquecida com indicadores derivados",
        "Benchmarks de mercado em cache: IFIX, CDI, IPCA e Selic, quando disponíveis",
      ],
      limitations: [
        "Esta é uma versão de teste do relatório, disponível para validação interna antes da liberação comercial.",
        "A análise de performance fica mais precisa conforme o histórico mensal da carteira aumenta.",
        "Quando algum benchmark não estiver disponível no cache, o relatório deve informar dados insuficientes.",
        "Dados avançados como gestor, administrador, cotistas, vacância, inquilinos, LTV, duration e inadimplência podem estar ausentes para alguns fundos e devem ser tratados como limitação da base.",
        "Para liquidez, cotas emitidas, valuation e dividendos, use os dados enviados por ativo antes de classificar a informação como insuficiente.",
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
      dataQualitySummary: reportInput.dataQualitySummary,
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
