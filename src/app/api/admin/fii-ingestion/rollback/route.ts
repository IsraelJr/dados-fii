import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized, readAdminSession } from "@/lib/adminSession";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import {
  buildRollbackConfirmation,
  hashStablePayload,
  normalizedConfirmation,
  rollbackWriteEnabled,
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
  const publicationRef = adminDb.collection("FiiIngestionPublications").doc(runId);
  const backupRef = adminDb.collection("FiiIngestionBackups").doc(runId);
  const rollbackRef = adminDb.collection("FiiIngestionRollbacks").doc(runId);
  const [publicationSnapshot, backupSnapshot, rollbackSnapshot] = await Promise.all([
    publicationRef.get(),
    backupRef.get(),
    rollbackRef.get(),
  ]);

  const publication = (publicationSnapshot.data() || {}) as Record<string, any>;
  const backup = (backupSnapshot.data() || {}) as Record<string, any>;
  const ticker = normalizeIngestionTicker(publication.ticker || backup.ticker);
  const proposalHash = String(publication.proposalHash || backup.proposalHash || "").toLowerCase();
  const officialSnapshot = ticker ? await adminDb.collection("Fiis").doc(ticker).get() : null;
  const officialData = (officialSnapshot?.data() || {}) as Record<string, any>;
  const currentDocumentHash = hashStablePayload(officialSnapshot?.exists ? officialData : null);

  return {
    runId,
    ticker,
    proposalHash,
    expectedConfirmation: buildRollbackConfirmation(ticker, proposalHash),
    environmentEnabled: rollbackWriteEnabled(),
    publicationExists: publicationSnapshot.exists,
    backupExists: backupSnapshot.exists,
    rollbackExists: rollbackSnapshot.exists,
    publicationStatus: publication.status || null,
    rollbackAvailable: publication.rollbackAvailable === true && publication.rollbackPerformed !== true,
    currentOfficialMatchesPublishedHash: Boolean(
      publication.publishedDocumentHash
      && publication.publishedDocumentHash === currentDocumentHash
    ),
    canAttemptRollback: Boolean(
      rollbackWriteEnabled()
      && publicationSnapshot.exists
      && backupSnapshot.exists
      && !rollbackSnapshot.exists
      && publication.status === "published"
      && publication.rollbackAvailable === true
      && publication.rollbackPerformed !== true
      && publication.publishedDocumentHash === currentDocumentHash
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
    return reply({ ok: false, error: error?.message || "Erro ao consultar prontidão de rollback." }, 400);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, any>));
  if (!isAdminAuthorized(req, body)) {
    return reply({ ok: false, error: "Não autorizado." }, 401);
  }
  if (!rollbackWriteEnabled()) {
    return reply({
      ok: false,
      error: "Rollback desativado no ambiente. Defina FII_INGESTION_ROLLBACK_ENABLED=true somente durante uma janela autorizada.",
      environmentEnabled: false,
      rollbackPerformed: false,
    }, 423);
  }

  try {
    const runId = String(body?.runId || "").trim();
    const suppliedProposalHash = String(body?.proposalHash || "").trim().toLowerCase();
    const suppliedConfirmation = normalizedConfirmation(body?.confirmationText);
    if (!runId) return reply({ ok: false, error: "Informe o runId." }, 400);

    const publicationRef = adminDb.collection("FiiIngestionPublications").doc(runId);
    const backupRef = adminDb.collection("FiiIngestionBackups").doc(runId);
    const rollbackRef = adminDb.collection("FiiIngestionRollbacks").doc(runId);
    const approvalRef = adminDb.collection("FiiIngestionApprovals").doc(runId);
    const prePublicationRef = adminDb.collection("FiiIngestionPrePublication").doc(runId);
    const runRef = adminDb.collection("FiiIngestionRuns").doc(runId);
    const session = readAdminSession(req);
    const rolledBackAt = new Date().toISOString();

    const result = await adminDb.runTransaction(async (transaction) => {
      const [publicationSnapshot, backupSnapshot, rollbackSnapshot] = await Promise.all([
        transaction.get(publicationRef),
        transaction.get(backupRef),
        transaction.get(rollbackRef),
      ]);

      if (!publicationSnapshot.exists || !backupSnapshot.exists) {
        throw new Error("Publicação ou backup obrigatório não encontrado.");
      }

      const publication = (publicationSnapshot.data() || {}) as Record<string, any>;
      const backup = (backupSnapshot.data() || {}) as Record<string, any>;
      const ticker = normalizeIngestionTicker(publication.ticker || backup.ticker);
      const proposalHash = String(publication.proposalHash || "").toLowerCase();
      const expectedConfirmation = normalizedConfirmation(
        buildRollbackConfirmation(ticker, proposalHash)
      );

      if (!ticker || !proposalHash) throw new Error("Registro de publicação incompleto.");
      if (proposalHash !== String(backup.proposalHash || "").toLowerCase()) {
        throw new Error("O hash da publicação não corresponde ao backup.");
      }
      if (suppliedProposalHash !== proposalHash) {
        throw new Error("Informe o hash completo do pacote publicado.");
      }
      if (suppliedConfirmation !== expectedConfirmation) {
        throw new Error(`Digite exatamente: ${buildRollbackConfirmation(ticker, proposalHash)}`);
      }

      if (rollbackSnapshot.exists) {
        const rollback = (rollbackSnapshot.data() || {}) as Record<string, any>;
        if (rollback.proposalHash !== proposalHash) {
          throw new Error("Já existe rollback para outra versão deste runId.");
        }
        return {
          ticker,
          proposalHash,
          alreadyRolledBack: true,
          rolledBackAt: rollback.rolledBackAt || null,
        };
      }
      if (publication.status !== "published"
        || publication.rollbackAvailable !== true
        || publication.rollbackPerformed === true) {
        throw new Error("Esta publicação não está disponível para rollback.");
      }

      const officialRef = adminDb.collection("Fiis").doc(ticker);
      const officialSnapshot = await transaction.get(officialRef);
      const officialData = (officialSnapshot.data() || {}) as Record<string, any>;
      const currentDocumentHash = hashStablePayload(officialSnapshot.exists ? officialData : null);
      if (currentDocumentHash !== String(publication.publishedDocumentHash || "")) {
        throw new Error("A base oficial mudou após a publicação. Rollback automático bloqueado.");
      }

      if (backup.originalDocumentExists === true) {
        const originalDocument = backup.originalDocument;
        if (!originalDocument || typeof originalDocument !== "object") {
          throw new Error("O backup integral do documento original está inválido.");
        }
        if (hashStablePayload(originalDocument) !== String(backup.originalDocumentHash || "")) {
          throw new Error("A integridade do backup original não pôde ser comprovada.");
        }
        transaction.set(officialRef, originalDocument, { merge: false });
      } else {
        if (hashStablePayload(null) !== String(backup.originalDocumentHash || "")) {
          throw new Error("A integridade do backup de documento inexistente não pôde ser comprovada.");
        }
        transaction.delete(officialRef);
      }

      const rolledBackBy = session?.user || publication.publishedBy || "admin";
      transaction.set(rollbackRef, {
        runId,
        ticker,
        proposalHash,
        status: "rolled_back",
        publicationDocument: `FiiIngestionPublications/${runId}`,
        backupDocument: `FiiIngestionBackups/${runId}`,
        restoredDocumentHash: String(backup.originalDocumentHash || ""),
        previousPublishedDocumentHash: currentDocumentHash,
        rolledBackBy,
        rolledBackAt,
        rolledBackAtServer: adminFieldValue.serverTimestamp(),
      }, { merge: false });
      transaction.set(publicationRef, {
        status: "rolled_back",
        rollbackAvailable: false,
        rollbackPerformed: true,
        rollbackDocument: `FiiIngestionRollbacks/${runId}`,
        rolledBackAt: adminFieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(approvalRef, {
        status: "rolled_back",
        officialWritePerformed: false,
        rollbackDocument: `FiiIngestionRollbacks/${runId}`,
        rolledBackAt: adminFieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(prePublicationRef, {
        status: "rolled_back",
        officialWritePerformed: false,
        canPublishToOfficialBase: false,
        publicationDecision: "rolled_back_to_immutable_backup",
        rollbackDocument: `FiiIngestionRollbacks/${runId}`,
        rolledBackAt: adminFieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(runRef, {
        prePublicationStatus: "rolled_back",
        publishToOfficialBase: false,
        officialWritePerformed: false,
        rollbackDocument: `FiiIngestionRollbacks/${runId}`,
        rolledBackAt: adminFieldValue.serverTimestamp(),
        updatedAt: adminFieldValue.serverTimestamp(),
      }, { merge: true });

      return {
        ticker,
        proposalHash,
        alreadyRolledBack: false,
        rolledBackAt,
        restoredDocumentHash: String(backup.originalDocumentHash || ""),
      };
    });

    return reply({
      ok: true,
      runId,
      ...result,
      rollbackPerformed: true,
      rollbackStatus: "rolled_back",
    });
  } catch (error: any) {
    const message = error?.message || "Falha no rollback transacional.";
    const status = message.includes("mudou após") ? 409 : 400;
    return reply({
      ok: false,
      error: message,
      rollbackPerformed: false,
    }, status);
  }
}
