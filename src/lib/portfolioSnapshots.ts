import { createHash } from "crypto";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

const TIME_ZONE = "America/Sao_Paulo";
const SHEET_RANGE = "A1:F400";
const COLLECTION = "UserPortfolioSnapshots";

type WalletItem = {
  ticker: string;
  quotas: number;
  averagePrice?: number;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function tickerOf(value: unknown) {
  return String(value || "").trim().toUpperCase();
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

function dateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function dateKey(date = new Date()) {
  const parts = dateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function monthKey(date = new Date()) {
  const parts = dateParts(date);
  return `${parts.year}-${parts.month}`;
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
    .filter((item) => /^[A-Z0-9]{4,8}$/.test(item.ticker) && Number.isFinite(item.quotas) && item.quotas > 0)
    .slice(0, 120)
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export function extractSnapshotWallet(data: any): WalletItem[] {
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
    console.error("Portfolio snapshot price sheet error:", err);
  }

  return prices;
}

async function getFiiDoc(ticker: string) {
  const direct = await adminDb.collection("Fiis").doc(ticker).get();
  if (direct.exists) return direct.data() || {};

  const query = await adminDb.collection("Fiis").where("code", "==", ticker).limit(1).get();
  return query.empty ? {} : query.docs[0].data() || {};
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

export async function buildPortfolioSnapshot(userDocId: string, email: string, wallet: WalletItem[]) {
  const sheetPrices = await getSheetPrices();
  const assets = await Promise.all(wallet.map(async (item) => {
    const data = await getFiiDoc(item.ticker);
    const currentPrice = sheetPrices.get(item.ticker) || numberOf(data?.price || data?.currentPrice || data?.cotacao);
    const averagePrice = item.averagePrice && item.averagePrice > 0 ? item.averagePrice : undefined;
    const currentValue = currentPrice > 0 ? currentPrice * item.quotas : undefined;
    const investedValue = averagePrice ? averagePrice * item.quotas : undefined;

    return removeUndefinedFields({
      ticker: item.ticker,
      quantity: item.quotas,
      averagePrice,
      currentPrice: currentPrice || undefined,
      investedValue,
      currentValue,
      unrealizedResult: investedValue && currentValue ? Number((currentValue - investedValue).toFixed(2)) : undefined,
      unrealizedReturn: investedValue && currentValue ? Number((((currentValue / investedValue) - 1) * 100).toFixed(2)) : undefined,
      sector: String(data?.sector || data?.setor || "").trim() || undefined,
      segment: String(data?.segment_new || data?.segment || data?.segmento || "").trim() || undefined,
      fundType: String(data?.fundType || data?.type || data?.tipo || "").trim() || undefined,
      manager: String(data?.manager || data?.gestor || data?.management || "").trim() || undefined,
      administrator: String(data?.administrator || data?.administrador || "").trim() || undefined,
      dividendYield: numberOf(data?.dividendYield || data?.dy || data?.DY || data?.dy12m) || undefined,
      pvp: numberOf(data?.pvp || data?.p_vp || data?.pvpa || data?.priceToBook) || undefined,
    });
  }));

  const totalValue = assets.reduce((sum, asset: any) => sum + Number(asset.currentValue || 0), 0);
  const investedValue = assets.reduce((sum, asset: any) => sum + Number(asset.investedValue || 0), 0);
  const bySegment = new Map<string, number>();
  const byAsset = new Map<string, number>();

  assets.forEach((asset: any) => {
    const value = Number(asset.currentValue || 0);
    if (!value) return;
    bySegment.set(asset.segment || asset.sector || "Sem segmento", (bySegment.get(asset.segment || asset.sector || "Sem segmento") || 0) + value);
    byAsset.set(asset.ticker, value);
  });

  const segmentAllocation = Array.from(bySegment.entries()).map(([segment, value]) => ({
    segment,
    value: Number(value.toFixed(2)),
    weight: totalValue > 0 ? Number(((value / totalValue) * 100).toFixed(2)) : 0,
  })).sort((a, b) => b.weight - a.weight);

  const assetAllocation = Array.from(byAsset.entries()).map(([ticker, value]) => ({
    ticker,
    value: Number(value.toFixed(2)),
    weight: totalValue > 0 ? Number(((value / totalValue) * 100).toFixed(2)) : 0,
  })).sort((a, b) => b.weight - a.weight);

  const cleanSnapshot = removeUndefinedFields({
    userDocId,
    email,
    date: dateKey(),
    month: monthKey(),
    cadence: "monthly",
    totalValue: Number(totalValue.toFixed(2)),
    investedValue: investedValue ? Number(investedValue.toFixed(2)) : undefined,
    unrealizedResult: investedValue && totalValue ? Number((totalValue - investedValue).toFixed(2)) : undefined,
    unrealizedReturn: investedValue && totalValue ? Number((((totalValue / investedValue) - 1) * 100).toFixed(2)) : undefined,
    assetCount: assets.length,
    assets: assets.map((asset: any) => ({
      ...asset,
      weight: totalValue > 0 && asset.currentValue ? Number(((asset.currentValue / totalValue) * 100).toFixed(2)) : undefined,
    })),
    allocation: {
      bySegment: segmentAllocation,
      byAsset: assetAllocation,
    },
  });

  return {
    ...cleanSnapshot,
    createdAt: adminFieldValue.serverTimestamp(),
    updatedAt: adminFieldValue.serverTimestamp(),
  };
}

export async function saveMonthlyPortfolioSnapshot(args: { userDocId: string; email: string; wallet: unknown; force?: boolean }) {
  const wallet = walletFrom(args.wallet);
  if (!wallet.length) return { saved: false, reason: "empty_wallet" };

  const month = monthKey();
  const id = sha256(`${args.userDocId}:${month}:monthly-portfolio-snapshot`);
  const ref = adminDb.collection(COLLECTION).doc(id);

  if (!args.force) {
    const current = await ref.get();
    if (current.exists) return { saved: false, reason: "already_exists", snapshotId: id };
  }

  const snapshot = await buildPortfolioSnapshot(args.userDocId, args.email, wallet);
  await ref.set(snapshot, { merge: true });

  return { saved: true, snapshotId: id, month, totalValue: snapshot.totalValue, assetCount: snapshot.assetCount };
}
