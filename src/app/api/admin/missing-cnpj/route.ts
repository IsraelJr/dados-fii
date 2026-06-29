import { NextRequest, NextResponse } from "next/server";
import admin, { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest, body: any) {
  const expected = process.env.ADMIN_UPDATE_SECRET || process.env.CRON_SECRET;
  return Boolean(expected && (req.headers.get("x-admin-secret") === expected || body?.secret === expected || req.nextUrl.searchParams.get("secret") === expected));
}

function hasValidCnpj(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 14;
}

function normalizeTicker(doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>) {
  const data = doc.data() || {};
  return String(data.code || doc.id || "").trim().toUpperCase();
}

async function listMissingCnpj(limit: number, cursor?: string) {
  let query = adminDb
    .collection("Fiis")
    .orderBy(admin.firestore.FieldPath.documentId())
    .limit(limit);

  if (cursor) query = query.startAfter(cursor);

  const snapshot = await query.get();
  const missing = snapshot.docs
    .filter((doc) => !hasValidCnpj(doc.data()?.cnpj))
    .map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        ticker: normalizeTicker(doc),
        name: data.name || data.socialReason || "",
        cnpj: data.cnpj || "",
      };
    })
    .sort((a, b) => a.ticker.localeCompare(b.ticker));

  const nextCursor = snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1].id : null;

  return {
    missing,
    processed: snapshot.docs.length,
    nextCursor,
    hasMore: snapshot.docs.length === limit,
  };
}

export async function GET(req: NextRequest) {
  try {
    if (!authorized(req, {})) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") || 500), 1), 1000);
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
    const result = await listMissingCnpj(limit, cursor);

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro ao listar FIIs sem CNPJ." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!authorized(req, body)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const limit = Math.min(Math.max(Number(body.limit || 500), 1), 1000);
    const cursor = body.cursor ? String(body.cursor) : undefined;
    const result = await listMissingCnpj(limit, cursor);

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro ao listar FIIs sem CNPJ." }, { status: 500 });
  }
}
