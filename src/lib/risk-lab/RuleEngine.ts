import type {
  AlertLevel,
  MetricObservation,
  RiskAssessment,
  RiskRule,
  RiskSnapshot,
  RuleHit,
  StructuralRiskLevel,
} from "../../types/riskLab";

const ALERT_RANK: Record<AlertLevel, number> = {
  gray: -1,
  green: 0,
  yellow: 1,
  orange: 2,
  red: 3,
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function structuralLevel(score: number): StructuralRiskLevel {
  if (score >= 85) return "very_high";
  if (score >= 65) return "high";
  if (score >= 35) return "moderate";
  return "low";
}

function maxAlert(alerts: AlertLevel[]): AlertLevel {
  if (!alerts.length) return "green";
  return alerts.reduce((current, candidate) => ALERT_RANK[candidate] > ALERT_RANK[current] ? candidate : current, "green");
}

function observationConfidence(observations: Record<string, MetricObservation | undefined>) {
  const values = Object.values(observations).filter((item): item is MetricObservation => Boolean(item));
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, item) => sum + clamp(item.confidence), 0) / values.length);
}

export class RiskRuleEngine {
  constructor(private readonly rules: RiskRule[]) {}

  evaluate(snapshot: RiskSnapshot, history: RiskSnapshot[] = []): RiskAssessment {
    this.assertNoLookAhead(snapshot);
    const eligibleRules = this.rules.filter((rule) => rule.families.includes("common") || rule.families.includes(snapshot.family));
    const hits: RuleHit[] = [];

    for (const rule of eligibleRules) {
      const match = rule.evaluate({ snapshot, history });
      if (!match) continue;
      hits.push({
        ...match,
        ruleId: rule.id,
        ruleVersion: rule.version,
        title: rule.title,
        dimension: rule.dimension,
        alert: rule.alert,
        weight: rule.weight,
      });
    }

    const deteriorationHits = hits.filter((hit) => hit.dimension !== "structural");
    const deteriorationAlert = maxAlert(deteriorationHits.map((hit) => hit.alert));
    const prudentialAlert = maxAlert(hits.map((hit) => hit.alert));
    const deteriorationScore = Math.round(clamp(deteriorationHits.reduce((sum, hit) => sum + hit.weight, 0)));
    const hitConfidence = hits.length
      ? hits.reduce((sum, hit) => sum + clamp(hit.confidence), 0) / hits.length
      : observationConfidence(snapshot.observations);

    return {
      ticker: snapshot.ticker,
      family: snapshot.family,
      asOf: snapshot.asOf,
      structuralRisk: structuralLevel(snapshot.structuralRiskScore),
      deteriorationAlert,
      prudentialAlert,
      deteriorationScore,
      confidence: Math.round(clamp(hitConfidence)),
      hits: hits.sort((a, b) => ALERT_RANK[b.alert] - ALERT_RANK[a.alert] || b.weight - a.weight),
    };
  }

  private assertNoLookAhead(snapshot: RiskSnapshot) {
    const asOf = Date.parse(snapshot.asOf);
    if (!Number.isFinite(asOf)) throw new Error(`Invalid snapshot.asOf: ${snapshot.asOf}`);

    for (const observation of Object.values(snapshot.observations)) {
      if (!observation) continue;
      const knownAt = Date.parse(observation.knownAt);
      if (!Number.isFinite(knownAt)) throw new Error(`Invalid knownAt for ${observation.metric}: ${observation.knownAt}`);
      if (knownAt > asOf) {
        throw new Error(`Look-ahead bias detected for ${snapshot.ticker}/${observation.metric}: knownAt ${observation.knownAt} is after ${snapshot.asOf}`);
      }
    }
  }
}
