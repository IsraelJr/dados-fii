import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function tickerOf(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function textOf(value: unknown) {
  return String(value || "").trim();
}

function isAdminAuthorized(req: NextRequest, body: any) {
  const expected = process.env.ADMIN_UPDATE_SECRET || process.env.CRON_SECRET;
  if (!expected) return false;

  const fromHeader = req.headers.get("x-admin-secret") || "";
  const fromBody = String(body?.secret || "");
  return fromHeader === expected || fromBody === expected;
}

function emptyLike(value: any): any {
  if (Array.isArray(value)) return [];
  if (value === null || value === undefined) return null;

  if (typeof value === "string") return "";
  if (typeof value === "number") return 0;
  if (typeof value === "boolean") return false;

  if (typeof value === "object") {
    if (typeof value.toDate === "function") return null;

    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => {
        if (key.toLowerCase().startsWith("earnings")) return [key, {}];
        return [key, emptyLike(child)];
      })
    );
  }

  return null;
}

function clean(html: string) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function noAccent(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function currentYear() {
  return new Date().getFullYear();
}

function extractTitle(html: string, ticker: string) {
  const raw = html.match(/<title>(.*?)<\/title>/i)?.[1] || "";
  const title = clean(raw)
    .replace(/Status Invest/i, "")
    .replace(new RegExp(ticker, "i"), "")
    .replace(/[|\-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return title || ticker;
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

async function getStatusInvestData(ticker: string) {
  const code = ticker.toLowerCase();
  const urls = [
    { url: `https://statusinvest.com.br/fundos-imobiliarios/${code}`, type: "fii" },
    { url: `https://statusinvest.com.br/fiagros/${code}`, type: "fiagro" },
    { url: `https://statusinvest.com.br/fiinfras/${code}`, type: "fiinfra" },
  ];
  const ignored: string[] = [];

  for (const item of urls) {
    const res = await fetch(item.url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
    });

    if (!res.ok) {
      ignored.push(`${item.url} HTTP ${res.status}`);
      continue;
    }

    const html = await res.text();
    const text = clean(html);
    const upperText = text.toUpperCase();
    const normalized = noAccent(upperText);

    if (normalized.includes("OPS") && normalized.includes("NAO ENCONTRAMOS")) {
      ignored.push(`${item.url} não encontrado`);
      continue;
    }

    if (!upperText.includes(ticker)) {
      ignored.push(`${item.url} sem ticker`);
      continue;
    }

    const cnpj = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/)?.[0] || "";
    const year = currentYear();
    const earnings = parseDividends(text, year);

    return {
      sourceUrl: item.url,
      assetType: item.type,
      name: extractTitle(html, ticker),
      cnpj,
      earningsYear: year,
      earnings,
    };
  }

  throw new Error(`Não consegui encontrar dados do ${ticker} no StatusInvest. ${ignored.join(" | ")}`);
}

async function getTemplateData(modelTicker?: string) {
  const model = tickerOf(modelTicker);

  if (model) {
    const direct = await adminDb.collection("Fiis").doc(model).get();
    if (direct.exists) return direct.data() || {};

    const byCode = await adminDb.collection("Fiis").where("code", "==", model).limit(1).get();
    if (!byCode.empty) return byCode.docs[0].data() || {};
  }

  const snapshot = await adminDb.collection("Fiis").limit(1).get();
  if (snapshot.empty) return {};
  return snapshot.docs[0].data() || {};
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!isAdminAuthorized(req, body)) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const code = tickerOf(body.ticker);
    if (!code || !/^[A-Z0-9]{4,8}$/.test(code)) {
      return NextResponse.json({ error: "Ticker inválido." }, { status: 400 });
    }

    const direct = await adminDb.collection("Fiis").doc(code).get();
    const byCode = await adminDb.collection("Fiis").where("code", "==", code).limit(1).get();

    if (direct.exists || !byCode.empty) {
      return NextResponse.json({ error: `${code} já existe na coleção Fiis.` }, { status: 409 });
    }

    const template = await getTemplateData(body.modelTicker || "TGAR11");
    const fetched = await getStatusInvestData(code);
    const base = emptyLike(template);
    const now = adminFieldValue.serverTimestamp();
    const field = `earnings${fetched.earningsYear}`;

    const data = {
      ...base,
      code,
      name: textOf(body.name) || fetched.name || code,
      socialReason: textOf(body.socialReason) || fetched.name || code,
      segment: textOf(body.segment) || fetched.assetType,
      segment_new: textOf(body.segment_new || body.segmentNew || body.segment) || fetched.assetType,
      cnpj: textOf(body.cnpj) || fetched.cnpj,
      [field]: fetched.earnings,
      statusInvestUrl: fetched.sourceUrl,
      assetType: fetched.assetType,
      dividendsSource: "StatusInvest",
      dividendsUpdatedBy: "admin-create-fii",
      created_in: now,
      modified_in: now,
      createdBy: "admin-create-fii",
    };

    await adminDb.collection("Fiis").doc(code).set(data, { merge: false });

    return NextResponse.json({
      success: true,
      ticker: code,
      collection: "Fiis",
      sourceUrl: fetched.sourceUrl,
      earningsYear: fetched.earningsYear,
      earningsMonths: Object.keys(fetched.earnings),
      fields: Object.keys(data).sort(),
      totalFields: Object.keys(data).length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro ao criar fundo." }, { status: 500 });
  }
}
