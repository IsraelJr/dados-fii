import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized, readAdminSession } from "@/lib/adminSession";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { stableRegulatoryJson } from "@/lib/fiiPrePublication";
import { normalizeIngestionTicker } from "@/lib/fiiIngestionConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function sha256(value: unknown) {
  return createHash("sha256").update(stableRegulatoryJson(value)).digest("hex");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, any>));
  if (!isAdminAuthorized(req, body)) return reply({ ok: false, error: "Não autorizado." }, 401);

  try {
    const runId = String(body?.runId || "").trim();
    const confirmationText = String(body?.confirmationText || "").trim().toUpperCase();
    if (!runId) return reply({ ok: false, error: "Informe o runId." }, 400);

    const prePublicationRef = adminDb.collection("FiiIngestionPrePublication").doc(runId);
    const approvalRef = adminDb.collection("FiiIngestionApprovals").doc(runId);
    const backupRef = adminDb.collection("FiiIngestionBackups").doc(runId);
    const runRef = adminDb.collection("FiiIngestionRuns").doc(runId);
    const session = readAdminSession(req);

    const result = await adminDb.runTransaction(async (transaction) => {
      const prePublicationSnapshot = await transaction.get(prePublicationRef);
      if (!prePublicationSnapshot.exists) throw new Error("Pacote de pré-publicação não encontrado.");

      const prePublication = (prePublicationSnapshot.data() || {}) as Record<string, any>;
      const ticker = normalizeIngestionTicker(prePublication.ticker);
      const expectedConfirmation = `APROVAR ${ticker}`;
      if (!ticker || confirmationText !== expectedConfirmation) throw new Error(`Digite exatamente: ${expectedConfirmation}`);
      if (prePublication.canProceedToHumanReview !== true) throw new Error("O pacote não está liberado para revisão humana.");
      if (prePublication.canPublishToOfficialBase !== false) throw new Error("O bloqueio de publicação não pôde ser comprovado.");
      if (prePublication.safeguards?.qaScore !== 100
        || prePublication.safeguards?.qaVerdict !== "approved_for_human_review") {
        throw new Error("O pacote não possui QA 100 aprovado.");
      }

      const officialRef = adminDb.collection("Fiis").doc(ticker);
      const [officialSnapshot, approvalSnapshot, backupSnapshot] = await Promise.all([
        transaction.get(officialRef), transaction.get(approvalRef), transaction.get(backupRef),
      ]);
      const proposal = prePublication.proposedRegulatoryData;
      const proposalHash = sha256(proposal);
      const officialData = (officialSnapshot.data() || {}) as Record<string, any>;
      const currentDocumentHash = sha256(officialSnapshot.exists ? officialData : null);

      if (approvalSnapshot.exists) {
        const approval = (approvalSnapshot.data() || {}) as Record<string, any>;
        if (approval.proposalHash !== proposalHash) throw new Error("Já existe aprovação para outra versão deste pacote.");
        if (!backupSnapshot.exists) {
          throw new Error("A aprovação existe, mas o backup imutável está ausente. Publicação bloqueada; revisão manual necessária.");
        }
        const backup = (backupSnapshot.data() || {}) as Record<string, any>;
        if (backup.proposalHash !== proposalHash || backup.status !== "immutable_backup_pending_publication") {
          throw new Error("A aprovação e o backup existente não formam um estado íntegro para publicação.");
        }
        if (String(backup.originalDocumentHash || "") !== currentDocumentHash) {
          throw new Error("A aprovação permanece registrada, mas a base oficial mudou após o backup. Gere novo pacote.");
        }
        return { ticker, proposalHash, alreadyApproved: true, backupCreated: true, officialStateUnchanged: true };
      }

      const currentRegulatoryData = officialData.regulatoryData || null;
      const reviewedRegulatoryData = prePublication.existingRegulatoryData || null;
      if (stableRegulatoryJson(currentRegulatoryData) !== stableRegulatoryJson(reviewedRegulatoryData)) {
        throw new Error("A base oficial mudou após a pré-publicação. Gere um novo pacote para revisão.");
      }
      if (backupSnapshot.exists) throw new Error("Já existe um backup sem aprovação correspondente. Revisão manual necessária.");

      transaction.set(backupRef, {
        runId,
        ticker,
        sourceDocument: `Fiis/${ticker}`,
        originalDocumentExists: officialSnapshot.exists,
        originalDocument: officialSnapshot.exists ? officialData : null,
        originalRegulatoryData: currentRegulatoryData,
        originalDocumentHash: currentDocumentHash,
        proposalHash,
        status: "immutable_backup_pending_publication",
        officialWritePerformed: false,
        rollbackReadyAfterPublication: true,
        createdBy: session?.user || prePublication.requestedBy || "admin",
        createdAt: adminFieldValue.serverTimestamp(),
      }, { merge: false });

      transaction.set(approvalRef, {
        runId,
        ticker,
        proposalHash,
        confirmationText: expectedConfirmation,
        status: "approved_pending_publication_authorization",
        approvedBy: session?.user || prePublication.requestedBy || "admin",
        approvedAt: adminFieldValue.serverTimestamp(),
        canPublishToOfficialBase: false,
        officialWritePerformed: false,
        backupDocument: `FiiIngestionBackups/${runId}`,
      }, { merge: false });

      transaction.set(prePublicationRef, {
        status: "approved_pending_publication_authorization",
        proposalHash,
        humanApprovalDocument: `FiiIngestionApprovals/${runId}`,
        backupDocument: `FiiIngestionBackups/${runId}`,
        humanApprovedAt: adminFieldValue.serverTimestamp(),
        humanApprovedBy: session?.user || prePublication.requestedBy || "admin",
        canPublishToOfficialBase: false,
        publicationDecision: "blocked_pending_explicit_publication_authorization",
        officialWritePerformed: false,
      }, { merge: true });

      transaction.set(runRef, {
        prePublicationStatus: "approved_pending_publication_authorization",
        proposalHash,
        humanApprovalDocument: `FiiIngestionApprovals/${runId}`,
        backupDocument: `FiiIngestionBackups/${runId}`,
        publishToOfficialBase: false,
        updatedAt: adminFieldValue.serverTimestamp(),
      }, { merge: true });

      return { ticker, proposalHash, alreadyApproved: false, backupCreated: true, officialStateUnchanged: true };
    });

    return reply({
      ok: true,
      runId,
      ...result,
      approvalStatus: "approved_pending_publication_authorization",
      backupDocument: `FiiIngestionBackups/${runId}`,
      approvalDocument: `FiiIngestionApprovals/${runId}`,
      officialWritePerformed: false,
      canPublishToOfficialBase: false,
      publicationDecision: "blocked_pending_explicit_publication_authorization",
    });
  } catch (error: any) {
    const message = error?.message || "Falha ao registrar aprovação humana.";
    const status = message.includes("mudou após") || message.includes("estado íntegro") || message.includes("backup imutável") ? 409 : 400;
    return reply({ ok: false, error: message, officialWritePerformed: false, canPublishToOfficialBase: false }, status);
  }
}
