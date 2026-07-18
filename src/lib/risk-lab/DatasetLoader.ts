import type {
  EvidenceClassification,
  MetricObservation,
  MetricValue,
  RiskFamily,
  RiskSnapshot,
} from "../../types/riskLab";

export type DatasetQuality = "candidate" | "gold";

export interface RiskDatasetMetadata {
  id: string;
  version: string;
  quality: DatasetQuality;
  createdAt: string;
  description: string;
  limitations: string[];
}

export interface RiskDataset {
  metadata: RiskDatasetMetadata;
  snapshots: RiskSnapshot[];
}

const RISK_FAMILIES = new Set<RiskFamily>([
  "credit_high_yield",
  "development_equity",
  "brick",
  "fiagro_credit",
  "fiinfra_credit",
  "fiagro_land_equity",
]);

const EVIDENCE_CLASSIFICATIONS = new Set<EvidenceClassification>([
  "confirmed",
  "manager_declared",
  "inferred",
  "contradictory",
  "unverifiable",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string, context: string) {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${context}.${key} must be a non-empty string`);
  return value;
}

function validDate(value: string, context: string) {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${context} must be a valid ISO date: ${value}`);
  return value;
}

function validConfidence(value: unknown, context: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${context} must be a number from 0 to 100`);
  }
  return value;
}

function validMetricValue(value: unknown, context: string): MetricValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new Error(`${context} must be a finite number, string, boolean or null`);
}

export function loadRiskDataset(raw: unknown): RiskDataset {
  if (!isRecord(raw)) throw new Error("Risk dataset must be an object");
  if (!isRecord(raw.metadata)) throw new Error("Risk dataset metadata is required");

  const quality = requiredString(raw.metadata, "quality", "metadata");
  if (quality !== "candidate" && quality !== "gold") throw new Error(`Unsupported dataset quality: ${quality}`);

  const metadata: RiskDatasetMetadata = {
    id: requiredString(raw.metadata, "id", "metadata"),
    version: requiredString(raw.metadata, "version", "metadata"),
    quality,
    createdAt: validDate(requiredString(raw.metadata, "createdAt", "metadata"), "metadata.createdAt"),
    description: requiredString(raw.metadata, "description", "metadata"),
    limitations: Array.isArray(raw.metadata.limitations)
      ? raw.metadata.limitations.map((item, index) => {
          if (typeof item !== "string") throw new Error(`metadata.limitations[${index}] must be a string`);
          return item;
        })
      : [],
  };

  if (!Array.isArray(raw.snapshots) || !raw.snapshots.length) throw new Error("Risk dataset snapshots are required");

  const snapshots: RiskSnapshot[] = raw.snapshots.map((candidate, snapshotIndex) => {
    const context = `snapshots[${snapshotIndex}]`;
    if (!isRecord(candidate)) throw new Error(`${context} must be an object`);

    const family = requiredString(candidate, "family", context) as RiskFamily;
    if (!RISK_FAMILIES.has(family)) throw new Error(`${context}.family is unsupported: ${family}`);

    const asOf = validDate(requiredString(candidate, "asOf", context), `${context}.asOf`);
    const structuralRiskScore = candidate.structuralRiskScore;
    if (typeof structuralRiskScore !== "number" || !Number.isFinite(structuralRiskScore) || structuralRiskScore < 0 || structuralRiskScore > 100) {
      throw new Error(`${context}.structuralRiskScore must be between 0 and 100`);
    }
    if (!isRecord(candidate.observations)) throw new Error(`${context}.observations must be an object`);

    const observations: Record<string, MetricObservation> = Object.fromEntries(
      Object.entries(candidate.observations).map(([metricKey, observationRaw]) => {
        const observationContext = `${context}.observations.${metricKey}`;
        if (!isRecord(observationRaw)) throw new Error(`${observationContext} must be an object`);
        const metric = requiredString(observationRaw, "metric", observationContext);
        if (metric !== metricKey) throw new Error(`${observationContext}.metric must match its object key`);

        const competenceDate = validDate(
          requiredString(observationRaw, "competenceDate", observationContext),
          `${observationContext}.competenceDate`,
        );
        const knownAt = validDate(
          requiredString(observationRaw, "knownAt", observationContext),
          `${observationContext}.knownAt`,
        );
        if (Date.parse(knownAt) > Date.parse(asOf)) throw new Error(`${observationContext} introduces look-ahead bias`);

        if (!Array.isArray(observationRaw.evidence) || !observationRaw.evidence.length) {
          throw new Error(`${observationContext}.evidence must contain at least one reference`);
        }

        const evidence = observationRaw.evidence.map((evidenceRaw, evidenceIndex) => {
          const evidenceContext = `${observationContext}.evidence[${evidenceIndex}]`;
          if (!isRecord(evidenceRaw)) throw new Error(`${evidenceContext} must be an object`);
          const classification = requiredString(evidenceRaw, "classification", evidenceContext) as EvidenceClassification;
          if (!EVIDENCE_CLASSIFICATIONS.has(classification)) throw new Error(`${evidenceContext}.classification is unsupported`);

          const sourceUrl = typeof evidenceRaw.sourceUrl === "string" ? evidenceRaw.sourceUrl : undefined;
          const excerpt = typeof evidenceRaw.excerpt === "string" ? evidenceRaw.excerpt : undefined;
          const page = typeof evidenceRaw.page === "number" && Number.isInteger(evidenceRaw.page) && evidenceRaw.page > 0
            ? evidenceRaw.page
            : undefined;

          if (metadata.quality === "gold") {
            if (classification !== "confirmed") throw new Error(`${evidenceContext} must be confirmed in a gold dataset`);
            if (!sourceUrl) throw new Error(`${evidenceContext}.sourceUrl is required in a gold dataset`);
            if (!excerpt) throw new Error(`${evidenceContext}.excerpt is required in a gold dataset`);
          }

          return {
            documentId: requiredString(evidenceRaw, "documentId", evidenceContext),
            sourceUrl,
            page,
            excerpt,
            classification,
          };
        });

        const confidence = validConfidence(observationRaw.confidence, `${observationContext}.confidence`);
        if (metadata.quality === "gold" && confidence < 90) {
          throw new Error(`${observationContext}.confidence must be at least 90 in a gold dataset`);
        }

        return [metricKey, {
          metric,
          value: validMetricValue(observationRaw.value, `${observationContext}.value`),
          unit: typeof observationRaw.unit === "string" ? observationRaw.unit : undefined,
          competenceDate,
          knownAt,
          confidence,
          evidence,
        } satisfies MetricObservation];
      }),
    );

    return {
      ticker: requiredString(candidate, "ticker", context),
      family,
      asOf,
      structuralRiskScore,
      observations,
    };
  });

  return { metadata, snapshots };
}
