import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized, readAdminSession } from "@/lib/adminSession";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import {
  buildPublicationConfirmation,
  hashStablePayload,
  normalizedConfirmation,
  publicationWriteEnabled,
} from "@/lib/fiiPublicationSafety";
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

async function readReadiness(runId: string) {
  const prePublicationRef = adminDb.collection("FiiIngestionPrePublication").doc(runId);
  const approvalRef = adminDb.collection("FiiIngestionApprovals").doc(runId);
  const backupRef = adminDb.collection("FiiIngestionBackups").doc(runId);
  const publicationRef = adminDb.collection("FiiIngestionPublications").doc(runId);
  const [prePublicationSnapshot, approvalSnapshot, backupSnapshot, publicationSnapshot] = await Promise.all([
    prePublicationRef.get(),
    approvalRef.get(),
    backupRef.get(),
    publicationRef.get(),
  ]);

  if (!prePublicationSnapshot.exists) {
    throw new Error("Pacote de pré-publicação não encontrado.");
  }

  const prePublication = (prePublicationSnapshot.data() || {}) as Record<string, any>;
  const approval = (approvalSnapshot.data() || {}) as Record<string, any>;
  const backup = (backupSnapshot.data() || {}) as Record<string, any>;
  const publication = (publicationSnapshot.data() || {}) as Record<string, any>;
  const ticker = normalizeIngestionTicker(prePublication.ticker);
  const proposalHash = String(prePublication.proposalHash || approval.proposalHash || "").trim().toLowerCase();
  const officialSnapshot = ticker ? await adminDb.collection("Fiis").doc(ticker).get() : null;
  const officialData = (officialSnapshot?.data() || {}) as Record<string, any>;
  const officialDocumentHash = hashStablePayload(officialSnapshot?.exists ? officialData : null);
  const backupHash = String(backup.originalDocumentHash || "");

  return {
    runId,
    ticker,
    proposalHash,
    expectedConfirmation: buildPublicationConfirmation(ticker, proposalHash),
    environmentEnabled: publicationWriteEnabled(),
    prePublicationStatus: prePublication.status || null,
    approvalStatus: approval.status || null,
    backupStatus: backup.status || null,
    publicationStatus: publication.status || null,
    approvalExists: approvalSnapshot.exists,
    backupExists: backupSnapshot.exists,
    publicationExists: publicationSnapshot.exists,
    officialDocumentUnchanged: Boolean(backupSnapshot.exists && backupHash && backupHash === officialDocumentHash),
    officialDocumentHash,
    backupOriginalDocumentHash: backupHash || null,
    canAttemptPublication: Boolean(
      publicationWriteEnabled()
      && approvalSnapshot.exists
      && backupSnapshot.exists
      && proposalHash
      && approval.status === "approved_pending_publication_authorization"
      && backup.status === "immutable_backup_pending_publication"
      && backupHash === officialDocumentHash
      && !publicationSnapshot.exists
    ),
  };
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return reply({ ok: false, error: "Não autorizado." }, 401);
  }

  try {
    const runId = String(req.nextUrl.searchParams.get("runId") || "").trim();
    if (!runId) return reply({ ok: false, error: "Informe o runId." }, 400);
    return reply({ ok: true, readiness: await readReadiness(runId) });
  } catch (error: any) {
    return reply({ ok: false, error: error?.message || "Erro ao consultar prontidão de publicação." }, 400);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, any>));
  if (!isAdminAuthorized(req, body)) {
    return reply({ ok: false, error: "Não autorizado." }, 401);
  }
  if (!publicationWriteEnabled()) {
    return reply({
      ok: false,
      error: "Publicação desativada no ambiente. Defina FII_INGESTION_PUBLICATION_ENABLED=true somente durante uma janela autorizada.",
      environmentEnabled: false,
      officialWritePerformed: false,
    }, 423);
  }

  try {
    const runId = String(body?.runId || "").trim();
    const suppliedProposalHash = String(body?.proposalHash || "").trim().toLowerCase();
    const suppliedConfirmation = normalizedConfirmation(body?.confirmationText);
    if (!runId) return reply({ ok: false, error: "Informe o runId." }, 400);

    const prePublicationRef = adminDb.collection("FiiIngestionPrePublication").doc(runId);
    const approvalRef = adminDb.collection("FiiIngestionApprovals").doc(runId);
    const backupRef = adminDb.collection("FiiIngestionBackups").doc(runId);
    const publicationRef = adminDb.collection("FiiIngestionPublications").doc(runId);
    const runRef = adminDb.collection("FiiIngestionRuns").doc(runId);
    const session = readAdminSession(req);
    const publishedAt = new Date().toISOString();

    const result = await adminDb.runTransaction(async (transaction) => {
      const [prePublicationSnapshot, approvalSnapshot, backupSnapshot, publicationSnapshot] = await Promise.all([
        transaction.get(prePublicationRef),
        transaction.get(approvalRef),
        transaction.get(backupRef),
        transaction.get(publicationRef),
      ]);

      if (!prePublicationSnapshot.exists || !approvalSnapshot.exists || !backupSnapshot.exists) {
        throw new Error("Pré-publicação, aprovação ou backup obrigatório não encontrado.");
      }

      const prePublication = (prePublicationSnapshot.data() || {}) as Record<string, any>;
      const approval = (approvalSnapshot.data() || {}) as Record<string, any>;
      const backup = (backupSnapshot.data() || {}) as Record<string, any>;
      const ticker = normalizeIngestionTicker(prePublication.ticker);
      const proposal = prePublication.proposedRegulatoryData;
      const computedProposalHash = hashStablePayload(proposal);
      const approvedProposalHash = String(approval.proposalHash || "").toLowerCase();
      const expectedConfirmation = normalizedConfirmation(
        buildPublicationConfirmation(ticker, computedProposalHash)
      );

      if (!ticker || !proposal) throw new Error("Pacote aprovado incompleto.");
      if (computedProposalHash !== approvedProposalHash
        || computedProposalHash !== String(prePublication.proposalHash || "").toLowerCase()
        || computedProposalHash !== String(backup.proposalHash || "").toLowerCase()) {
        throw new Error("Os hashes do pacote, aprovação e backup não coincidem.");
      }
      if (suppliedProposalHash !== computedProposalHash) {
        throw new Error("Informe o hash completo do pacote aprovado.");
      }
      if (suppliedConfirmation !== expectedConfirmation) {
        throw new Error(`Digite exatamente: ${buildPublicationConfirmation(ticker, computedProposalHash)}`);
      }
      if (approval.status !== "approved_pending_publication_authorization") {
        throw new Error("A aprovação humana não está no estado esperado.");
      }
      if (backup.status !== "immutable_backup_pending_publication") {
        throw new Error("O backup não está pronto para publicação.");
      }

      if (publicationSnapshot.exists) {
        const publication = (publicationSnapshot.data() || {}) as Record<string, any>;
        if (publication.proposalHash !== computedProposalHash) {
          throw new Error("Já existe publicação para outra versão deste runId.");
        }
        return {
          ticker,
          proposalHash: computedProposalHash,
          alreadyPublished: true,
          publishedAt: publication.publishedAt || null,
        };
      }

      const officialRef = adminDb.collection("Fiis").doc(ticker);
      const officialSnapshot = await transaction.get(officialRef);
      const officialData = (officialSnapshot.data() || {}) as Record<string, any>;
      const currentDocumentHash = hashStablePayload(officialSnapshot.exists ? officialData : null);
      if (currentDocumentHash !== String(backup.originalDocumentHash || "")) {
        throw new Error("A base oficial mudou após o backup. Gere nova pré-publicação e aprovação.");
      }

      const publishedBy = session?.user || approval.approvedBy || "admin";
      const publishedRegulatoryData = {
        ...proposal,
        status: "published",
        publication: {
          runId,
          proposalHash: computedProposalHash,
          publishedAt,
          publishedBy,
        },
      };
      const publishedDocument = {
        ...officialData,
        regulatoryData: publishedRegulatoryData,
      };
      const publishedDocumentHash = hashStablePayload(publishedDocument);

      transaction.set(officialRef, {
        regulatoryData: publishedRegulatoryData,
      }, { merge: true });
      transaction.set(publicationRef, {
        runId,
        ticker,
        proposalHash: computedProposalHash,
        status: "published",
        sourceDocument: `Fiis/${ticker}`,
        backupDocument: `FiiIngestionBackups/${runId}`,
        approvalDocument: `FiiIngestionApprovals/${runId}`,
        previousDocumentHash: currentDocumentHash,
        publishedDocumentHash,
        publishedRegulatoryDataHash: hashStablePayload(publishedRegulatoryData),
        publishedBy,
        publishedAt,
        publishedAtServer: adminFieldValue.serverTimestamp(),
        rollbackAvailable: true,
        rollbackPerformed: false,
      }, { merge: false });
      transaction.set(approvalRef, {
        status: "published",
        officialWritePerformed: true,
        publishedAt: adminFieldValue.serverTimestamp(),
        publicationDocument: `FiiIngestionPublications/${runId}`,
      }, { merge: true });
      transaction.set(prePublicationRef, {
        status: "published",
        officialWritePerformed: true,
        canPublishToOfficialBase: false,
        publicationDecision: "published_with_rollback_available",
        publicationDocument: `FiiIngestionPublications/${runId}`,
        publishedAt: adminFieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(runRef, {
        prePublicationStatus: "published",
        publishToOfficialBase: true,
        officialWritePerformed: true,
        publicationDocument: `FiiIngestionPublications/${runId}`,
        publishedAt: adminFieldValue.serverTimestamp(),
        updatedAt: adminFieldValue.serverTimestamp(),
      }, { merge: true });

      return {
        ticker,
        proposalHash: computedProposalHash,
        alreadyPublished: false,
        publishedAt,
        publishedDocumentHash,
      };
    });

    return reply({
      ok: true,
      runId,
      ...result,
      officialWritePerformed: true,
      publicationStatus: "published",
      rollbackAvailable: true,
    });
  } catch (error: any) {
    const message = error?.message || "Falha na publicação transacional.";
    const status = message.includes("mudou após") ? 409 : 400;
    return reply({
      ok: false,
      error: message,
      officialWritePerformed: false,
    }, status);
  }
}
