import admin from "firebase-admin";

// Inicializa o Firebase Admin apenas uma vez
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
const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;
const url = `${baseUrl}&t=${Date.now()}`;

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

async function getPriceFromSheet(ticker: string) {
  try {
    const res = await fetch(url);
    const data = await res.json();

    if (!data.values) return null;

    const [header, ...rows] = data.values;
    const match = rows.find((row: any) => row[0]?.toString().trim().toUpperCase() === ticker.toUpperCase());

    if (!match) return null;

    return match[1].toString().trim(); // retorna valor da Sheet, ex: "R$ 85,65"
  } catch (err) {
    console.error("Erro ao buscar preço da Sheet:", err);
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ticker = url.searchParams.get("ticker");

    if (ticker) {
      // Busca todos da Sheet e filtra o ticker solicitado
      const allFiis = await getAllPricesFromSheet();
      const match = allFiis.find(
        (fii: FiiData) => fii.code === ticker.toUpperCase()
      );

      if (!match) {
        return new Response(
          JSON.stringify({ error: "FII não encontrado" }),
          { status: 404 }
        );
      }

      // Junta com os dados do Firestore
      const querySnapshot = await db
        .collection("Fiis")
        .where("code", "==", ticker.toUpperCase())
        .limit(1)
        .get();

      const docData = querySnapshot.empty
        ? {}
        : normalizeDividendFields(querySnapshot.docs[0].data());

      return new Response(
        JSON.stringify({
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Pragma": "no-cache",
          },
          ...docData,
          ...match, // garante que sempre terá code, price, opening, variation, minimum, maximum
        }),
        { status: 200 }
      );
    } else {
      const allFiis = await getAllPricesFromSheet();
      return new Response(JSON.stringify(allFiis), { status: 200 });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

async function getAllPricesFromSheet() {
  try {
    const res = await fetch(url);
    const data = await res.json();

    if (!data.values) return [];

    const [header, ...rows] = data.values;

    return rows
      .filter(
        (row: any) =>
          row[0] && // ticker
          row[1] && row[1] !== "#N/A" && // preço válido
          row[2] && row[2] !== "#N/A" // abertura válida (garante ativo)
      )
      .map((row: any): FiiData => {
        const rawPrice = row[1].toString().trim();

        return {
          code: row[0].toString().trim().toUpperCase(),
          price: rawPrice,
          opening: row[2]?.toString().trim(),
          variation: `${row[3]
            ?.toString()
            .trim()
            .replace("R$", "")
            .replace(/\./g, "")
            .replace(",", ".")}%`,
          minimum: row[4]?.toString().trim() || "",
          maximum: row[5]?.toString().trim() || "",
        };
      });
  } catch (err) {
    console.error("Erro ao buscar todos os FIIs da Sheet:", err);
    return [];
  }
}
