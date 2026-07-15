import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { DIVIDEND_MONTHS, mergeDividendYear, parseStatusInvestDividends, parseStatusInvestMarketIndicators } from "@/lib/market/StatusInvestParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTHS: string[] = [...DIVIDEND_MONTHS];

function clean(html: string) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function tickerOf(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function normalizeNotFoundText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function getDoc(ticker: string) {
  const direct = await adminDb.collection("Fiis").doc(ticker).get();
  if (direct.exists) return direct;

  const byCode = await adminDb.collection("Fiis").where("code", "==", ticker).limit(1).get();
  if (!byCode.empty) return byCode.docs[0];

  throw new Error(`Ticker ${ticker} não encontrado.`);
}

async function getHtml(ticker: string) {
  const code = ticker.toLowerCase();
  const urls = [
    `https://statusinvest.com.br/fundos-imobiliarios/${code}`,
    `https://statusinvest.com.br/fiagros/${code}`,
    `https://statusinvest.com.br/fiinfras/${code}`,
  ];
  const ignored: string[] = [];

  for (const url of urls) {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
    });

    if (!res.ok) {
      ignored.push(`${url} HTTP ${res.status}`);
      continue;
    }

    const html = await res.text();
    const text = clean(html);
    const upperText = text.toUpperCase();
    const noAccent = normalizeNotFoundText(upperText);

    if (noAccent.includes("OPS") && noAccent.includes("NAO ENCONTRAMOS")) {
      ignored.push(`${url} não encontrado`);
      continue;
    }

    if (!upperText.includes(ticker)) {
      ignored.push(`${url} sem ticker`);
      continue;
    }

    if (!upperText.includes("TIPO DATA COM") && !upperText.includes("DIVIDENDOS DO")) {
      ignored.push(`${url} sem dividendos`);
      continue;
    }

    return { text, url, ignored };
  }

  throw new Error(`Nenhuma página válida encontrada. ${ignored.join(" | ")}`);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const expected = process.env.ADMIN_UPDATE_SECRET;
    if (!expected || body.secret !== expected) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const ticker = tickerOf(body.ticker);
    const year = Number(body.year || 2026);
    if (!ticker) return NextResponse.json({ error: "Ticker obrigatório" }, { status: 400 });

    const doc = await getDoc(ticker);
    const previous = doc.data() || {};
    const page = await getHtml(ticker);
    const fetched = parseStatusInvestDividends(page.text, year);
    const months = Object.keys(fetched).sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));

    if (!months.length) {
      return NextResponse.json({ error: "Nenhum dividendo encontrado", source: page.url, sample: page.text.slice(0, 1200) }, { status: 422 });
    }

    const field = `earnings${year}`;
    const previousYear = previous[field] || {};
    const merged = mergeDividendYear(previousYear, fetched);
    const marketIndicators = parseStatusInvestMarketIndicators(page.text, page.url, new Date().toISOString());
    const mergedMonths = Object.keys(merged).sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));

    await adminDb.collection("Fiis_Backup").doc(ticker).set({ ...previous, backup_date: adminFieldValue.serverTimestamp(), backup_reason: "update-one-dividend" }, { merge: false });

    await doc.ref.set({
      [field]: merged,
      ...marketIndicators,
      modified_in: adminFieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ ok: true, ticker, source: page.url, fetchedMonths: months, mergedMonths, ignored: page.ignored });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro" }, { status: 500 });
  }
}
