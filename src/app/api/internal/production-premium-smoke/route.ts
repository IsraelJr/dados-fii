import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { regulatoryRepository } from "@/lib/regulatory/RegulatoryRepository";
import { regulatoryDataService } from "@/lib/regulatoryDataService";
import { requireGithubActionsProductionIdentity } from "@/lib/security/GithubActionsOidc";
import { safeLog } from "@/lib/observability/SafeLogger";
import type { PremiumProductionSmokeEvidence } from "@/types/premium-production-smoke";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function deploymentUrl() {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "dadosfii.com.br";
  return `https://${host.replace(/^https?:\/\//, "")}`;
}

function hashEvidence(evidence: Omit<PremiumProductionSmokeEvidence, "evidenceHash">) {
  return createHash("sha256").update(JSON.stringify(evidence), "utf8").digest("hex");
}

export async function POST(request: NextRequest) {
  const startedAt = new Date().toISOString();
  let identity: Awaited<ReturnType<typeof requireGithubActionsProductionIdentity>>;
  try {
    identity = await requireGithubActionsProductionIdentity(request);
  } catch (error) {
    safeLog("warn", "premium.production-smoke.unauthorized", {
      correlationId: request.headers.get("x-correlation-id"),
      error,
    });
    return NextResponse.json({ ok: false, error: "Identidade de execução inválida." }, { status: 401 });
  }

  const ticker = "TGAR11";
  let auditEventId: string | null = null;
  let auditCorrelationId: string | null = null;
  let peerSnapshotHash: string | null = null;
  let blocker: string | null = null;
  const checks: PremiumProductionSmokeEvidence["checks"] = [];

  try {
    const snapshot = await regulatoryDataService.rebuildPremiumPeerSnapshot(
      `github-oidc:${identity.runId}:${identity.runAttempt}`,
    );
    peerSnapshotHash = snapshot.sourceHash;
    checks.push({
      id: "premium.peer-snapshot",
      status: "passed",
      metadata: { sourceFundCount: snapshot.sourceFundCount, sourceHash: snapshot.sourceHash },
    });

    const report = await regulatoryDataService.getPremiumReport(ticker, {
      requestKey: `production-smoke:${identity.sha}:${identity.runId}:${identity.runAttempt}`,
      holdings: [{ ticker, quotas: 10 }, { ticker: "MXRF11", quotas: 5 }],
      auditActor: `github-oidc:${identity.runId}`,
      accessPlan: "synthetic-production-smoke",
    });
    if (!report || report.ticker !== ticker) throw new Error("Relatório Premium sintético não foi gerado.");
    auditEventId = report.auditReceipt.eventId;
    auditCorrelationId = report.auditReceipt.correlationId;
    checks.push({
      id: "premium.report-generated",
      status: "passed",
      metadata: {
        ticker: report.ticker,
        reportVersion: report.reportVersion,
        riskLabAvailability: report.riskLab.availability,
        portfolioImpactAvailable: report.portfolioImpact.available,
      },
    });

    const persistedAudit = await regulatoryRepository.getAuditEventById(report.auditReceipt.eventId);
    const auditValid = persistedAudit?.action === "premium-read"
      && persistedAudit.ticker === ticker
      && persistedAudit.metadata?.correlationId === report.auditReceipt.correlationId;
    if (!auditValid) throw new Error("Evento de auditoria Premium não pôde ser relido.");
    checks.push({
      id: "premium.audit-persisted",
      status: "passed",
      metadata: { auditEventId: report.auditReceipt.eventId },
    });

    const isolationValid = report.riskLab.readOnly
      && !report.riskLab.notificationsAllowed
      && !report.riskLab.externalEffectsAllowed;
    if (!isolationValid) throw new Error("Contrato read-only do Risk Lab foi violado.");
    checks.push({
      id: "premium.risk-lab-isolation",
      status: "passed",
      metadata: { readOnly: true, notificationsAllowed: false, externalEffectsAllowed: false },
    });
  } catch (error) {
    blocker = error instanceof Error ? error.message.slice(0, 300) : "Falha desconhecida.";
    checks.push({ id: "premium.execution", status: "failed", metadata: { reason: blocker } });
  }

  const withoutHash: Omit<PremiumProductionSmokeEvidence, "evidenceHash"> = {
    schemaVersion: 1,
    evidenceVersion: "premium-production-smoke-v1",
    status: blocker ? "failed" : "passed",
    releaseCommit: identity.sha,
    deploymentUrl: deploymentUrl(),
    workflowRunId: identity.runId,
    workflowRunAttempt: identity.runAttempt,
    ticker,
    startedAt,
    completedAt: new Date().toISOString(),
    checks,
    auditEventId,
    auditCorrelationId,
    peerSnapshotHash,
    blocker,
  };
  const evidence = await regulatoryRepository.savePremiumProductionSmoke({
    ...withoutHash,
    evidenceHash: hashEvidence(withoutHash),
  });
  return NextResponse.json({
    ok: evidence.status === "passed",
    evidence,
  }, {
    status: evidence.status === "passed" ? 200 : 422,
    headers: { "Cache-Control": "no-store" },
  });
}
