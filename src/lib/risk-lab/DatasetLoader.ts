import type {
  EvidenceClassification,
  EvidenceReviewMethod,
  EvidenceSourceType,
  MetricObservation,
  MetricValue,
  RiskFamily,
  RiskSnapshot,
} from "../../types/riskLab";

export type DatasetQuality = "candidate" | "gold";
export type ProductionApprovalScope = "admin_unit_test_only" | "production";

export interface RiskDatasetProductionApproval {
  approvedAt: string;
  approvedBy: string;
  approvalReason: string;
  approvalHash: string;
  allowedTickers: string[];
  scope: ProductionApprovalScope;
}

export interface RiskDatasetMetadata {
  id: string;
  version: string;
  quality: DatasetQuality;
  createdAt: string;
  description: string;
  limitations: string[];
  productionApproved: boolean;
  productionApproval?: RiskDatasetProductionApproval;
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

const EVIDENCE_SOURCE_TYPES = new Set<EvidenceSourceType>([
  "primary_regulatory",
  "primary_manager",
  "secondary",
]);

const EVIDENCE_REVIEW_METHODS = new Set<EvidenceReviewMethod>([
  "manual_document_review",
  "automated_extraction",
]);

const PRODUCTION_APPROVAL_SCOPES = new Set<ProductionApprovalScope>([
  "admin_unit_test_only",
  "production",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string, context: string) {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${context}.${key} must be a non-empty string`);
  return value;
}

function optionalString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function validDate(value: string, context: string) {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${context} must be a valid ISO date: ${value}`);
  return value;
}

function optionalDate(record: Record<string, unknown>, key: string, context: string) {
  const value = optionalString(record, key);
  return value ? validDate(value, `${context}.${key}`) : undefined;
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

function validOptionalPage(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function parseProductionApproval(raw: Record<string, unknown>, productionApproved: boolean) {
  const candidate = raw.productionApproval;
  if (!productionApproved) {
    if (candidate !== undefined) throw new Error("metadata.productionApproval requires productionApproved=true");
    return undefined;
  }
  if (!isRecord(candidate)) throw new Error("metadata.productionApproval is required for production approval");

  const scope = requiredString(candidate, "scope", "metadata.productionApproval") as ProductionApprovalScope;
  if (!PRODUCTION_APPROVAL_SCOPES.has(scope)) throw new Error(`Unsupported production approval scope: ${scope}`);

  const approvalHash = requiredString(candidate, "approvalHash", "metadata.productionApproval");
  if (!/^[a-f0-9]{64}$/i.test(approvalHash)) throw new Error("metadata.productionApproval.approvalHash must be a SHA-256 hex hash");

  if (!Array.isArray(candidate.allowedTickers) || !candidate.allowedTickers.length) {
    throw new Error("metadata.productionApproval.allowedTickers must contain at least one ticker");
  }
  const allowedTickers = [...new Set(candidate.allowedTickers.map((item, index) => {
    if (typeof item !== "string" || !/^[A-Z0-9]{4,12}$/.test(item.trim().toUpperCase())) {
      throw new Error(`metadata.productionApproval.allowedTickers[${index}] is invalid`);
    }
    return item.trim().toUpperCase();
  }))];

  return {
    approvedAt: validDate(requiredString(candidate, "approvedAt", "metadata.productionApproval"), "metadata.productionApproval.approvedAt"),
    approvedBy: requiredString(candidate, "approvedBy", "metadata.productionApproval"),
    approvalReason: requiredString(candidate, "approvalReason", "metadata.productionApproval"),
    approvalHash,
    allowedTickers,
    scope,
  } satisfies RiskDatasetProductionApproval;
}

export function loadRiskDataset(raw: unknown): RiskDataset {
  if (!isRecord(raw)) throw new Error("Risk dataset must be an object");
  if (!isRecord(raw.metadata)) throw new Error("Risk dataset metadata is required");

  const quality = requiredString(raw.metadata, "quality", "metadata");
  if (quality !== "candidate" && quality !== "gold") throw new Error(`Unsupported dataset quality: ${quality}`);

  const productionApproved = raw.metadata.productionApproved === true;
  if (productionApproved && quality !== "gold") {
    throw new Error("Only gold datasets can be approved for production");
  }
  const productionApproval = parseProductionApproval(raw.metadata, productionApproved);

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
    productionApproved,
    productionApproval,
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

          const sourceTypeRaw = optionalString(evidenceRaw, "sourceType");
          const sourceType = sourceTypeRaw as EvidenceSourceType | undefined;
          if (sourceType && !EVIDENCE_SOURCE_TYPES.has(sourceType)) {
            throw new Error(`${evidenceContext}.sourceType is unsupported`);
          }

          const reviewMethodRaw = optionalString(evidenceRaw, "reviewMethod");
          const reviewMethod = reviewMethodRaw as EvidenceReviewMethod | undefined;
          if (reviewMethod && !EVIDENCE_REVIEW_METHODS.has(reviewMethod)) {
            throw new Error(`${evidenceContext}.reviewMethod is unsupported`);
          }

          const sourceUrl = optionalString(evidenceRaw, "sourceUrl");
          const excerpt = optionalString(evidenceRaw, "excerpt");
          const page = validOptionalPage(evidenceRaw.page);
          const publishedAt = optionalDate(evidenceRaw, "publishedAt", evidenceContext);
          const reviewedAt = optionalDate(evidenceRaw, "reviewedAt", evidenceContext);
          const reviewedBy = optionalString(evidenceRaw, "reviewedBy");

          if (publishedAt && Date.parse(knownAt) < Date.parse(publishedAt)) {
            throw new Error(`${evidenceContext}.publishedAt cannot be after observation knownAt`);
          }
          if (reviewedAt && Date.parse(reviewedAt) < Date.parse(knownAt)) {
            throw new Error(`${evidenceContext}.reviewedAt cannot be before observation knownAt`);
          }

          if (metadata.quality === "gold") {
            if (classification !== "confirmed") throw new Error(`${evidenceContext} must be confirmed in a gold dataset`);
            if (sourceType !== "primary_regulatory" && sourceType !== "primary_manager") {
              throw new Error(`${evidenceContext}.sourceType must be primary in a gold dataset`);
            }
            if (!sourceUrl) throw new Error(`${evidenceContext}.sourceUrl is required in a gold dataset`);
            if (!page) throw new Error(`${evidenceContext}.page is required in a gold dataset`);
            if (!excerpt) throw new Error(`${evidenceContext}.excerpt is required in a gold dataset`);
            if (!publishedAt) throw new Error(`${evidenceContext}.publishedAt is required in a gold dataset`);
            if (!reviewedAt) throw new Error(`${evidenceContext}.reviewedAt is required in a gold dataset`);
            if (!reviewedBy) throw new Error(`${evidenceContext}.reviewedBy is required in a gold dataset`);
            if (reviewMethod !== "manual_document_review") {
              throw new Error(`${evidenceContext}.reviewMethod must be manual_document_review in a gold dataset`);
            }
          }

          return {
            documentId: requiredString(evidenceRaw, "documentId", evidenceContext),
            sourceUrl,
            sourceType,
            page,
            excerpt,
            publishedAt,
            reviewedAt,
            reviewedBy,
            reviewMethod,
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
      ticker: requiredString(candidate, "ticker", context).trim().toUpperCase(),
      family,
      asOf,
      structuralRiskScore,
      observations,
    };
  });

  if (metadata.productionApproval) {
    const datasetTickers = [...new Set(snapshots.map((snapshot) => snapshot.ticker))];
    for (const ticker of datasetTickers) {
      if (!metadata.productionApproval.allowedTickers.includes(ticker)) {
        throw new Error(`Production-approved dataset contains disallowed ticker: ${ticker}`);
      }
    }
    for (const ticker of metadata.productionApproval.allowedTickers) {
      if (!datasetTickers.includes(ticker)) {
        throw new Error(`Production approval references missing ticker: ${ticker}`);
      }
    }
  }

  return { metadata, snapshots };
}
