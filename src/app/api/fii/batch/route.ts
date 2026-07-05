import admin from "firebase-admin";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)
    ),
  });
}

const db = admin.firestore();

const SHEET_ID = process.env.SHEET_ID!;
const API_KEY = process.env.GOOGLE_SHEETS_API_KEY!;
const RANGE = "A1:F400";

interface FiiData {
  code: string;
  price: string;
  opening?: string;
  variation?: string;
  minimum?: string;
  maximum?: string;
}

function parseCurrency(value: unknown) {
  if (typeof value === "number") return value;
  return Number(
    String(value || "0")
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()
  ) || 0;
}

function formatDividend(value: unknown) {
  const parsed = parseCurrency(value);
  if (!parsed) return value || "";
  return `R$ ${parsed.toFixed(3).replace(".", ",")}`;
}

function normalizeDividendFields(data: any) {
  const normalized = { ...(data || {}) };

  Object.keys(normalized).forEach((key) => {
    if (!/^earnings\d{4}$/.test(key) || !normalized[key] || typeof normalized[key] !== "object") return;

    normalized[key] = Object.fromEntries(
      Object.entries(normalized[key]).map(([month, info]: any) => [
        month,
        {
          ...info,
          earnings: formatDividend(info?.earnings),
        },
      ])
    );
  });

  return normalized;
}

function normalizeTicker(value: unknown) {
  const ticker = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9]{4,8}$/.test(ticker) ? ticker : "";
}

async function getAllPricesFromSheet(): Promise<FiiData[]> {
  try {
    const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}&t=${Date.now()}`;
    const res = await fetch(sheetUrl, { cache: "no-store" });
    const data = await res.json();

    if (!data.values) return [];

    const [, ...rows] = data.values;

    return rows
      .filter(
        (row: any) =>
          row[0] &&
          row[1] && row[1] !== "#N/A" &&
          row[2] && row[2] !== "#N/A"
      )
      .map((row: any): FiiData => ({
        code: row[0].toString().trim().toUpperCase(),
        price: row[1].toString().trim(),
        opening: row[2]?.toString().trim(),
        variation: `${row[3]
          ?.toString()
          .trim()
          .replace("R$", "")
          .replace(/\./g, "")
          .replace(",", ".")}%`,
        minimum: row[4]?.toString().trim() || "",
        maximum: row[5]?.toString().trim() || "",
      }));
  } catch (err) {
    console.error("Erro ao buscar preços da Sheet no batch:", err);
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const tickers = Array.isArray(body?.tickers)
      ? Array.from(new Set(body.tickers.map(normalizeTicker).filter(Boolean))).slice(0, 80)
      : [];

    if (!tickers.length) {
      return NextResponse.json({ ok: true, items: {}, errors: {} });
    }

    const allFiis = await getAllPricesFromSheet();
    const sheetByTicker = new Map<string, FiiData>(allFiis.map((fii: FiiData) => [fii.code, fii]));

    const docSnapshots = await Promise.all(
      tickers.map(async (ticker) => {
        const directDoc = await db.collection("Fiis").doc(ticker).get();
        if (directDoc.exists) return [ticker, normalizeDividendFields(directDoc.data())] as const;

        const querySnapshot = await db.collection("Fiis").where("code", "==", ticker).limit(1).get();
        return [ticker, querySnapshot.empty ? null : normalizeDividendFields(querySnapshot.docs[0].data())] as const;
      })
    );

    const firestoreByTicker = new Map(docSnapshots);
    const items: Record<string, any> = {};
    const errors: Record<string, string> = {};

    tickers.forEach((ticker) => {
      const match = sheetByTicker.get(ticker);
      const docData = firestoreByTicker.get(ticker);

      if (!match && !docData) {
        errors[ticker] = "FII não encontrado";
        return;
      }

      items[ticker] = {
        ...(docData || {}),
        ...(match || { code: ticker, price: "-", opening: "-", variation: "-", minimum: "-", maximum: "-" }),
      };
    });

    return NextResponse.json(
      {
        ok: true,
        requested: tickers.length,
        found: Object.keys(items).length,
        items,
        errors,
        updatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao buscar FIIs em lote." }, { status: 500 });
  }
}
