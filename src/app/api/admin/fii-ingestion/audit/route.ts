import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/adminSession";
import { adminDb } from "@/lib/firebaseAdmin";

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

function clean(value: any): any {
  if (value === null || value === undefined) return value ?? null;
  if (Array.isArray(value)) return value.map(clean);
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clean(item)]));
  }
  return value;
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return reply({ ok: false, error: "Não autorizado." }, 401);

  try {
    const runId = String(req.nextUrl.searchParams.get("runId") || "").trim();
    if (!runId) return reply({ ok: false, error: "Informe o runId." }, 400);

    const collections = [
      ["run", "FiiIngestionRuns"],
      ["staging", "FiiIngestionStaging"],
      ["prePublication", "FiiIngestionPrePublication"],
      ["approval", "FiiIngestionApprovals"],
      ["backup", "FiiIngestionBackups"],
      ["publication", "FiiIngestionPublications"],
      ["postPublicationValidation", "FiiIngestionPostPublicationValidations"],
      ["rollback", "FiiIngestionRollbacks"],
    ] as const;

    const snapshots = await adminDb.getAll(
      ...collections.map(([, collection]) => adminDb.collection(collection).doc(runId))
    );
    const byKey = Object.fromEntries(collections.map(([key], index) => [key, snapshots[index]]));
    const runSnapshot = byKey.run;
    if (!runSnapshot.exists) return reply({ ok: false, error: "Execução não encontrada." }, 404);

    const stagingRef = adminDb.collection("FiiIngestionStaging").doc(runId);
    const [monthly, documents] = await Promise.all([
      stagingRef.collection("MonthlySnapshots").limit(1000).get(),
      stagingRef.collection("Documents").limit(1000).get(),
    ]);

    const records = Object.fromEntries(collections.map(([key, collection]) => {
      const snapshot = byKey[key];
      return [key, {
        collection,
        document: `${collection}/${runId}`,
        exists: snapshot.exists,
        data: snapshot.exists ? clean(snapshot.data() || {}) : null,
      }];
    }));

    const run = records.run.data || {};
    const timeline = [
      { step: "run", title: "Execução", exists: records.run.exists, status: run.status || null, at: run.requestedAt || run.createdAt || null },
      { step: "staging", title: "Staging", exists: records.staging.exists, status: records.staging.data?.status || run.currentStep || null, at: records.staging.data?.updatedAt || null },
      { step: "qa", title: "QA operacional", exists: Boolean(run.manualQa || records.staging.data?.manualQa), status: run.manualQa?.verdict || records.staging.data?.manualQa?.verdict || null, at: run.manualQa?.generatedAt || null },
      { step: "prePublication", title: "Pré-publicação", exists: records.prePublication.exists, status: records.prePublication.data?.status || null, at: records.prePublication.data?.generatedAt || null },
      { step: "approval", title: "Aprovação humana", exists: records.approval.exists, status: records.approval.data?.status || null, at: records.approval.data?.approvedAt || null },
      { step: "backup", title: "Backup", exists: records.backup.exists, status: records.backup.data?.status || null, at: records.backup.data?.createdAt || null },
      { step: "publication", title: "Publicação", exists: records.publication.exists, status: records.publication.data?.status || null, at: records.publication.data?.publishedAt || null },
      { step: "postPublicationValidation", title: "Validação pós-publicação", exists: records.postPublicationValidation.exists, status: records.postPublicationValidation.data?.verdict || null, at: records.postPublicationValidation.data?.generatedAt || null },
      { step: "rollback", title: "Rollback", exists: records.rollback.exists, status: records.rollback.data?.status || null, at: records.rollback.data?.rolledBackAt || null },
    ];

    return reply({
      ok: true,
      runId,
      ticker: run.ticker || records.prePublication.data?.ticker || null,
      counts: { monthlySnapshots: monthly.size, documents: documents.size },
      timeline,
      records,
      sourceEvidence: {
        monthly: monthly.docs.slice(0, 10).map((doc) => clean({ id: doc.id, ...(doc.data() || {}) })),
        documents: documents.docs.slice(0, 10).map((doc) => clean({ id: doc.id, ...(doc.data() || {}) })),
        samplesLimitedTo: 10,
      },
    });
  } catch (error: any) {
    return reply({ ok: false, error: error?.message || "Erro ao montar auditoria." }, 500);
  }
}
