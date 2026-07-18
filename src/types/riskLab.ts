export type RiskFamily =
  | "credit_high_yield"
  | "development_equity"
  | "brick"
  | "fiagro_credit"
  | "fiinfra_credit"
  | "fiagro_land_equity";

export type AlertLevel = "green" | "yellow" | "orange" | "red" | "gray";
export type StructuralRiskLevel = "low" | "moderate" | "high" | "very_high";
export type RuleDimension = "structural" | "deterioration" | "transparency";
export type EvidenceClassification = "confirmed" | "manager_declared" | "inferred" | "contradictory" | "unverifiable";
export type MetricValue = number | string | boolean | null;

export interface EvidenceReference {
  documentId: string;
  sourceUrl?: string;
  page?: number;
  excerpt?: string;
  classification: EvidenceClassification;
}

export interface MetricObservation {
  metric: string;
  value: MetricValue;
  unit?: string;
  competenceDate: string;
  knownAt: string;
  confidence: number;
  evidence: EvidenceReference[];
}

export interface RiskSnapshot {
  ticker: string;
  family: RiskFamily;
  asOf: string;
  structuralRiskScore: number;
  observations: Record<string, MetricObservation | undefined>;
}

export interface RuleContext {
  snapshot: RiskSnapshot;
  history: RiskSnapshot[];
}

export interface RuleMatch {
  message: string;
  confidence: number;
  evidenceMetrics: string[];
}

export interface RiskRule {
  id: string;
  version: string;
  title: string;
  description: string;
  families: Array<RiskFamily | "common">;
  dimension: RuleDimension;
  alert: Exclude<AlertLevel, "green" | "gray">;
  weight: number;
  evaluate(context: RuleContext): RuleMatch | null;
}

export interface RuleHit extends RuleMatch {
  ruleId: string;
  ruleVersion: string;
  title: string;
  dimension: RuleDimension;
  alert: Exclude<AlertLevel, "green" | "gray">;
  weight: number;
}

export interface RiskAssessment {
  ticker: string;
  family: RiskFamily;
  asOf: string;
  structuralRisk: StructuralRiskLevel;
  deteriorationAlert: AlertLevel;
  prudentialAlert: AlertLevel;
  deteriorationScore: number;
  confidence: number;
  hits: RuleHit[];
}

export interface BacktestResult {
  ticker: string;
  rows: RiskAssessment[];
}
