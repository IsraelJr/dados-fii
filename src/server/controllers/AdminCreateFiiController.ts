// Controlador de aplicação; o Route Handler permanece sem acesso à persistência.
import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { parseStatusInvestDividends, parseStatusInvestMarketIndicators } from "@/lib/market/StatusInvestParser";
import { internalAuthError, requireAdminOrCron } from "@/lib/security/InternalRequestAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tickerOf(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function textOf(value: unknown) {
  return String(value || "").trim();
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
    const earnings = parseStatusInvestDividends(text, year);
    const marketIndicators = parseStatusInvestMarketIndicators(text, item.url, new Date().toISOString());

    return {
      sourceUrl: item.url,
      assetType: item.type,
      name: extractTitle(html, ticker),
      cnpj,
      earningsYear: year,
      earnings,
      marketIndicators,
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
    const authorization = await requireAdminOrCron(req, { scope: "create-fii" });
    if (!authorization.ok) return internalAuthError(authorization);
    const body = await req.json();

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
      ...fetched.marketIndicators,
      statusInvestUrl: fetched.sourceUrl,
      assetType: fetched.assetType,
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
    return NextResponse.json({ error: "Erro ao criar fundo." }, { status: 500 });
  }
}
