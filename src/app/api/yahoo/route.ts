// import { NextRequest, NextResponse } from "next/server";

// export async function GET(req: NextRequest) {
//     try {
//         const { searchParams } = new URL(req.url);
//         const ticker = searchParams.get("ticker");

//         if (!ticker) {
//             return NextResponse.json({ error: "Ticker is required" }, { status: 400 });
//         }

//         // Aqui você faria a chamada para o Yahoo Finance
//         const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.SA?interval=1m`;
//         const response = await fetch(url);
//         const data = await response.json();

//         const lastPrice = data?.chart?.result?.[0]?.meta?.regularMarketPrice || null;

//         return NextResponse.json({ ticker, price: lastPrice }, { status: 200 });
//     } catch (err) {
//         return NextResponse.json({ error: "Internal Server Error Yahoo data", err }, { status: 500 });
//     }
// }
