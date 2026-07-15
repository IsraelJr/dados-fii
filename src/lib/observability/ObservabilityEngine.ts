import type { SystemObservability, OperationMetric } from "../../types/observability";
import type { CacheMetrics, ParserHealth, RegulatoryAuditEvent, SystemHealth, ValidationRun } from "../../types/regulatory";

type MutableMetric = Omit<OperationMetric, "averageDurationMs">;

type SnapshotInput = {
  health: SystemHealth;
  parsers: ParserHealth[];
  latestValidation: ValidationRun | null;
  auditEvents: RegulatoryAuditEvent[];
  fundCache: CacheMetrics;
  marketCache: CacheMetrics;
  aiCache: { hitRate?: number };
  generatedAt?: string;
};

function message(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "Falha desconhecida.";
}

export class ObservabilityEngine {
  private readonly startedAt = Date.now();
  private readonly metrics = new Map<string, MutableMetric>();

  private metric(operation: string) {
    const existing = this.metrics.get(operation);
    if (existing) return existing;
    const created: MutableMetric = {
      operation,
      requests: 0,
      successes: 0,
      failures: 0,
      retries: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
      lastDurationMs: 0,
      lastStartedAt: null,
      lastFinishedAt: null,
      lastError: null,
    };
    this.metrics.set(operation, created);
    return created;
  }

  async track<T>(operation: string, task: () => Promise<T>): Promise<T> {
    const current = this.metric(operation);
    const startedAt = Date.now();
    current.requests += 1;
    current.lastStartedAt = new Date(startedAt).toISOString();
    try {
      const result = await task();
      current.successes += 1;
      current.lastError = null;
      return result;
    } catch (error) {
      current.failures += 1;
      current.lastError = message(error);
      throw error;
    } finally {
      const duration = Date.now() - startedAt;
      current.totalDurationMs += duration;
      current.lastDurationMs = duration;
      current.maxDurationMs = Math.max(current.maxDurationMs, duration);
      current.lastFinishedAt = new Date().toISOString();
    }
  }

  recordRetry(operation: string) {
    this.metric(operation).retries += 1;
  }

  operations(): OperationMetric[] {
    return Array.from(this.metrics.values())
      .map((item) => ({ ...item, averageDurationMs: item.requests ? Math.round(item.totalDurationMs / item.requests) : 0 }))
      .sort((a, b) => b.requests - a.requests || a.operation.localeCompare(b.operation));
  }

  snapshot(input: SnapshotInput): SystemObservability {
    const operations = this.operations();
    const totals = operations.reduce((result, item) => ({
      requests: result.requests + item.requests,
      successes: result.successes + item.successes,
      failures: result.failures + item.failures,
      retries: result.retries + item.retries,
      duration: result.duration + item.totalDurationMs,
      maxDuration: Math.max(result.maxDuration, item.maxDurationMs),
    }), { requests: 0, successes: 0, failures: 0, retries: 0, duration: 0, maxDuration: 0 });
    const latest = input.latestValidation;
    const parserSuccesses = input.parsers.reduce((sum, parser) => sum + parser.successes, 0);
    const parserFailures = input.parsers.reduce((sum, parser) => sum + parser.failures, 0);
    const parserTotal = parserSuccesses + parserFailures;
    const publicationEvents = input.auditEvents.filter((event) => event.action === "publish");
    const rollbackEvents = input.auditEvents.filter((event) => event.action === "rollback");
    const publicationFailures = operations
      .filter((item) => item.operation === "regulatory.publish" || item.operation === "regulatory.rollback")
      .reduce((sum, item) => sum + item.failures, 0);
    const lastEventAt = input.auditEvents
      .map((event) => event.createdAt)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => b.localeCompare(a))[0] || null;
    const latestValidation = latest ? (({ results: _results, ...summary }) => summary)(latest) : null;

    return {
      generatedAt: input.generatedAt || new Date().toISOString(),
      uptimeSeconds: Math.max(0, Math.floor((Date.now() - this.startedAt) / 1000)),
      summary: {
        requests: totals.requests,
        successes: totals.successes,
        failures: totals.failures,
        retries: totals.retries,
        averageDurationMs: totals.requests ? Math.round(totals.duration / totals.requests) : 0,
        maxDurationMs: totals.maxDuration,
      },
      operations,
      ingestion: {
        status: latest?.status || "unknown",
        processed: latest?.totals.processed || 0,
        valid: latest?.totals.valid || 0,
        invalid: latest?.totals.invalid || 0,
        latestRunAt: latest?.finishedAt || null,
      },
      parser: {
        healthy: input.parsers.filter((parser) => parser.status === "healthy").length,
        degraded: input.parsers.filter((parser) => parser.status === "degraded").length,
        down: input.parsers.filter((parser) => parser.status === "down").length,
        successRate: parserTotal ? Math.round((parserSuccesses / parserTotal) * 10_000) / 100 : 0,
      },
      qa: {
        healthScore: latest?.healthScore || 0,
        errors: latest?.totals.errors || 0,
        warnings: latest?.totals.warnings || 0,
        status: latest?.status || "unknown",
      },
      publication: {
        publications: publicationEvents.length,
        rollbacks: rollbackEvents.length,
        failures: publicationFailures,
        lastEventAt,
      },
      cache: {
        fundHitRate: input.fundCache.hitRate,
        marketHitRate: input.marketCache.hitRate,
        aiHitRate: Number(input.aiCache.hitRate || 0),
      },
      health: input.health,
      latestValidation,
    };
  }
}

export const observabilityEngine = new ObservabilityEngine();
