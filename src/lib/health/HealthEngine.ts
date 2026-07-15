import type {
  CacheMetrics,
  HealthComponent,
  HealthStatus,
  ParserHealth,
  RegulatoryAuditEvent,
  RepositoryProbe,
  SystemHealth,
  ValidationRun,
} from "../../types/regulatory";

type HealthInput = {
  generatedAt: string;
  firestore: RepositoryProbe;
  parsers: ParserHealth[];
  latestValidation: ValidationRun | null;
  auditEvents: RegulatoryAuditEvent[];
  fundCache: CacheMetrics;
  marketCache: CacheMetrics;
  scoreProbe: { enabled: boolean; ok: boolean; version: string; error?: string };
  ttlMs: number;
  marketTtlMs: number;
  collections: Record<string, string>;
};

const WEIGHTS: Record<keyof SystemHealth["components"], number> = {
  firestore: 20,
  parser: 15,
  qa: 20,
  publication: 15,
  rollback: 10,
  cache: 10,
  score: 10,
};

function component(status: HealthStatus, score: number, message: string, checkedAt: string, extra?: Partial<HealthComponent>): HealthComponent {
  return { status, score: Math.round(Math.max(0, Math.min(100, score))), message, checkedAt, ...extra };
}

function ageInHours(value: string | null, now: string) {
  if (!value) return null;
  const age = new Date(now).getTime() - new Date(value).getTime();
  return Number.isFinite(age) ? Math.max(0, age / 3_600_000) : null;
}

function recencyScore(hours: number | null, healthyHours: number, staleHours: number) {
  if (hours === null) return 50;
  if (hours <= healthyHours) return 100;
  if (hours >= staleHours) return 55;
  return 100 - ((hours - healthyHours) / (staleHours - healthyHours)) * 45;
}

function statusFor(score: number): HealthStatus {
  if (score >= 80) return "healthy";
  if (score >= 50) return "degraded";
  return "down";
}

export class HealthEngine {
  evaluate(input: HealthInput): SystemHealth {
    const { generatedAt } = input;
    const latestPublication = input.auditEvents.find((event) => event.action === "publish") || null;
    const latestRollback = input.auditEvents.find((event) => event.action === "rollback") || null;

    const firestore = input.firestore.ok
      ? component("healthy", 100, "Firestore respondeu à leitura regulatória.", generatedAt, { latencyMs: input.firestore.latencyMs, metadata: { legacyFundsAvailable: input.firestore.legacyFundsAvailable } })
      : component("down", 0, input.firestore.error || "Firestore indisponível.", generatedAt, { latencyMs: input.firestore.latencyMs });

    const parserScore = input.parsers.length
      ? input.parsers.reduce((sum, parser) => sum + parser.successRate, 0) / input.parsers.length
      : 50;
    const parserStatus: HealthStatus = !input.parsers.length
      ? "unknown"
      : input.parsers.some((parser) => parser.status === "down") ? "down" : statusFor(parserScore);
    const parser = component(parserStatus, parserScore, input.parsers.length ? `${input.parsers.length} fonte(s) monitorada(s).` : "Nenhuma execução de parser registrada.", generatedAt, { metadata: { monitored: input.parsers.length } });

    const qaScore = input.latestValidation?.healthScore ?? 50;
    const qa = component(
      input.latestValidation ? statusFor(qaScore) : "unknown",
      qaScore,
      input.latestValidation ? `${input.latestValidation.totals.valid}/${input.latestValidation.totals.processed} fundos válidos na última execução.` : "Nenhuma validação completa registrada.",
      generatedAt,
      { metadata: { runId: input.latestValidation?.id || null, errors: input.latestValidation?.totals.errors || 0, warnings: input.latestValidation?.totals.warnings || 0 } },
    );

    const publicationAge = ageInHours(latestPublication?.createdAt || null, generatedAt);
    const publicationScore = recencyScore(publicationAge, 24 * 7, 24 * 30);
    const publication = component(
      latestPublication ? statusFor(publicationScore) : "unknown",
      publicationScore,
      latestPublication ? `Última publicação: ${latestPublication.ticker || "sem ticker"}.` : "Nenhuma publicação registrada na nova trilha de auditoria.",
      generatedAt,
      { metadata: { ticker: latestPublication?.ticker || null, ageHours: publicationAge === null ? null : Math.round(publicationAge) } },
    );

    const rollbackAge = ageInHours(latestRollback?.createdAt || null, generatedAt);
    const rollback = component(
      latestRollback ? "healthy" : "unknown",
      latestRollback ? 100 : 75,
      latestRollback ? `Último rollback auditado para ${latestRollback.ticker || "ticker não informado"}.` : "Mecanismo disponível; nenhum rollback registrado na nova trilha.",
      generatedAt,
      { metadata: { ticker: latestRollback?.ticker || null, ageHours: rollbackAge === null ? null : Math.round(rollbackAge) } },
    );

    const totalRequests = input.fundCache.hits + input.fundCache.misses;
    const cacheScore = input.fundCache.entries <= input.fundCache.maxEntries && input.marketCache.entries <= input.marketCache.maxEntries ? 100 : 40;
    const cache = component(statusFor(cacheScore), cacheScore, "Caches regulatórios dentro dos limites configurados.", generatedAt, {
      metadata: { entries: input.fundCache.entries + input.marketCache.entries, requests: totalRequests, hitRate: input.fundCache.hitRate },
    });

    const score = input.scoreProbe.enabled
      ? component(input.scoreProbe.ok ? "healthy" : "down", input.scoreProbe.ok ? 100 : 0, input.scoreProbe.ok ? `ScoreEngine ${input.scoreProbe.version} operacional.` : input.scoreProbe.error || "ScoreEngine falhou no autoteste.", generatedAt)
      : component("disabled", 50, "ScoreEngine desabilitado por feature flag.", generatedAt);

    const components = { firestore, parser, qa, publication, rollback, cache, score };
    const overall = Object.entries(WEIGHTS).reduce((sum, [key, weight]) => sum + components[key as keyof typeof components].score * weight / 100, 0);
    const hasDown = Object.values(components).some((item) => item.status === "down");
    const overallStatus = hasDown ? "down" : statusFor(overall);
    const latestValidation = input.latestValidation
      ? Object.fromEntries(Object.entries(input.latestValidation).filter(([key]) => key !== "results")) as Omit<ValidationRun, "results">
      : null;

    return {
      ok: overall >= 80 && !hasDown,
      status: overallStatus,
      score: Math.round(overall),
      generatedAt,
      components,
      latestValidation,
      parsers: input.parsers,
      cache: {
        entries: input.fundCache.entries,
        ttlMs: input.ttlMs,
        marketTtlMs: input.marketTtlMs,
        funds: input.fundCache,
        market: input.marketCache,
      },
      collections: input.collections,
    };
  }
}

export const healthEngine = new HealthEngine();
