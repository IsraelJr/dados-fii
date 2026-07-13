import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized, readAdminSession } from "@/lib/adminSession";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { validatePostPublication } from "@/lib/fiiPostPublicationValidation";
import { normalizeIngestionTicker } from "@/lib/fiiIngestionConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function trueValue(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true";
}

async function handle(req: NextRequest, body?: Record<string, any>) {
  if (!isAdminAuthorized(req, body)) return reply({ ok: false, error: "Não autorizado." }, 401);

  try {
    const runId = String(body?.runId || req.nextUrl.searchParams.get("runId") || "").trim();
    if (!runId) return reply({ ok: false, error: "Informe o runId." }, 400);

    const publicationRef = adminDb.collection("FiiIngestionPublications").doc(runId);
    const validationRef = adminDb.collection("FiiIngestionPostPublicationValidations").doc(runId);
    const runRef = adminDb.collection("FiiIngestionRuns").doc(runId);
    const publicationSnapshot = await publicationRef.get();
    if (!publicationSnapshot.exists) {
      return reply({ ok: false, error: "Publicação não encontrada para este runId." }, 404);
    }

    const publication = (publicationSnapshot.data() || {}) as Record<string, any>;
    const ticker = normalizeIngestionTicker(publication.ticker);
    if (!ticker) return reply({ ok: false, error: "Ticker inválido no registro de publicação." }, 400);

    const officialSnapshot = await adminDb.collection("Fiis").doc(ticker).get();
    const proposalHash = String(publication.proposalHash || "").trim().toLowerCase();
    const report = validatePostPublication({
      runId,
      ticker,
      proposalHash,
      publication,
      officialDocumentExists: officialSnapshot.exists,
      officialDocument: officialSnapshot.exists ? (officialSnapshot.data() || {}) as Record<string, any> : null,
    });

    const persist = trueValue(body?.persist ?? req.nextUrl.searchParams.get("persist"));
    if (persist) {
      const session = readAdminSession(req);
      await Promise.all([
        validationRef.set({
          ...report,
          validatedBy: session?.user || publication.publishedBy || "admin",
          validatedAt: adminFieldValue.serverTimestamp(),
        }, { merge: false }),
        publicationRef.set({
          postPublicationValidationStatus: report.status,
          postPublicationValidationScore: report.score,
          postPublicationValidationDocument: `FiiIngestionPostPublicationValidations/${runId}`,
          postPublicationValidatedAt: adminFieldValue.serverTimestamp(),
        }, { merge: true }),
        runRef.set({
          postPublicationValidationStatus: report.status,
          postPublicationValidationScore: report.score,
          postPublicationValidationDocument: `FiiIngestionPostPublicationValidations/${runId}`,
          updatedAt: adminFieldValue.serverTimestamp(),
        }, { merge: true }),
      ]);
    }

    return reply({ ok: true, persisted: persist, report });
  } catch (error: any) {
    return reply({ ok: false, error: error?.message || "Falha na validação pós-publicação." }, 500);
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, any>));
  return handle(req, body);
}
