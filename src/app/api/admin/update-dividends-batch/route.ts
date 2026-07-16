import { NextRequest, NextResponse } from "next/server";
import admin, { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { DIVIDEND_MONTHS, mergeDividendYear, parseStatusInvestDividends, parseStatusInvestMarketIndicators } from "@/lib/market/StatusInvestParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTHS: string[] = [...DIVIDEND_MONTHS];

type FiiDoc = FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>;

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

function noAccent(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function authorized(req: NextRequest, body: any) {
  const allowedSecrets = [process.env.ADMIN_UPDATE_SECRET, process.env.CRON_SECRET].filter(Boolean);
  const headerSecret = req.headers.get("x-admin-secret");
  const bodySecret = body?.secret;
  return allowedSecrets.some((secret) => secret === headerSecret || secret === bodySecret);
}

async function getStatusInvestPage(ticker: string) {
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
    const normalized = noAccent(upperText);

    if (normalized.includes("OPS") && normalized.includes("NAO ENCONTRAMOS")) {
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

    return { text, url };
  }

  throw new Error(`Nenhuma página válida encontrada. ${ignored.join(" | ")}`);
}

async function updateOne(doc: FiiDoc, year: number) {
  const previous = doc.data() || {};
  const ticker = tickerOf(previous.code || doc.id);
  if (!ticker) throw new Error("Documento sem ticker no ID e sem campo code.");

  const page = await getStatusInvestPage(ticker);
  const fetched = parseStatusInvestDividends(page.text, year);
  const fetchedMonths = Object.keys(fetched).sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));

  if (!fetchedMonths.length) throw new Error(`Nenhum dividendo de ${year} encontrado no StatusInvest.`);

  const field = `earnings${year}`;
  const previousYear = previous[field] || {};
  const merged = mergeDividendYear(previousYear, fetched);
  const marketIndicators = parseStatusInvestMarketIndicators(page.text, page.url, new Date().toISOString());

  await adminDb.collection("Fiis_Backup").doc(ticker).set({
    ...previous,
    backup_date: adminFieldValue.serverTimestamp(),
    backup_reason: "batch-dividend-update",
  }, { merge: false });

  await doc.ref.set({
    [field]: merged,
    ...marketIndicators,
    modified_in: adminFieldValue.serverTimestamp(),
  }, { merge: true });

  return {
    ticker,
    documentId: doc.id,
    source: page.url,
    fetchedMonths,
  };
}

async function getBatch(limit: number, cursor?: string) {
  let query = adminDb
    .collection("Fiis")
    .orderBy(admin.firestore.FieldPath.documentId())
    .limit(limit);

  if (cursor) query = query.startAfter(cursor);

  const snapshot = await query.get();
  return snapshot.docs as FiiDoc[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!authorized(req, body)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const year = Number(body.year || new Date().getFullYear());
    const limit = Math.min(Math.max(Number(body.limit || 10), 1), 50);
    const cursor = body.cursor ? String(body.cursor) : undefined;
    const docs = await getBatch(limit, cursor);
    const results: any[] = [];

    for (const doc of docs) {
      const ticker = tickerOf((doc.data() || {}).code || doc.id);
      try {
        const result = await updateOne(doc, year);
        results.push({ ok: true, ...result });
      } catch (err: any) {
        results.push({ ok: false, ticker, documentId: doc.id, error: err.message });
      }
    }

    const nextCursor = docs.length ? docs[docs.length - 1].id : null;
    const hasMore = docs.length === limit;

    await adminDb.collection("Parameters").doc("dividendBatchUpdate").set({
      year,
      lastCursor: nextCursor,
      lastBatchAt: adminFieldValue.serverTimestamp(),
      lastProcessed: docs.length,
      updated: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      lastResults: results.slice(-100),
    }, { merge: true });

    return NextResponse.json({
      ok: true,
      year,
      processed: docs.length,
      updated: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      nextCursor,
      hasMore,
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro ao atualizar dividendos em lote." }, { status: 500 });
  }
}
