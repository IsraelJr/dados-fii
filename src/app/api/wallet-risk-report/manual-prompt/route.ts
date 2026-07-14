import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { regulatoryDataService } from "@/lib/regulatoryDataService";
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
const MAX_WALLET_ITEMS = 80;

type WalletItem = {
  ticker: string;
  quotas: number;
  averagePrice?: number;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function emailOf(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function tickerOf(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function removeUndefinedFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => removeUndefinedFields(item)) as T;
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, fieldValue]) => fieldValue !== undefined)
        .map(([key, fieldValue]) => [key, removeUndefinedFields(fieldValue)])
    ) as T;
  }

  return value;
}

function numberOf(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value || "").replace("R$", "").replace("%", "").trim();
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function quotaOf(value: unknown) {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
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

function parseWalletEntry(value: any): WalletItem {
  if (typeof value === "string") return { ticker: tickerOf(value), quotas: 1 };

  const directTicker = tickerOf(value?.ticker || value?.code || value?.fii || value?.symbol);
  if (directTicker) {
    return {
      ticker: directTicker,
      quotas: quotaOf(value?.quotas ?? value?.quantity ?? value?.qtd ?? value?.shares ?? value?.cotas),
      averagePrice: numberOf(value?.averagePrice ?? value?.avgPrice ?? value?.precoMedio ?? value?.pm),
    };
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value);
    if (entries.length === 1) {
      const [ticker, quotas] = entries[0];
      return { ticker: tickerOf(ticker), quotas: quotaOf(quotas) };
    }
  }

  return { ticker: "", quotas: 0 };
}

function validWalletItem(item: WalletItem) {
  return /^[A-Z0-9]{4,8}$/.test(item.ticker) && Number.isFinite(item.quotas) && item.quotas > 0;
}

function walletFrom(value: unknown): WalletItem[] {
  const items = Array.isArray(value)
    ? value.map(parseWalletEntry)
    : value && typeof value === "object"
      ? Object.entries(value as Record<string, any>).map(([key, item]) => ({
        ticker: tickerOf((item as any)?.ticker || (item as any)?.code || (item as any)?.fii || (item as any)?.symbol || key),
        quotas: quotaOf((item as any)?.quotas ?? (item as any)?.quantity ?? (item as any)?.qtd ?? (item as any)?.shares ?? (item as any)?.cotas ?? item),
        averagePrice: numberOf((item as any)?.averagePrice ?? (item as any)?.avgPrice ?? (item as any)?.precoMedio ?? (item as any)?.pm),
      }))
      : [];

  return items.filter(validWalletItem).slice(0, MAX_WALLET_ITEMS).sort((a, b) => a.ticker.localeCompare(b.ticker));
}

function extractWallet(data: any): WalletItem[] {
  const candidates = [
    data?.wallet,
    data?.wallet?.items,
    data?.carteira,
    data?.carteira?.items,
    data?.carteira?.fiis,
    data?.fiis,
    data?.funds,
    data?.portfolio,
    data?.portfolio?.items,
    data?.portfolio?.fiis,
    data?.monitored?.fiis,
    data?.monitoredFiis,
    data?.selectedFiis,
    data?.favorites,
  ];

  for (const candidate of candidates) {
    const wallet = walletFrom(candidate);
    if (wallet.length) return wallet;
  }

  return [];
}

function portfolioHash(wallet: WalletItem[]) {
  return sha256(JSON.stringify(wallet.map((item) => ({
    ticker: item.ticker,
    quotas: item.quotas,
    averagePrice: item.averagePrice || 0,
  }))));
}

