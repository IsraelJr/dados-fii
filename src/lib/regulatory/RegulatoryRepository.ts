import { createHash } from "crypto";
import admin, { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { canonicalFrom, normalizeTicker, nowIso, source, toIso } from "@/lib/regulatory/RegulatoryNormalizer";
import { validateRegulatoryFund } from "@/lib/regulatory/RegulatoryValidator";
import {
  REGULATORY_COLLECTIONS,
  type LegacyFundRecord,
  type PublicationAuthorization,
  type RegulatoryOverlay,
  type RollbackAuthorization,
} from "@/lib/regulatory/RegulatoryTypes";
import {
  REGULATORY_SCHEMA_VERSION,
  type ParserHealth,
  type RegulatoryAuditEvent,
  type RepositoryProbe,
  type ValidationRun,
} from "@/types/regulatory";
import type { TimelineRecord } from "@/types/timeline";
import type { MonitorAlert, MonitorDelivery, MonitorRun, MonitorStatus } from "@/types/monitor";
import type { IfixComposition } from "@/types/indexes";

type AuditAction = "publish" | "rollback" | "validation" | "monitor" | "index-sync";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue(item)]));
}

function contentHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(stableValue(value)), "utf8").digest("hex");
}

function assertApproval(authorization: PublicationAuthorization | RollbackAuthorization) {
  if (!authorization.actor.trim()) throw new Error("Ator administrativo obrigatório.");
  if (!/^[a-f0-9]{32,128}$/i.test(authorization.approvalHash)) throw new Error("Hash de aprovação inválido.");
  if (!authorization.reason.trim()) throw new Error("Motivo da operação obrigatório.");
}

export class RegulatoryRepository {
  async getLegacyByTicker(ticker: string): Promise<LegacyFundRecord | null> {
    const direct = await adminDb.collection(REGULATORY_COLLECTIONS.legacyFunds).doc(ticker).get();
    if (direct.exists) return { id: direct.id, data: direct.data() as Record<string, unknown> };
    const query = await adminDb.collection(REGULATORY_COLLECTIONS.legacyFunds).where("code", "==", ticker).limit(1).get();
    if (query.empty) return null;
    return { id: query.docs[0].id, data: query.docs[0].data() as Record<string, unknown> };
  }

  async getOverlayByTicker(ticker: string): Promise<RegulatoryOverlay | null> {
    const snapshot = await adminDb.collection(REGULATORY_COLLECTIONS.funds).doc(ticker).get();
    return snapshot.exists ? snapshot.data() as RegulatoryOverlay : null;
  }

