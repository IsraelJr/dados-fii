import type { MetricValue, RiskAssessment } from "./riskLab";
import type { DatasetQuality, ProductionApprovalScope } from "../lib/risk-lab/DatasetLoader";

export type RiskLabReportMode = "historical_gold_admin_test";

export interface RiskLabEvidenceItem {
  metric: string;
  value: MetricValue;
  unit?: string;
  competenceDate: string;
  knownAt: string;
  confidence: number;
  documentId: string;
  sourceUrl: string;
  sourceType: "primary_regulatory" | "primary_manager";
  page: number;
  excerpt: string;
  publishedAt: string;
}

export interface RiskLabReport {
  id: string;
  schemaVersion: 1;
  status: "completed";
  ticker: string;
  mode: RiskLabReportMode;
  generatedAt: string;
  generatedBy: string;
  dataset: {
    id: string;
    version: string;
    quality: DatasetQuality;
    contentHash: string;
    approvalHash: string;
    scope: ProductionApprovalScope;
  };
  ruleSet: {
    version: string;
    contentHash: string;
  };
  assessment: RiskAssessment;
  evidence: RiskLabEvidenceItem[];
  reportMarkdown: string;
  premiumIntegrated: false;
  notificationsSent: false;
  productionScope: "admin_unit_test_only";
}

export interface RiskLabReportSummary {
  id: string;
  ticker: string;
  generatedAt: string;
  generatedBy: string;
  prudentialAlert: RiskAssessment["prudentialAlert"];
  deteriorationAlert: RiskAssessment["deteriorationAlert"];
  confidence: number;
  datasetVersion: string;
  ruleSetVersion: string;
}

export interface RiskLabAdminStatus {
  enabled: boolean;
  supportedTickers: string[];
  dataset: {
    id: string;
    version: string;
    quality: DatasetQuality;
    approved: boolean;
    scope: ProductionApprovalScope | null;
    approvalHash: string | null;
  };
  latestReport: RiskLabReport | null;
  recentReports: RiskLabReportSummary[];
}
