// Controlador de aplicação; o Route Handler permanece sem acesso à persistência.
import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { deriveFiiRiskData } from "@/lib/fiiDerivedData";
import { internalAuthError, requireAdminOrCron } from "@/lib/security/InternalRequestAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION = "Fiis";
const ENRICHMENT_VERSION = "derived-risk-v2";

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

function wantsTextOutput(req: NextRequest, body?: any) {
  const format = String(req.nextUrl.searchParams.get("format") || body?.format || "").toLowerCase();
  const download = String(req.nextUrl.searchParams.get("download") || body?.download || "").toLowerCase();
  return format === "txt" || format === "text" || download === "true" || download === "1";
}

function wantsAttachment(req: NextRequest, body?: any) {
  const attachment = String(req.nextUrl.searchParams.get("attachment") || body?.attachment || "").toLowerCase();
  return attachment === "true" || attachment === "1";
}

function textOutputResponse(filename: string, payload: unknown, attachment = false) {
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `${attachment ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
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
      results.push({ ticker: doc.id, status: "error", error: "erro" });
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
    const authorization = await requireAdminOrCron(req, { scope: "enrich-fii-derived-data" });
    if (!authorization.ok) return internalAuthError(authorization);

    const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
    const dryRun = req.nextUrl.searchParams.get("dryRun") === "true";
    const asText = wantsTextOutput(req);
    const output = await runEnrichment(limit, dryRun, asText ? undefined : 120);
    const payload = { ok: true, ...output };

    if (asText) return textOutputResponse(`enrich-fii-derived-data-${new Date().toISOString().slice(0, 10)}.txt`, payload, wantsAttachment(req));
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "Erro ao enriquecer dados dos FIIs." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authorization = await requireAdminOrCron(req, { scope: "enrich-fii-derived-data" });
    if (!authorization.ok) return internalAuthError(authorization);
    const body = await req.json().catch(() => ({}));

    const limit = parseLimit(body?.limit);
    const dryRun = Boolean(body?.dryRun);
    const asText = wantsTextOutput(req, body);
    const output = await runEnrichment(limit, dryRun, asText ? undefined : 120);
    const payload = { ok: true, ...output };

    if (asText) return textOutputResponse(`enrich-fii-derived-data-${new Date().toISOString().slice(0, 10)}.txt`, payload, wantsAttachment(req, body));
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "Erro ao enriquecer dados dos FIIs." }, { status: 500 });
  }
}
