import type { RegulatorySource } from "@/types/regulatory";
import type { CanonicalFundCatalogEntry } from "@/types/fund-catalog";

export const REGULATORY_COLLECTIONS = {
  legacyFunds: "Fiis",
  funds: "RegulatoryFunds",
  versions: "RegulatoryFundVersions",
  backups: "RegulatoryFundBackups",
  validationRuns: "RegulatoryValidationRuns",
  parserHealth: "RegulatoryParserHealth",
  auditLogs: "RegulatoryAuditLogs",
  timelineEvents: "RegulatoryTimelineEvents",
  monitorRuns: "RegulatoryMonitorRuns",
  monitorAlerts: "RegulatoryMonitorAlerts",
  monitorLocks: "RegulatoryMonitorLocks",
  indexCompositions: "RegulatoryIndexCompositions",
  catalogRuns: "RegulatoryCatalogRuns",
  catalogAudits: "RegulatoryCatalogAudits",
  catalogDirectory: "RegulatoryCatalogDirectory",
} as const;

export type LegacyFundRecord = {
  id: string;
  data: Record<string, unknown>;
};

export type RegulatoryOverlay = Record<string, unknown> & {
  ticker?: string;
  currentVersion?: number;
  sources?: RegulatorySource[];
  catalog?: CanonicalFundCatalogEntry;
};

export type PublicationAuthorization = {
  actor: string;
  approvalHash: string;
  approvedAt: string;
  backupId: string;
  reason: string;
};

export type RollbackAuthorization = PublicationAuthorization;

export type CacheState = "hit" | "miss";
