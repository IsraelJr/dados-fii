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

function parseLimit(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

function wantsTextDownload(req: NextRequest, body?: any) {
  const format = String(req.nextUrl.searchParams.get("format") || body?.format || "").toLowerCase();
  const download = String(req.nextUrl.searchParams.get("download") || body?.download || "").toLowerCase();
  return format === "txt" || format === "text" || download === "true" || download === "1";
}

function textDownloadResponse(filename: string, payload: unknown) {
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

async function getFiisSnapshot(limit?: number) {
  let query: any = adminDb.collection(COLLECTION);
  if (limit) query = query.limit(limit);
  return query.get();
}

async function runEnrichment(limit?: number, dryRun = false, resultLimit?: number) {
  const snapshot = await getFiisSnapshot(limit);
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
    limitApplied: limit || null,
    enriched,
    skipped,
    errors,
    dryRun,
    version: ENRICHMENT_VERSION,
    fieldCounts: sortedCounts(fieldCounts),
    results: resultLimit ? results.slice(0, resultLimit) : results,
  };
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });

    const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
    const dryRun = req.nextUrl.searchParams.get("dryRun") === "true";
    const asText = wantsTextDownload(req);
    const output = await runEnrichment(limit, dryRun, asText ? undefined : 120);
    const payload = { ok: true, ...output };

    if (asText) return textDownloadResponse(`enrich-fii-derived-data-${new Date().toISOString().slice(0, 10)}.txt`, payload);
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao enriquecer dados dos FIIs." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    if (!isAuthorized(req, body)) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });

    const limit = parseLimit(body?.limit);
    const dryRun = Boolean(body?.dryRun);
    const asText = wantsTextDownload(req, body);
    const output = await runEnrichment(limit, dryRun, asText ? undefined : 120);
    const payload = { ok: true, ...output };

    if (asText) return textDownloadResponse(`enrich-fii-derived-data-${new Date().toISOString().slice(0, 10)}.txt`, payload);
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao enriquecer dados dos FIIs." }, { status: 500 });
  }
}
