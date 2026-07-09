import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { deriveFiiRiskData } from "@/lib/fiiDerivedData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION = "Fiis";
const ENRICHMENT_VERSION = "derived-risk-v1";

function allowedSecrets() {
  return [process.env.ADMIN_UPDATE_SECRET, process.env.CRON_SECRET].filter(Boolean);
}

function isAuthorized(req: NextRequest, body?: any) {
  const secrets = allowedSecrets();
  if (!secrets.length) return false;

  const authHeader = req.headers.get("authorization") || "";
  const headerSecret = req.headers.get("x-admin-secret") || authHeader.replace(/^Bearer\s+/i, "");
  const querySecret = req.nextUrl.searchParams.get("secret");
  const bodySecret = body?.secret;

  return [headerSecret, querySecret, bodySecret].some((value) => Boolean(value && secrets.includes(value)));
}

function hasObjectData(value: unknown) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value as Record<string, unknown>).length);
}

function increment(map: Map<string, number>, field: string) {
  map.set(field, (map.get(field) || 0) + 1);
}

function countDerivedFields(value: any, prefix = "", output = new Map<string, number>(), depth = 0) {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 4) return output;

  Object.entries(value).forEach(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    increment(output, path);
    countDerivedFields(child, path, output, depth + 1);
  });

  return output;
}

function sortedCounts(map: Map<string, number>) {
  return Array.from(map.entries())
    .map(([field, count]) => ({ field, count }))
    .sort((a, b) => b.count - a.count || a.field.localeCompare(b.field));
}

async function runEnrichment(limit: number, dryRun = false) {
  const snapshot = await adminDb.collection(COLLECTION).limit(limit).get();
  const results: Array<{ ticker: string; status: string; updatedFields?: string[]; error?: string }> = [];
  const fieldCounts = new Map<string, number>();
  let enriched = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data() || {};
      const ticker = String(data.code || data.ticker || data.symbol || doc.id || "").trim().toUpperCase();
      const derived = deriveFiiRiskData(data);

      if (!hasObjectData(derived)) {
        skipped += 1;
        results.push({ ticker, status: "skipped" });
        continue;
      }

      countDerivedFields(derived, "", fieldCounts);
      const updatedFields = Object.keys(derived);

      if (!dryRun) {
        await doc.ref.set({
          ...derived,
          riskDataVersion: ENRICHMENT_VERSION,
          riskDataDerivedAt: adminFieldValue.serverTimestamp(),
          modified_in: adminFieldValue.serverTimestamp(),
        }, { merge: true });
      }

      enriched += 1;
      results.push({ ticker, status: dryRun ? "would_update" : "updated", updatedFields });
    } catch (err: any) {
      errors += 1;
      results.push({ ticker: doc.id, status: "error", error: err.message || "erro" });
    }
  }

  return {
    total: snapshot.docs.length,
    enriched,
    skipped,
    errors,
    dryRun,
    version: ENRICHMENT_VERSION,
    fieldCounts: sortedCounts(fieldCounts),
    results: results.slice(0, 120),
  };
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });

    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 1000), 3000);
    const dryRun = req.nextUrl.searchParams.get("dryRun") === "true";
    const output = await runEnrichment(limit, dryRun);

    return NextResponse.json({ ok: true, ...output });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao enriquecer dados dos FIIs." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    if (!isAuthorized(req, body)) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });

    const limit = Math.min(Number(body?.limit || 1000), 3000);
    const dryRun = Boolean(body?.dryRun);
    const output = await runEnrichment(limit, dryRun);

    return NextResponse.json({ ok: true, ...output });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao enriquecer dados dos FIIs." }, { status: 500 });
  }
}
