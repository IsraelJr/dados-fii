import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/adminSession";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toIso(value: any) {
  if (!value) return null;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function serialize(doc: any) {
  const data = doc.data() || {};
  return {
    ...data,
    id: doc.id,
    requestedAt: toIso(data.requestedAt),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    finishedAt: toIso(data.finishedAt),
  };
}

async function readStatus(runId?: string) {
  if (runId) {
    const snap = await adminDb.collection("FiiIngestionRuns").doc(runId).get();
    if (!snap.exists) return null;
    return serialize(snap);
  }

  const snapshot = await adminDb
    .collection("FiiIngestionRuns")
    .orderBy("createdAt", "desc")
    .limit(30)
    .get();
  return snapshot.docs
    .map(serialize)
    .filter((run) => run.ticker === "TGAR11")
    .slice(0, 10);
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  try {
    const runId = String(req.nextUrl.searchParams.get("runId") || "").trim();
    const data = await readStatus(runId || undefined);
    if (runId && !data) {
      return NextResponse.json({ ok: false, error: "Execução não encontrada." }, { status: 404 });
    }
    return NextResponse.json(
      { ok: true, run: runId ? data : undefined, runs: runId ? undefined : data },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Erro ao consultar execução." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!isAdminAuthorized(req, body)) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  try {
    const runId = String(body?.runId || "").trim();
    const data = await readStatus(runId || undefined);
    if (runId && !data) {
      return NextResponse.json({ ok: false, error: "Execução não encontrada." }, { status: 404 });
    }
    return NextResponse.json(
      { ok: true, run: runId ? data : undefined, runs: runId ? undefined : data },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Erro ao consultar execução." },
      { status: 500 }
    );
  }
}
