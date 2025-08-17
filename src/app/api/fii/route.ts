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
const RANGE = "A1:B400";

async function getPriceFromSheet(ticker: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;
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

    if (!ticker) {
      return new Response(JSON.stringify({ error: "Ticker é obrigatório" }), { status: 400 });
    }

    const querySnapshot = await db
      .collection("Fiis")
      .where("code", "==", ticker.toUpperCase())
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return new Response(JSON.stringify({ error: "FII não encontrado" }), { status: 404 });
    }

    const docData = querySnapshot.docs[0].data();

    const sheetPrice = await getPriceFromSheet(ticker);
    console.log("Preço da Sheet:", sheetPrice, "Preço Firebase:", docData.price);

    return new Response(
      JSON.stringify({
        ...docData,
        price: sheetPrice ? `R$ ${sheetPrice.replace("R$", "").trim()}` : docData.price,
      }),
      { status: 200 }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
