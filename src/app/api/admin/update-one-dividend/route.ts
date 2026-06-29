import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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

async function getDoc(ticker: string) {
  const direct = await adminDb.collection("Fiis").doc(ticker).get();
  if (direct.exists) return direct;

  const byCode = await adminDb.collection("Fiis").where("code", "==", ticker).limit(1).get();
  if (!byCode.empty) return byCode.docs[0];

  throw new Error(`Ticker ${ticker} não encontrado.`);
}

async function getHtml(ticker: string) {
  const paths = ["fundos-imobiliarios", "fiagros", "fiinfras"];
  const ignored: string[] = [];

  for (const group of paths) {
    const url = `https://statusinvest.com.br/${group}/${ticker.toLowerCase()}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
    });

    if (!res.ok) {
      ignored.push(`${url} HTTP ${res.status}`);
      continue;
    }

    const html = await res.text();
    const text = clean(html).toUpperCase();

    if (text.includes("OPS") && text.includes("NÃO ENCONTRAMOS")) {
      ignored.push(`${url} não encontrado`);
      continue;
    }

    if (!text.includes(ticker)) {
      ignored.push(`${url} sem ticker`);
      continue;
    }

    if (!text.includes("TIPO DATA COM") && !text.includes("DIVIDENDOS DO")) {
      ignored.push(`${url} sem dividendos`);
      continue;
    }

    return { html, text: clean(html), url, ignored };
  }

  throw new Error(`Nenhuma página válida encontrada. ${ignored.join(" | ")}`);
}

function parseDividends(text: string, year: number) {
  const output: Record<string, any> = {};
  const parts = text.split("Rendimento ").slice(1);

  for (const part of parts) {
    const tokens = part.trim().split(" ");
    const dateWith = tokens[0];
    const paymentDate = tokens[1];
    const value = tokens[2];

    if (!dateWith || !paymentDate || !value) continue;
    if (!paymentDate.includes(`/${year}`)) continue;

    const pieces = paymentDate.split("/");
    const month = Number(pieces[1]);
    const monthName = MONTHS[month - 1];
    if (!monthName) continue;

    output[monthName] = {
      payment_date: paymentDate,
      date_with: dateWith,
      earnings: value.startsWith("R$") ? value : `R$ ${value}`,
      price_date_with: "R$ 0,0",
    };
  }

  return output;
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
    const fetched = parseDividends(page.text, year);
    const months = Object.keys(fetched).sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));

    if (!months.length) {
      return NextResponse.json({ error: "Nenhum dividendo encontrado", source: page.url, sample: page.text.slice(0, 1200) }, { status: 422 });
    }

    const field = `earnings${year}`;
    const previousYear = previous[field] || {};
    const merged = { ...previousYear, ...fetched };
    const mergedMonths = Object.keys(merged).sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));

    await adminDb.collection("Fiis_Backup").doc(ticker).set({ ...previous, backup_date: adminFieldValue.serverTimestamp(), backup_reason: "update-one-dividend" }, { merge: false });

    await doc.ref.set({
      [`${field}_previousBackup`]: previousYear,
      [field]: merged,
      dividendsUpdatedAt: adminFieldValue.serverTimestamp(),
      dividendsUpdatedBy: "update-one-dividend",
      dividendsSource: "statusinvest-split-text",
      dividendsSourceUrl: page.url,
      dividendsFetchedMonths: months,
      dividendsMergedMonths: mergedMonths,
      modified_in: adminFieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ ok: true, ticker, source: page.url, fetchedMonths: months, mergedMonths });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro" }, { status: 500 });
  }
}
