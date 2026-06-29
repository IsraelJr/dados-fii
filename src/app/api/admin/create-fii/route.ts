import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const base = emptyLike(template);
    const now = adminFieldValue.serverTimestamp();

    const data = {
      ...base,
      code,
      name: textOf(body.name) || code,
      socialReason: textOf(body.socialReason) || textOf(body.name) || code,
      segment: textOf(body.segment),
      segment_new: textOf(body.segment_new || body.segmentNew || body.segment),
      cnpj: textOf(body.cnpj),
      created_in: now,
      modified_in: now,
      createdBy: "admin-create-fii",
    };

    await adminDb.collection("Fiis").doc(code).set(data, { merge: false });

    return NextResponse.json({
      success: true,
      ticker: code,
      collection: "Fiis",
      fields: Object.keys(data).sort(),
      totalFields: Object.keys(data).length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro ao criar fundo." }, { status: 500 });
  }
}
