import type {
  FundKind,
  MarketQuote,
  ParserHealth,
  RegulatoryFund,
  ValidationCheck,
  ValidationFundResult,
  ValidationIssue,
  ValidationRun,
} from "../../types/regulatory";
import type { LegacyFundRecord, RegulatoryOverlay } from "../regulatory/RegulatoryTypes";

type RunnerDependencies = {
  canonicalFrom: (ticker: string, legacy: Record<string, unknown>, overlay?: Record<string, unknown> | null) => RegulatoryFund;
  normalizeTicker: (value: unknown) => string;
  validateFund: (fund: RegulatoryFund) => ValidationIssue[];
  now: () => string;
};

type ValidationInput = {
  id: string;
  actor: string;
  startedAt: string;
  startedMs: number;
  legacyRecords: LegacyFundRecord[];
  overlayRecords: Array<{ id: string; data: RegulatoryOverlay }>;
  market: { items: MarketQuote[]; error: string | null };
  scoreProbe: { enabled: boolean; ok: boolean; error?: string };
};

function parser(now: string, name: string, status: ParserHealth["status"], successes: number, failures: number, error: string | null): ParserHealth {
  const total = successes + failures;
  return {
    parser: name,
    status,
    successRate: total ? Math.round((successes / total) * 100) : 0,
    successes,
    failures,
    lastSuccessAt: successes ? now : null,
    lastFailureAt: failures ? now : null,
    lastError: error,
    updatedAt: now,
  };
}

function check(id: string, status: ValidationCheck["status"], message: string, metadata?: ValidationCheck["metadata"]): ValidationCheck {
  return { id, status, message, metadata };
}

export class ValidationRunner {
  private readonly dependencies: RunnerDependencies;

  constructor(dependencies: RunnerDependencies) {
    this.dependencies = dependencies;
  }

  complete(input: ValidationInput): ValidationRun {
    const { canonicalFrom, normalizeTicker, validateFund, now } = this.dependencies;
    const overlayMap = new Map(input.overlayRecords.map(({ id, data }) => [normalizeTicker(id || data.ticker), data]));
    const funds = input.legacyRecords
      .map(({ id, data }) => ({ ticker: normalizeTicker(data.code || id), data }))
      .filter((item) => item.ticker);
    const results: ValidationFundResult[] = funds.map(({ ticker, data }) => {
      const fund = canonicalFrom(ticker, data, overlayMap.get(ticker));
      const issues = validateFund(fund);
      return { ticker, kind: fund.kind, valid: !issues.some((issue) => issue.severity === "error"), issues };
    });
    const errors = results.reduce((total, item) => total + item.issues.filter((issue) => issue.severity === "error").length, 0);
    const warnings = results.reduce((total, item) => total + item.issues.filter((issue) => issue.severity === "warning").length, 0);
    const valid = results.filter((item) => item.valid).length;
    const finishedAt = now();
    const parserHealth: ParserHealth[] = [
      parser(finishedAt, "legacy-firestore", funds.length ? "healthy" : "down", funds.length, funds.length ? 0 : 1, null),
      parser(finishedAt, "regulatory-overlay", input.overlayRecords.length || funds.length ? "healthy" : "unknown", input.overlayRecords.length || funds.length, 0, null),
      parser(finishedAt, "google-sheets", input.market.error ? "down" : input.market.items.length ? "healthy" : "degraded", input.market.items.length, input.market.error ? 1 : 0, input.market.error),
    ];
    const coverage = results.reduce((accumulator, result) => {
      const key: Record<FundKind, keyof typeof accumulator> = { FII: "fii", FIAGRO: "fiagro", FI_INFRA: "fiInfra", UNKNOWN: "unknown" };
      accumulator[key[result.kind]] += 1;
      return accumulator;
    }, { fii: 0, fiagro: 0, fiInfra: 0, unknown: 0 });
    const checks: ValidationCheck[] = [
      check("regulatory-records", funds.length ? "passed" : "failed", funds.length ? `${funds.length} registro(s) processado(s).` : "Nenhum fundo regulatório encontrado.", { processed: funds.length }),
      check("fund-kind-coverage", coverage.fii > 0 && coverage.fiagro > 0 ? "passed" : "warning", `Cobertura: ${coverage.fii} FII(s), ${coverage.fiagro} FIAGRO(s), ${coverage.fiInfra} FI-Infra.`, coverage),
      check("market-source", input.market.error ? "failed" : input.market.items.length ? "passed" : "warning", input.market.error || `${input.market.items.length} cotação(ões) carregada(s).`, { quotes: input.market.items.length }),
      check("score-engine", !input.scoreProbe.enabled ? "warning" : input.scoreProbe.ok ? "passed" : "failed", !input.scoreProbe.enabled ? "ScoreEngine desabilitado por feature flag." : input.scoreProbe.ok ? "ScoreEngine passou no autoteste." : input.scoreProbe.error || "ScoreEngine falhou no autoteste."),
    ];
    const dataScore = results.length ? (valid / results.length) * 75 : 0;
    const parserScore = parserHealth.reduce((sum, item) => sum + item.successRate, 0) / Math.max(parserHealth.length, 1) * 0.15;
    const systemScore = checks.filter((item) => item.status === "passed").length / checks.length * 10;
    return {
      id: input.id,
      status: checks.some((item) => item.status === "failed") ? "failed" : "completed",
      startedAt: input.startedAt,
      finishedAt,
      durationMs: Date.now() - input.startedMs,
      actor: input.actor,
      totals: { processed: results.length, valid, invalid: results.length - valid, errors, warnings },
      healthScore: Math.round(Math.max(0, Math.min(100, dataScore + parserScore + systemScore))),
      results,
      parserHealth,
      checks,
      coverage,
      ...(checks.some((item) => item.status === "failed") ? { error: "Uma ou mais verificações sistêmicas falharam." } : {}),
    };
  }

  failed(input: { id: string; actor: string; startedAt: string; startedMs: number; error: string }): ValidationRun {
    return {
      id: input.id,
      status: "failed",
      startedAt: input.startedAt,
      finishedAt: this.dependencies.now(),
      durationMs: Date.now() - input.startedMs,
      actor: input.actor,
      totals: { processed: 0, valid: 0, invalid: 0, errors: 1, warnings: 0 },
      healthScore: 0,
      results: [],
      parserHealth: [],
      checks: [check("validation-runner", "failed", input.error)],
      coverage: { fii: 0, fiagro: 0, fiInfra: 0, unknown: 0 },
      error: input.error,
    };
  }
}