  async listLegacy(limit: number): Promise<LegacyFundRecord[]> {
    const snapshot = await adminDb.collection(REGULATORY_COLLECTIONS.legacyFunds).limit(limit).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() as Record<string, unknown> }));
  }

  async listLegacyPage(limit: number, cursor?: string) {
    let query = adminDb.collection(REGULATORY_COLLECTIONS.legacyFunds)
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(limit);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    return {
      records: snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() as Record<string, unknown> })),
      nextCursor: snapshot.docs.at(-1)?.id || null,
      hasMore: snapshot.docs.length === limit,
    };
  }

  async listOverlays(limit: number): Promise<Array<{ id: string; data: RegulatoryOverlay }>> {
    const snapshot = await adminDb.collection(REGULATORY_COLLECTIONS.funds).limit(limit).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() as RegulatoryOverlay }));
  }

  async getIndexComposition(index = "IFIX"): Promise<IfixComposition | null> {
    const snapshot = await adminDb.collection(REGULATORY_COLLECTIONS.indexCompositions).doc(index.toUpperCase()).get();
    return snapshot.exists ? snapshot.data() as IfixComposition : null;
  }

  async saveIndexComposition(composition: IfixComposition, actor: string) {
    const batch = adminDb.batch();
    batch.set(adminDb.collection(REGULATORY_COLLECTIONS.indexCompositions).doc(composition.index), {
      ...composition,
      updatedAt: adminFieldValue.serverTimestamp(),
      updatedBy: actor,
    }, { merge: false });
    batch.set(adminDb.collection(REGULATORY_COLLECTIONS.auditLogs).doc(), this.auditPayload("index-sync", actor, undefined, {
      index: composition.index,
      referenceDate: composition.referenceDate,
      constituents: composition.total,
      source: composition.source,
    }));
    await batch.commit();
  }

  async publish(tickerInput: unknown, patch: Record<string, unknown>, authorization: PublicationAuthorization) {
    const ticker = normalizeTicker(tickerInput);
    if (!ticker) throw new Error("Ticker inválido.");
    assertApproval(authorization);
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(authorization.backupId)) throw new Error("Identificador de backup inválido.");
    const approvedAt = new Date(authorization.approvedAt);
    if (Number.isNaN(approvedAt.getTime())) throw new Error("Data de aprovação inválida.");

    const currentRef = adminDb.collection(REGULATORY_COLLECTIONS.funds).doc(ticker);
    const auditRef = adminDb.collection(REGULATORY_COLLECTIONS.auditLogs).doc();
    const backupRef = adminDb.collection(REGULATORY_COLLECTIONS.backups).doc(ticker).collection("backups").doc(authorization.backupId);
    const result = await adminDb.runTransaction(async (transaction) => {
      const [currentSnapshot, backupSnapshot] = await Promise.all([transaction.get(currentRef), transaction.get(backupRef)]);
      if (backupSnapshot.exists) throw new Error("Backup imutável já existe; use um novo identificador.");
      const current = currentSnapshot.data() || {};
      const nextVersion = Number(current.currentVersion || 0) + 1;
      const versionId = `v${String(nextVersion).padStart(6, "0")}`;
      const versionRef = adminDb.collection(REGULATORY_COLLECTIONS.versions).doc(ticker).collection("versions").doc(versionId);
      const next = {
        ...current,
        ...patch,
        ticker,
        code: ticker,
        schemaVersion: REGULATORY_SCHEMA_VERSION,
        currentVersion: nextVersion,
        publishedAt: adminFieldValue.serverTimestamp(),
        publishedBy: authorization.actor,
        approvalHash: authorization.approvalHash,
        approvedAt: authorization.approvedAt,
        backupId: authorization.backupId,
        sources: Array.isArray(patch.sources) ? patch.sources : current.sources || [source("Admin Dados FII", "manual", nowIso())],
      };
      const issues = validateRegulatoryFund(canonicalFrom(ticker, {}, next));
      const errors = issues.filter((issue) => issue.severity === "error");
      if (errors.length) throw new Error(`Publicação bloqueada: ${errors.map((issue) => issue.message).join(" ")}`);
      const publicationHash = contentHash({ ticker, versionId, patch, approvalHash: authorization.approvalHash, backupId: authorization.backupId });
      transaction.create(backupRef, {
        ticker,
        state: current,
        stateHash: contentHash(current),
        createdAt: adminFieldValue.serverTimestamp(),
        createdAtIso: nowIso(),
        createdBy: authorization.actor,
        immutable: true,
      });
      transaction.set(versionRef, { ...next, versionId, publicationHash, createdAt: adminFieldValue.serverTimestamp(), createdBy: authorization.actor, reason: authorization.reason });
      transaction.set(currentRef, { ...next, publicationHash }, { merge: false });
      transaction.set(auditRef, this.auditPayload("publish", authorization.actor, ticker, { versionId, reason: authorization.reason, approvalHash: authorization.approvalHash, backupId: authorization.backupId, publicationHash }));
      return { ticker, versionId, currentVersion: nextVersion, issues, publicationHash, backupId: authorization.backupId };
    });
    return result;
  }

  async rollback(tickerInput: unknown, versionId: string, authorization: RollbackAuthorization) {
    const ticker = normalizeTicker(tickerInput);
    if (!ticker || !/^v\d{6}$/.test(versionId)) throw new Error("Ticker ou versão inválida.");
    assertApproval(authorization);
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(authorization.backupId)) throw new Error("Identificador de backup inválido.");
    if (Number.isNaN(new Date(authorization.approvedAt).getTime())) throw new Error("Data de aprovação inválida.");
    const currentRef = adminDb.collection(REGULATORY_COLLECTIONS.funds).doc(ticker);
    const versionRef = adminDb.collection(REGULATORY_COLLECTIONS.versions).doc(ticker).collection("versions").doc(versionId);
    const auditRef = adminDb.collection(REGULATORY_COLLECTIONS.auditLogs).doc();
    const backupRef = adminDb.collection(REGULATORY_COLLECTIONS.backups).doc(ticker).collection("backups").doc(authorization.backupId);
    return adminDb.runTransaction(async (transaction) => {
      const [currentSnapshot, versionSnapshot, backupSnapshot] = await Promise.all([
        transaction.get(currentRef),
        transaction.get(versionRef),
        transaction.get(backupRef),
      ]);
      if (!versionSnapshot.exists) throw new Error("Versão regulatória não encontrada.");
      if (backupSnapshot.exists) throw new Error("Backup imutável já existe; use um novo identificador.");
      const current = currentSnapshot.data() || {};
      const restored = versionSnapshot.data() || {};
      const nextVersion = Number(current.currentVersion || 0) + 1;
      const rollbackVersionId = `v${String(nextVersion).padStart(6, "0")}`;
      const rollbackVersionRef = adminDb.collection(REGULATORY_COLLECTIONS.versions).doc(ticker).collection("versions").doc(rollbackVersionId);
      const next = {
        ...restored,
        ticker,
        code: ticker,
        currentVersion: nextVersion,
        rolledBackFrom: versionId,
        approvalHash: authorization.approvalHash,
        publishedAt: adminFieldValue.serverTimestamp(),
        publishedBy: authorization.actor,
      };
      const publicationHash = contentHash({ ticker, rollbackVersionId, restoredVersion: versionId, approvalHash: authorization.approvalHash, backupId: authorization.backupId });
      transaction.create(backupRef, {
        ticker,
        state: current,
        stateHash: contentHash(current),
        createdAt: adminFieldValue.serverTimestamp(),
        createdAtIso: nowIso(),
        createdBy: authorization.actor,
        immutable: true,
        operation: "rollback",
      });
      transaction.set(rollbackVersionRef, { ...next, versionId: rollbackVersionId, publicationHash, createdAt: adminFieldValue.serverTimestamp(), createdBy: authorization.actor, reason: authorization.reason });
      transaction.set(currentRef, { ...next, publicationHash }, { merge: false });
      transaction.set(auditRef, this.auditPayload("rollback", authorization.actor, ticker, { fromVersion: current.currentVersion || 0, restoredVersion: versionId, versionId: rollbackVersionId, reason: authorization.reason, approvalHash: authorization.approvalHash, publicationHash, backupId: authorization.backupId }));
      return { ticker, restoredVersion: versionId, versionId: rollbackVersionId, currentVersion: nextVersion, publicationHash, backupId: authorization.backupId };
    });
  }

  async saveValidationRun(run: ValidationRun) {
    const runRef = adminDb.collection(REGULATORY_COLLECTIONS.validationRuns).doc(run.id);
    const batch = adminDb.batch();
    batch.set(runRef, { ...run, results: run.results.slice(0, 250), createdAt: adminFieldValue.serverTimestamp() });
    run.parserHealth.forEach((parser) => batch.set(adminDb.collection(REGULATORY_COLLECTIONS.parserHealth).doc(parser.parser), parser, { merge: true }));
    batch.set(adminDb.collection(REGULATORY_COLLECTIONS.auditLogs).doc(), this.auditPayload("validation", run.actor, undefined, { runId: run.id, status: run.status, totals: run.totals, healthScore: run.healthScore, error: run.error || null }));
    await batch.commit();
  }

  validationRunId() {
    return adminDb.collection(REGULATORY_COLLECTIONS.validationRuns).doc().id;
  }

  async getValidationHistory(limit = 20): Promise<ValidationRun[]> {
    const snapshot = await adminDb.collection(REGULATORY_COLLECTIONS.validationRuns).orderBy("createdAt", "desc").limit(Math.min(Math.max(limit, 1), 50)).get();
    return snapshot.docs.map((doc) => {
      const data = doc.data() as ValidationRun & { createdAt?: unknown };
      return {
        ...data,
        id: doc.id,
        startedAt: toIso(data.startedAt) || data.startedAt,
        finishedAt: toIso(data.finishedAt) || data.finishedAt,
        checks: Array.isArray(data.checks) ? data.checks : [],
        coverage: data.coverage || { fii: 0, fiagro: 0, fiInfra: 0, unknown: 0 },
      };
    });
  }

  async getParserHealth(): Promise<ParserHealth[]> {
    const snapshot = await adminDb.collection(REGULATORY_COLLECTIONS.parserHealth).get();
    return snapshot.docs.map((doc) => ({ ...(doc.data() as ParserHealth), parser: doc.id })).sort((a, b) => a.parser.localeCompare(b.parser));
  }

  async probe(): Promise<RepositoryProbe> {
    const startedAt = Date.now();
    try {
      const snapshot = await adminDb.collection(REGULATORY_COLLECTIONS.legacyFunds).limit(1).get();
      return { ok: true, latencyMs: Date.now() - startedAt, legacyFundsAvailable: !snapshot.empty };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        legacyFundsAvailable: false,
        error: error instanceof Error ? error.message : "Falha desconhecida ao consultar o Firestore.",
      };
    }
  }

  async getAuditEvents(limit = 50): Promise<RegulatoryAuditEvent[]> {
    const snapshot = await adminDb.collection(REGULATORY_COLLECTIONS.auditLogs)
      .orderBy("createdAt", "desc")
      .limit(Math.min(Math.max(limit, 1), 100))
      .get();
    return snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        action: String(data.action || "unknown"),
        actor: data.actor ? String(data.actor) : null,
        ticker: data.ticker ? String(data.ticker) : null,
        createdAt: toIso(data.createdAt) || toIso(data.createdAtIso),
        metadata: data.metadata && typeof data.metadata === "object" ? data.metadata as Record<string, unknown> : {},
      };
    });
  }

  async getTimelineRecords(ticker: string, limit = 500): Promise<TimelineRecord[]> {
    const snapshot = await adminDb.collection(REGULATORY_COLLECTIONS.timelineEvents)
      .where("ticker", "==", ticker)
      .limit(Math.min(Math.max(limit, 1), 500))
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() as Record<string, unknown> }));
  }

  async getAuditEventsForTicker(ticker: string, limit = 100): Promise<RegulatoryAuditEvent[]> {
    const snapshot = await adminDb.collection(REGULATORY_COLLECTIONS.auditLogs)
      .where("ticker", "==", ticker)
      .limit(Math.min(Math.max(limit, 1), 100))
      .get();
    return snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        action: String(data.action || "unknown"),
        actor: data.actor ? String(data.actor) : null,
        ticker: data.ticker ? String(data.ticker) : null,
        createdAt: toIso(data.createdAt) || toIso(data.createdAtIso),
        metadata: data.metadata && typeof data.metadata === "object" ? data.metadata as Record<string, unknown> : {},
      };
    }).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }

  monitorRunId() {
    return adminDb.collection(REGULATORY_COLLECTIONS.monitorRuns).doc().id;
  }

  async acquireMonitorLock(owner: string, ttlMs = 10 * 60_000) {
    const ref = adminDb.collection(REGULATORY_COLLECTIONS.monitorLocks).doc("system");
    return adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const current = snapshot.data() || {};
      const expiresAt = toIso(current.expiresAt) || toIso(current.expiresAtIso);
      const lockIsActive = snapshot.exists && expiresAt && new Date(expiresAt).getTime() > Date.now();
      if (lockIsActive) return false;
      const acquiredAtIso = nowIso();
      const expiresAtIso = new Date(Date.now() + ttlMs).toISOString();
      transaction.set(ref, {
        owner,
        acquiredAt: adminFieldValue.serverTimestamp(),
        acquiredAtIso,
        expiresAtIso,
        updatedAt: adminFieldValue.serverTimestamp(),
      });
      return true;
    });
  }

  async releaseMonitorLock(owner: string) {
    const ref = adminDb.collection(REGULATORY_COLLECTIONS.monitorLocks).doc("system");
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists && snapshot.data()?.owner === owner) transaction.delete(ref);
    });
  }

  async saveMonitorRun(run: MonitorRun) {
    const batch = adminDb.batch();
    batch.set(adminDb.collection(REGULATORY_COLLECTIONS.monitorRuns).doc(run.id), {
      ...run,
      createdAt: adminFieldValue.serverTimestamp(),
    });
    batch.set(adminDb.collection(REGULATORY_COLLECTIONS.auditLogs).doc(), this.auditPayload("monitor", run.actor, undefined, {
      runId: run.id,
      status: run.status,
      totals: run.totals,
      healthScore: run.healthScore,
      error: run.error || null,
    }));
    await batch.commit();
  }

  async upsertMonitorAlert(alert: MonitorAlert, cooldownMs: number) {
    const ref = adminDb.collection(REGULATORY_COLLECTIONS.monitorAlerts).doc(alert.fingerprint);
    return adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const current = snapshot.data() || {};
      const lastNotifiedAt = toIso(current.lastNotifiedAt) || toIso(current.lastNotifiedAtIso);
      const lastNotifiedMs = lastNotifiedAt ? new Date(lastNotifiedAt).getTime() : 0;
      const severityChanged = snapshot.exists && current.severity !== alert.severity;
      const shouldNotify = !snapshot.exists || current.status === "resolved" || severityChanged || !lastNotifiedMs || Date.now() - lastNotifiedMs >= cooldownMs;
      transaction.set(ref, {
        ...current,
        ...alert,
        status: "active",
        firstDetectedAt: current.firstDetectedAt || alert.detectedAt,
        lastDetectedAt: alert.detectedAt,
        occurrences: Number(current.occurrences || 0) + 1,
        notificationCount: Number(current.notificationCount || 0),
        updatedAt: adminFieldValue.serverTimestamp(),
      }, { merge: true });
      return { shouldNotify, alert: { ...alert, status: "active" as const } };
    });
  }

  async markMonitorAlertNotified(fingerprint: string, deliveries: MonitorDelivery[]) {
    await adminDb.collection(REGULATORY_COLLECTIONS.monitorAlerts).doc(fingerprint).set({
      lastNotifiedAt: adminFieldValue.serverTimestamp(),
      lastNotifiedAtIso: nowIso(),
      lastDeliveries: deliveries,
      notificationCount: adminFieldValue.increment(1),
      updatedAt: adminFieldValue.serverTimestamp(),
    }, { merge: true });
  }

  async resolveMonitorAlerts(activeFingerprints: string[], resolvedAt = nowIso()) {
    const snapshot = await adminDb.collection(REGULATORY_COLLECTIONS.monitorAlerts).limit(250).get();
    const active = new Set(activeFingerprints);
    const batch = adminDb.batch();
    let resolved = 0;
    for (const doc of snapshot.docs) {
      const data = doc.data() || {};
      if (data.status === "active" && !active.has(doc.id)) {
        batch.set(doc.ref, { status: "resolved", resolvedAt, updatedAt: adminFieldValue.serverTimestamp() }, { merge: true });
        resolved += 1;
      }
    }
    if (resolved) await batch.commit();
    return resolved;
  }

  async getMonitorStatus(limit = 20): Promise<MonitorStatus> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const [runsSnapshot, alertsSnapshot] = await Promise.all([
      adminDb.collection(REGULATORY_COLLECTIONS.monitorRuns).orderBy("createdAt", "desc").limit(safeLimit).get(),
      adminDb.collection(REGULATORY_COLLECTIONS.monitorAlerts).limit(250).get(),
    ]);
    const runs = runsSnapshot.docs.map((doc) => {
      const data = doc.data() as MonitorRun;
      return { ...data, id: doc.id };
    });
    const activeAlerts = alertsSnapshot.docs
      .map((doc) => ({ ...(doc.data() as MonitorAlert), fingerprint: doc.id }))
      .filter((alert) => alert.status === "active")
      .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
    return { generatedAt: nowIso(), latestRun: runs[0] || null, activeAlerts, recentRuns: runs };
  }

  private auditPayload(action: AuditAction, actor: string, ticker?: string, metadata?: Record<string, unknown>) {
    return { action, actor, ticker: ticker || null, metadata: metadata || {}, createdAt: adminFieldValue.serverTimestamp(), createdAtIso: nowIso() };
  }
}

export const regulatoryRepository = new RegulatoryRepository();
