import { createHash } from "node:crypto";
import type {
  PortfolioIntelligenceInput,
  PortfolioIntelligenceResult,
} from "@/lib/portfolio-intelligence/PortfolioIntelligence";
import {
  createPortfolioIntelligenceReference,
  sanitizePortfolioIntelligenceReference,
  type PortfolioIntelligenceReference,
} from "@/lib/portfolio-intelligence/PortfolioIntelligenceIncremental";
import { PORTFOLIO_INTELLIGENCE_POLICY } from "@/lib/portfolio-intelligence/PortfolioIntelligencePolicy";
import { normalizePortfolioIntelligenceCanonicalInput } from "@/lib/portfolio-intelligence/PortfolioIntelligenceService";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, stableValue(item)]));
}

export function sha256PortfolioIntelligenceValue(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)), "utf8")
    .digest("hex");
}

function canonicalDataContent(input: PortfolioIntelligenceInput, asOf: string) {
  const normalized = normalizePortfolioIntelligenceCanonicalInput(input, asOf);
  return Object.freeze({
    schema: "portfolio-intelligence-source-v2",
    snapshots: Object.freeze(normalized.history.months.map((snapshot) => Object.freeze({
      competence: snapshot.competence,
      dividends: snapshot.value,
    }))),
    positions: Object.freeze(normalized.positions.map((position) => Object.freeze({
      ticker: position.ticker,
      quantity: position.quantity,
      price: position.price,
      estimatedIncome: position.estimatedIncome,
      segment: position.segment,
    }))),
  });
}

export class PortfolioIntelligenceReferenceFactory {
  create(
    result: PortfolioIntelligenceResult,
    canonicalInput: PortfolioIntelligenceInput,
  ): PortfolioIntelligenceReference {
    const dataFingerprint = sha256PortfolioIntelligenceValue(
      canonicalDataContent(canonicalInput, result.asOf),
    );
    const policyFingerprint = sha256PortfolioIntelligenceValue({
      schema: "portfolio-intelligence-policy-v2",
      policy: PORTFOLIO_INTELLIGENCE_POLICY,
    });
    const reference = createPortfolioIntelligenceReference(result, {
      dataFingerprint,
      policyFingerprint,
    });
    return sanitizePortfolioIntelligenceReference(reference);
  }
}