function dividendEntriesFrom(data: Record<string, any>) {
  const years = Object.keys(data || {})
    .filter((key) => /^earnings\d{4}$/.test(key))
    .sort()
    .reverse()
    .slice(0, 2);

  return years.flatMap((yearKey) => {
    const year = yearKey.replace("earnings", "");
    const values = data?.[yearKey] && typeof data[yearKey] === "object" ? data[yearKey] : {};

    return Object.entries(values).map(([month, info]: any) => ({
      month: `${month}/${year}`,
      value: numberOf(info?.earnings),
      paymentDate: String(info?.payment_date || info?.paymentDate || ""),
    }));
  }).filter((item) => item.value > 0).slice(0, 24);
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

async function getFiiDoc(ticker: string): Promise<Record<string, any>> {
  return await regulatoryDataService.getByTicker(ticker) || {};
}

async function buildPortfolioInput(wallet: WalletItem[]) {
  const portfolio = await Promise.all(wallet.map(async (walletItem) => {
    const data = await getFiiDoc(walletItem.ticker);
    const currentPrice = numberOf(data?.price || data?.currentPrice || data?.cotacao);
    const averagePrice = walletItem.averagePrice && walletItem.averagePrice > 0 ? walletItem.averagePrice : undefined;
    const currentValue = currentPrice > 0 ? currentPrice * walletItem.quotas : undefined;

    return {
      ticker: walletItem.ticker,
      quantity: walletItem.quotas,
      averagePrice,
      currentPrice: currentPrice || undefined,
      investedValue: averagePrice ? averagePrice * walletItem.quotas : undefined,
      currentValue,
      sector: String(data?.sector || data?.setor || "").trim() || undefined,
      segment: String(data?.segment_new || data?.segment || data?.segmento || "").trim() || undefined,
      fundType: String(data?.fundType || data?.type || data?.tipo || "").trim() || undefined,
      manager: String(data?.manager || data?.gestor || data?.management || "").trim() || undefined,
      administrator: String(data?.administrator || data?.administrador || "").trim() || undefined,
      dividendYield: numberOf(data?.dividendYield || data?.dy || data?.DY || data?.dy12m) || undefined,
      pvp: numberOf(data?.pvp || data?.p_vp || data?.pvpa || data?.priceToBook) || undefined,
      liquidity: numberOf(data?.liquidity || data?.liquidez || data?.avgLiquidity) || undefined,
      lastDividends: dividendEntriesFrom(data),
      extraData: {
        socialReason: data?.socialReason || data?.razaoSocial || data?.name || undefined,
        isIFIX: data?.isIFIX ?? undefined,
        active: data?.active ?? undefined,
        variation: data?.variation || undefined,
      },
    } satisfies RiskReportPortfolioItem;
  }));

  const totalValue = portfolio.reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
  return {
    totalValue,
    portfolio: portfolio.map((item) => ({
      ...item,
      weight: totalValue > 0 && item.currentValue ? Number(((item.currentValue / totalValue) * 100).toFixed(2)) : undefined,
    })),
  };
}

function normalizeInvestorType(value: unknown) {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "PF" || raw === "PESSOA FÍSICA" || raw === "PESSOA FISICA") return "PF";
  if (raw === "PJ" || raw === "PESSOA JURÍDICA" || raw === "PESSOA JURIDICA") return "PJ";
  return "unknown";
}

function normalizeRiskTolerance(value: unknown) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw.includes("conserv")) return "conservador";
  if (raw.includes("moder")) return "moderado";
  if (raw.includes("agress") || raw.includes("arroj")) return "agressivo";
  return "unknown";
}

function buildManualPromptReport(input: RiskReportInput) {
  return `# Relatório de risco da carteira — modo manual

A geração automática está em modo manual. Copie o prompt abaixo, cole no ChatGPT e depois salve o relatório final no campo \`reportMarkdown\` deste documento em \`UserRiskReports\`.

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

    const wallet = extractWallet(user.data);
    if (!wallet.length) return NextResponse.json({ ok: false, error: "Carteira não encontrada para gerar o prompt." }, { status: 404 });

    const month = currentMonthKey();
    const walletHash = portfolioHash(wallet);
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

    const { totalValue, portfolio } = await buildPortfolioInput(wallet);
    const cleanPortfolio = removeUndefinedFields(portfolio);
    const reportInput: RiskReportInput = removeUndefinedFields({
      portfolio: cleanPortfolio,
      totalValue,
      generatedAt: new Date().toISOString(),
      clientProfile: {
        investorType: normalizeInvestorType(user.data?.investorType || user.data?.profile?.investorType) as any,
        objective: user.data?.objective || user.data?.profile?.objective || "renda passiva com FIIs",
        horizon: user.data?.horizon || user.data?.profile?.horizon || "longo prazo",
        riskTolerance: normalizeRiskTolerance(user.data?.riskTolerance || user.data?.profile?.riskTolerance) as any,
        dependsOnDividends: Boolean(user.data?.dependsOnDividends || user.data?.profile?.dependsOnDividends),
        hasEmergencyReserve: Boolean(user.data?.hasEmergencyReserve || user.data?.profile?.hasEmergencyReserve),
        monthlyContribution: numberOf(user.data?.monthlyContribution || user.data?.profile?.monthlyContribution) || undefined,
        notes: user.data?.profileNotes || user.data?.profile?.notes || undefined,
      },
      dataSources: [
        "Carteira salva do usuário no Firestore",
        "Collection Fiis no Firestore",
        "Dados disponíveis na base do Dados FII",
      ],
      limitations: [
        "Este documento contém o prompt para geração manual do relatório.",
        "Após gerar o relatório no ChatGPT, substitua o conteúdo deste campo reportMarkdown pelo relatório final.",
      ],
    });

    const reportMarkdown = buildManualPromptReport(reportInput);

    await reportRef.set(removeUndefinedFields({
      status: "done",
      source: "manual_prompt",
      reportMarkdown,
      totalValue,
      portfolio: cleanPortfolio,
      portfolioHash: walletHash,
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
