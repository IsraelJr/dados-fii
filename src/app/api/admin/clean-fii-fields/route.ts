import { NextRequest, NextResponse } from "next/server";
import admin, { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELDS_TO_DELETE = [
  "dividendsCurrentMonthIncluded",
  "dividendsFetchedMonths",
  "dividendsMergedMonths",
  "dividendsSource",
  "dividendsSourceErrors",
  "dividendsSourceMonths",
  "dividendsSourceUrl",
  "dividendsUpdatedBy",
  "earnings2026_previousBackup",
  "dividendsUpdatedAt",
  "cnpjUpdatedAt",
  "cnpjSource",
];

function authorized(req: NextRequest, body: any) {
  const expected = process.env.ADMIN_UPDATE_SECRET;
  return Boolean(expected && (req.headers.get("x-admin-secret") === expected || body?.secret === expected));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!authorized(req, body)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const limit = Math.min(Math.max(Number(body.limit || 50), 1), 200);
    const cursor = body.cursor ? String(body.cursor) : undefined;

    let query = adminDb
      .collection("Fiis")
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(limit);

    if (cursor) query = query.startAfter(cursor);

    const snapshot = await query.get();
    const batch = adminDb.batch();

    snapshot.docs.forEach((doc) => {
      const update = Object.fromEntries(
        FIELDS_TO_DELETE.map((field) => [field, adminFieldValue.delete()])
      );
      batch.set(doc.ref, update, { merge: true });
    });

    if (!snapshot.empty) await batch.commit();

    const nextCursor = snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1].id : null;
    const hasMore = snapshot.docs.length === limit;

    await adminDb.collection("Parameters").doc("fiiTechnicalFieldsCleanup").set({
      lastCursor: nextCursor,
      lastBatchAt: adminFieldValue.serverTimestamp(),
      lastProcessed: snapshot.docs.length,
      fieldsDeleted: FIELDS_TO_DELETE,
    }, { merge: true });

    return NextResponse.json({
      ok: true,
      processed: snapshot.docs.length,
      nextCursor,
      hasMore,
      fieldsDeleted: FIELDS_TO_DELETE,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro ao limpar campos." }, { status: 500 });
  }
}
