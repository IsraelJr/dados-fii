import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import {
  buildFiiRiskReportMessages,
  FII_RISK_REPORT_PROMPT_VERSION,
  type RiskReportClientProfile,
  type RiskReportInput,
  type RiskReportPortfolioItem,
} from "@/lib/prompts/fiiRiskReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPORT_COLLECTION = "UserRiskReports";
const TIME_ZONE = "America/Sao_Paulo";
const MAX_WALLET_ITEMS = 80;
const PROCESSING_TIMEOUT_MS = 15 * 60 * 1000;
const SHEET_RANGE = "A1:F400";

type WalletItem = {
  ticker: string;
  quotas: number;
  averagePrice?: number;
};

type LoadedUser = {
  ref: any;
  docId: string;
  data: Record<string, any>;
  email: string;
  authMode: "email-session" | "anon-cookie";
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

function quotaOf(value: unknown) {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function numberOf(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const raw = String(value || "")
    .replace("R$", "")
    .replace("%", "")
    .trim();

  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isExpired(value: any) {
  if (!value) return true;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return !date || Number.isNaN(date.getTime()) || date.getTime() < Date.now();
}

function getTimestampMs(value: any) {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return new Date(value).getTime() || 0;
}

function saoPauloParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function currentMonthKey() {
  const parts = saoPauloParts();
  return `${parts.year}-${parts.month}`;
}

function currentDateKey() {
  const parts = saoPauloParts();
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function normalizeInvestorType(value: unknown): RiskReportClientProfile["investorType"] {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "PF" || raw === "PESSOA FÍSICA" || raw === "PESSOA FISICA") return "PF";
  if (raw === "PJ" || raw === "PESSOA JURÍDICA" || raw === "PESSOA JURIDICA") return "PJ";
  return "unknown";
}

function normalizeRiskTolerance(value: unknown): RiskReportClientProfile["riskTolerance"] {
  const raw = String(value || "").trim().toLowerCase();
  if (raw.includes("conserv")) return "conservador";
  if (raw.includes("moder")) return "moderado";
  if (raw.includes("agress") || raw.includes("arroj")) return "agressivo";
  return "unknown";
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

  return items
    .filter(validWalletItem)
    .slice(0, MAX_WALLET_ITEMS)
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
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

function hasVipAccess(data: Record<string, any>) {
  return data?.isVip === true;
}

function reportCredits(data: Record<string, any>) {
  const parsed = Number(data?.riskReportCredits ?? data?.reportCredits ?? data?.walletRiskReportCredits ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function portfolioHash(wallet: WalletItem[]) {
  const normalized = wallet
    .map((item) => ({ ticker: item.ticker, quotas: item.quotas, averagePrice: item.averagePrice || 0 }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));

  return sha256(JSON.stringify(normalized));
}

async function hasSession(email: string, token: unknown) {
  const sessionToken = String(token || "");
  if (!sessionToken) return false;

  const snap = await adminDb.collection("WalletSessions").doc(sha256(`${email}:${sessionToken}`)).get();
  if (!snap.exists) return false;

  const data = snap.data() || {};
  return data.email === email && !isExpired(data.expiresAt);
}

async function findUserByEmail(email: string): Promise<LoadedUser | null> {
  const users = adminDb.collection("User");
  const direct = await users.doc(email).get();
  if (direct.exists) {
    return { ref: direct.ref, docId: direct.id, data: direct.data() || {}, email, authMode: "email-session" };
  }

  const query = await users.where("email", "==", email).limit(1).get();
  if (!query.empty) {
    const doc = query.docs[0];
    return { ref: doc.ref, docId: doc.id, data: doc.data() || {}, email, authMode: "email-session" };
  }

  return null;
}

async function findUserByAnonId(anonId: string): Promise<LoadedUser | null> {
  const snap = await adminDb.collection("User").doc(anonId).get();
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

async function loadUser(body: any): Promise<LoadedUser> {
  const email = emailOf(body?.email);
  const sessionToken = body?.sessionToken;

  if (isEmail(email) && sessionToken) {
    if (!(await hasSession(email, sessionToken))) {
      throw Object.assign(new Error("Confirme o código da carteira antes de gerar o relatório."), { status: 401 });
    }

    const user = await findUserByEmail(email);
    if (!user) throw Object.assign(new Error("Usuário não encontrado."), { status: 404 });
    return user;
  }

  const cookieStore = await cookies();
  const anonId = cookieStore.get("anonId")?.value;
  if (!anonId) throw Object.assign(new Error("Usuário não identificado."), { status: 401 });

  const user = await findUserByAnonId(anonId);
  if (!user) throw Object.assign(new Error("Usuário não encontrado."), { status: 404 });
  return user;
}

async function getFiiDoc(ticker: string) {
  const direct = await adminDb.collection("Fiis").doc(ticker).get();
  if (direct.exists) return direct.data() || {};

  const query = await adminDb.collection("Fiis").where("code", "==", ticker).limit(1).get();
  return query.empty ? {} : query.docs[0].data() || {};
}

async function getSheetPrices() {
  const sheetId = process.env.SHEET_ID;
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  const prices = new Map<string, number>();

  if (!sheetId || !apiKey) return prices;

  try {
    const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_RANGE}?key=${apiKey}&t=${Date.now()}`;
    const res = await fetch(sheetUrl, { cache: "no-store" });
    const data = await res.json();
    const [, ...rows] = Array.isArray(data?.values) ? data.values : [];

    rows.forEach((row: any[]) => {
      const ticker = tickerOf(row?.[0]);
      const price = numberOf(row?.[1]);
      if (ticker && price > 0) prices.set(ticker, price);
    });
  } catch (err) {
    console.error("Risk report price sheet error:", err);
  }

  return prices;
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

async function buildPortfolioInput(wallet: WalletItem[]) {
  const sheetPrices = await getSheetPrices();

  const items = await Promise.all(wallet.map(async (walletItem) => {
    const data = await getFiiDoc(walletItem.ticker);
    const currentPrice = sheetPrices.get(walletItem.ticker) || numberOf(data?.price || data?.currentPrice || data?.cotacao);
    const currentValue = currentPrice > 0 ? currentPrice * walletItem.quotas : 0;
    const averagePrice = walletItem.averagePrice && walletItem.averagePrice > 0 ? walletItem.averagePrice : undefined;

    return {
      ticker: walletItem.ticker,
      quantity: walletItem.quotas,
      averagePrice,
      currentPrice: currentPrice || undefined,
      investedValue: averagePrice ? averagePrice * walletItem.quotas : undefined,
      currentValue: currentValue || undefined,
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

  const totalValue = items.reduce((sum, item) => sum + Number(item.currentValue || 0), 0);

  return {
    totalValue,
    portfolio: items.map((item) => ({
      ...item,
      weight: totalValue > 0 && item.currentValue ? Number(((item.currentValue / totalValue) * 100).toFixed(2)) : undefined,
    })),
  };
}

async function callOpenAI(messages: ReturnType<typeof buildFiiRiskReportMessages>) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada.");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_RISK_REPORT_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: messages,
      temperature: 0.2,
      max_output_tokens: Number(process.env.OPENAI_RISK_REPORT_MAX_OUTPUT_TOKENS || 9000),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("OpenAI risk report error:", response.status, detail);
    throw new Error("Não foi possível gerar o relatório agora.");
  }

  const payload = await response.json();
  if (typeof payload?.output_text === "string") return payload.output_text.trim();

  const texts = payload?.output
    ?.flatMap((item: any) => item?.content || [])
    ?.map((content: any) => content?.text)
    ?.filter(Boolean);

  return Array.isArray(texts) ? texts.join("\n").trim() : "";
}

async function reserveReport(reportRef: any, metadata: Record<string, any>) {
  await adminDb.runTransaction(async (transaction) => {
    const snap: any = await transaction.get(reportRef);
    const data = typeof snap?.data === "function" ? snap.data() || {} : {};
    const exists = Boolean(snap?.exists);
    const status = data.status;
    const updatedAtMs = getTimestampMs(data.updatedAt || data.createdAt);
    const isStale = updatedAtMs > 0 && Date.now() - updatedAtMs > PROCESSING_TIMEOUT_MS;

    if (exists && status === "done") {
      throw Object.assign(new Error("REPORT_ALREADY_DONE"), { code: "REPORT_ALREADY_DONE", report: data });
    }

    if (exists && status === "processing" && !isStale) {
      throw Object.assign(new Error("Relatório já está sendo gerado."), { status: 409 });
    }

    transaction.set(reportRef, {
      ...metadata,
      status: "processing",
      promptVersion: FII_RISK_REPORT_PROMPT_VERSION,
      createdAt: data.createdAt || adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

export async function POST(req: Request) {
  let reportRef: any = null;

  try {
    const body = await req.json().catch(() => ({}));
    const forceNew = Boolean(body?.forceNew);
    const user = await loadUser(body);
    const wallet = extractWallet(user.data);
    const vip = hasVipAccess(user.data);
    const credits = reportCredits(user.data);
    const month = currentMonthKey();

    if (!wallet.length) {
      return NextResponse.json({ ok: false, error: "Carteira não encontrada para gerar o relatório." }, { status: 404 });
    }

    if (!vip && credits <= 0) {
      return NextResponse.json({
        ok: false,
        error: "Relatório de risco disponível apenas para usuários VIP ou com crédito avulso.",
        access: { vip, credits },
      }, { status: 403 });
    }

    const walletHash = portfolioHash(wallet);
    const baseReportId = sha256(`${user.docId}:${month}:wallet-risk-report`);
    const reportId = forceNew ? sha256(`${user.docId}:${month}:extra:${Date.now()}`) : baseReportId;
    const source = forceNew ? "paid_extra" : vip ? "monthly_vip" : "paid_extra";

    if (forceNew && credits <= 0) {
      return NextResponse.json({ ok: false, error: "Você não possui crédito avulso para gerar outro relatório neste mês." }, { status: 402 });
    }

    reportRef = adminDb.collection(REPORT_COLLECTION).doc(reportId);

    await reserveReport(reportRef, {
      userDocId: user.docId,
      email: user.email || user.data.email || "",
      authMode: user.authMode,
      month,
      reportDate: currentDateKey(),
      portfolioHash: walletHash,
      source,
      forceNew,
    });

    const { totalValue, portfolio } = await buildPortfolioInput(wallet);
    const reportInput: RiskReportInput = {
      portfolio,
      totalValue,
      generatedAt: new Date().toISOString(),
      clientProfile: {
        investorType: normalizeInvestorType(user.data?.investorType || user.data?.profile?.investorType),
        objective: user.data?.objective || user.data?.profile?.objective || "renda passiva com FIIs",
        horizon: user.data?.horizon || user.data?.profile?.horizon || "longo prazo",
        riskTolerance: normalizeRiskTolerance(user.data?.riskTolerance || user.data?.profile?.riskTolerance),
        dependsOnDividends: Boolean(user.data?.dependsOnDividends || user.data?.profile?.dependsOnDividends),
        hasEmergencyReserve: Boolean(user.data?.hasEmergencyReserve || user.data?.profile?.hasEmergencyReserve),
        monthlyContribution: numberOf(user.data?.monthlyContribution || user.data?.profile?.monthlyContribution) || undefined,
        notes: user.data?.profileNotes || user.data?.profile?.notes || undefined,
      },
      dataSources: [
        "Carteira salva do usuário no Firestore",
        "Collection Fiis no Firestore",
        "Planilha de cotações configurada no Dados FII, quando disponível",
      ],
      limitations: [
        "A análise depende dos campos disponíveis na base do Dados FII.",
        "Informações como vacância, LTV, rating, duration, contratos, liquidez e gestor podem aparecer como dados insuficientes se não estiverem salvas na base.",
      ],
    };

    const messages = buildFiiRiskReportMessages(reportInput);
    const reportMarkdown = await callOpenAI(messages);

    if (!reportMarkdown) throw new Error("A IA retornou um relatório vazio.");

    await reportRef.set({
      status: "done",
      reportMarkdown,
      totalValue,
      portfolio,
      portfolioHash: walletHash,
      promptVersion: FII_RISK_REPORT_PROMPT_VERSION,
      model: process.env.OPENAI_RISK_REPORT_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
      finishedAt: adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
    }, { merge: true });

    if (source === "paid_extra") {
      await user.ref.set({
        riskReportCredits: Math.max(credits - 1, 0),
        updatedAt: adminFieldValue.serverTimestamp(),
      }, { merge: true });
    }

    return NextResponse.json({
      ok: true,
      mode: "generated",
      reportId,
      month,
      source,
      vip,
      remainingCredits: source === "paid_extra" ? Math.max(credits - 1, 0) : credits,
      reportMarkdown,
    });
  } catch (err: any) {
    if (err?.code === "REPORT_ALREADY_DONE") {
      return NextResponse.json({
        ok: true,
        mode: "cached",
        reportMarkdown: err.report?.reportMarkdown || "",
        report: err.report,
      });
    }

    if (reportRef) {
      await reportRef.set({
        status: "error",
        error: err.message || "Erro ao gerar relatório.",
        updatedAt: adminFieldValue.serverTimestamp(),
        finishedAt: adminFieldValue.serverTimestamp(),
      }, { merge: true }).catch(() => undefined);
    }

    return NextResponse.json({ ok: false, error: err.message || "Erro ao gerar relatório." }, { status: err.status || 500 });
  }
}
