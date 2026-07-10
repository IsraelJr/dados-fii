import admin from "firebase-admin";
import { adminDb } from "@/lib/firebaseAdmin";

export type WalletPosition = {
  ticker: string;
  quotas: number;
};

export type WalletSnapshotPosition = WalletPosition & {
  price: number;
  positionValue: number;
  dividendPerShare: number;
  estimatedDividend: number;
  segment?: string;
  priceSource?: string;
  dividendSource?: string;
};

export type WalletSnapshot = {
  monthKey: string;
  year: string;
  month: string;
  label: string;
  closedAt: string;
  source: "monthly_job" | "manual_admin";
  walletCount: number;
  totalQuotas: number;
  totalValue: number;
  estimatedDividendIncome: number;
  positions: WalletSnapshotPosition[];
  topWeightTicker?: string;
  topIncomeTicker?: string;
  createdAt: FirebaseFirestore.FieldValue;
  updatedAt: FirebaseFirestore.FieldValue;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTHS_SHORT_PTBR: Record<string, string> = {
  January: "Jan",
  February: "Fev",
  March: "Mar",
  April: "Abr",
  May: "Mai",
  June: "Jun",
  July: "Jul",
  August: "Ago",
  September: "Set",
  October: "Out",
  November: "Nov",
  December: "Dez",
};

export function normalizeTicker(value: unknown) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function parseCurrency(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value || "0").replace("R$", "").replace(/\s/g, "").trim();
  if (!text) return 0;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeWallet(rawWallet: unknown): WalletPosition[] {
  if (!Array.isArray(rawWallet)) return [];

  const byTicker = new Map<string, number>();

  rawWallet.forEach((item: any) => {
    let ticker = normalizeTicker(item?.ticker || item?.code || item?.fiiCode);
    let quotas = Number(item?.quotas ?? item?.quantity ?? item?.qtd ?? 0);

    if (!ticker && item && typeof item === "object" && !Array.isArray(item)) {
      const [legacyTicker, legacyQuotas] = Object.entries(item)[0] || [];
      ticker = normalizeTicker(legacyTicker);
      quotas = Number(legacyQuotas || 0);
    }

    if (!ticker || !Number.isFinite(quotas) || quotas <= 0) return;
    byTicker.set(ticker, quotas);
  });

  return Array.from(byTicker.entries())
    .map(([ticker, quotas]) => ({ ticker, quotas }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export function getPreviousMonthKey(baseDate = new Date()) {
  const date = new Date(baseDate);
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function parseMonthKey(monthKey: string) {
  const [year, rawMonth] = String(monthKey || "").split("-");
  const monthIndex = Number(rawMonth) - 1;
  const month = MONTHS[monthIndex] || MONTHS[new Date().getMonth()];
  return {
    year: /^\d{4}$/.test(year) ? year : String(new Date().getFullYear()),
    month,
    label: `${MONTHS_SHORT_PTBR[month] || rawMonth}/${String(year || "").slice(-2)}`,
  };
}

export async function getAllPricesFromSheet(): Promise<Map<string, any>> {
  const sheetId = process.env.SHEET_ID;
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!sheetId || !apiKey) return new Map<string, any>();

  try {
    const range = "A1:F400";
    const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}&t=${Date.now()}`;
    const response = await fetch(sheetUrl, { cache: "no-store" });
    const data = await response.json();
    const rows = Array.isArray(data?.values) ? data.values.slice(1) : [];

    const entries: Array<[string, any]> = rows
      .filter((row: any[]) => row?.[0])
      .map((row: any[]): [string, any] => [
        normalizeTicker(row[0]),
        {
          code: normalizeTicker(row[0]),
          price: row[1]?.toString().trim() || "",
          opening: row[2]?.toString().trim() || "",
          variation: row[3]?.toString().trim() || "",
          minimum: row[4]?.toString().trim() || "",
          maximum: row[5]?.toString().trim() || "",
        },
      ])
      .filter((entry: [string, any]) => Boolean(entry[0]));

    return new Map<string, any>(entries);
  } catch (error) {
    console.error("Erro ao carregar preços para snapshots:", error);
    return new Map<string, any>();
  }
}

export async function getFiiDocumentByTicker(ticker: string) {
  const normalized = normalizeTicker(ticker);
  if (!normalized) return null;

  const directDoc = await adminDb.collection("Fiis").doc(normalized).get();
  if (directDoc.exists) return directDoc.data() || null;

  const query = await adminDb.collection("Fiis").where("code", "==", normalized).limit(1).get();
  return query.empty ? null : query.docs[0].data();
}

export async function buildWalletSnapshot(options: {
  wallet: WalletPosition[];
  monthKey: string;
  pricesByTicker?: Map<string, any>;
  source?: "monthly_job" | "manual_admin";
}) {
  const wallet = normalizeWallet(options.wallet);
  const pricesByTicker = options.pricesByTicker || await getAllPricesFromSheet();
  const { year, month, label } = parseMonthKey(options.monthKey);
  const positions: WalletSnapshotPosition[] = [];

  for (const item of wallet) {
    const ticker = normalizeTicker(item.ticker);
    const priceData = pricesByTicker.get(ticker);
    const fiiData = await getFiiDocumentByTicker(ticker);
    const price = parseCurrency(priceData?.price);
    const dividendPerShare = parseCurrency(fiiData?.[`earnings${year}`]?.[month]?.earnings);
    const positionValue = price * item.quotas;
    const estimatedDividend = dividendPerShare * item.quotas;

    positions.push({
      ticker,
      quotas: item.quotas,
      price,
      positionValue,
      dividendPerShare,
      estimatedDividend,
      segment: fiiData?.segment_new || fiiData?.segment || "Sem segmento",
      priceSource: priceData ? "Planilha de cotações Dados FII" : "Preço indisponível",
      dividendSource: fiiData ? "Base interna Dados FII" : "Dividendo indisponível",
    });
  }

  const totalValue = positions.reduce((acc, item) => acc + item.positionValue, 0);
  const estimatedDividendIncome = positions.reduce((acc, item) => acc + item.estimatedDividend, 0);
  const totalQuotas = positions.reduce((acc, item) => acc + item.quotas, 0);
  const topWeightTicker = [...positions].sort((a, b) => b.positionValue - a.positionValue)[0]?.ticker;
  const topIncomeTicker = [...positions].sort((a, b) => b.estimatedDividend - a.estimatedDividend)[0]?.ticker;

  return {
    monthKey: options.monthKey,
    year,
    month,
    label,
    closedAt: new Date().toISOString(),
    source: options.source || "monthly_job",
    walletCount: wallet.length,
    totalQuotas,
    totalValue,
    estimatedDividendIncome,
    positions,
    topWeightTicker,
    topIncomeTicker,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  } satisfies WalletSnapshot;
}
