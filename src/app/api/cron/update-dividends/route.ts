import { NextRequest, NextResponse } from "next/server";
import admin, { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const STATE_DOC = "dividendRoutineState";

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

function authorized(req: NextRequest) {
  const expected = process.env.CRON_SECRET || process.env.ADMIN_UPDATE_SECRET;
  const authorization = req.headers.get("authorization") || "";
  const querySecret = new URL(req.url).searchParams.get("secret") || "";

  return Boolean(expected && (
    authorization === `Bearer ${expected}` ||
    querySecret === expected
  ));
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

    const [, month] = paymentDate.match(/\d{2}\/(\d{2})\/\d{4}/) || [];
    const monthName = MONTHS[Number(month) - 1];
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

async function updateOne(doc: FiiDoc, year: number) {
  const previous = doc.data() || {};
  const ticker = tickerOf(previous.code || doc.id);
  if (!ticker) throw new Error("Documento sem ticker no ID e sem campo code.");

  const page = await getStatusInvestPage(ticker);
  const fetched = parseDividends(page.text, year);
  const fetchedMonths = Object.keys(fetched).sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));

  if (!fetchedMonths.length) throw new Error(`Nenhum dividendo de ${year} encontrado no StatusInvest.`);

  const field = `earnings${year}`;
  const previousYear = previous[field] || {};
  const merged = { ...previousYear, ...fetched };

  await adminDb.collection("Fiis_Backup").doc(ticker).set({
    ...previous,
    backup_date: adminFieldValue.serverTimestamp(),
    backup_reason: "scheduled-dividend-update",
  }, { merge: false });

  await doc.ref.set({
    [field]: merged,
    modified_in: adminFieldValue.serverTimestamp(),
  }, { merge: true });

  return { ticker, documentId: doc.id, source: page.url, fetchedMonths };
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

export async function GET(req: NextRequest) {
  try {
    if (!authorized(req)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const url = new URL(req.url);
    const year = Number(url.searchParams.get("year") || new Date().getFullYear());
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 10), 1), 30);
    const stateRef = adminDb.collection("Parameters").doc(STATE_DOC);
    const stateSnap = await stateRef.get();
    const state = stateSnap.data() || {};
    const cursor = typeof state.cursor === "string" && state.cursor ? state.cursor : undefined;
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
    const cursorToSave = hasMore ? nextCursor : null;

    await stateRef.set({
      year,
      cursor: cursorToSave,
      lastCursor: nextCursor,
      completedCycleAt: hasMore ? state.completedCycleAt || null : adminFieldValue.serverTimestamp(),
      lastRunAt: adminFieldValue.serverTimestamp(),
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
      previousCursor: cursor || null,
      nextCursor: cursorToSave,
      hasMore,
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro na rotina de dividendos." }, { status: 500 });
  }
}
