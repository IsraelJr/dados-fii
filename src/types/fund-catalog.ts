import type { FundKind } from "@/types/regulatory";

export const FUND_CATALOG_SCHEMA_VERSION = 2 as const;

export type CatalogLifecycleStatus = "active" | "inactive" | "under_review";
export type CatalogMatchMethod = "isin" | "existing-cnpj" | "public-directory-cnpj" | "name" | "registration-cnpj" | "unmatched";
export type CatalogPlanAction = "add" | "update" | "inactivate" | "reactivate";
export type CatalogRunStatus = "preview" | "applying" | "applied" | "failed";

export type CatalogSourceSnapshot = {
  id: "b3-instruments" | "cvm-registration" | "cvm-monthly" | "cvm-fiagro-monthly" | "cvm-daily" | "public-fund-directory";
  provider: string;
  url: string;
  fetchedAt: string;
  referenceDate: string | null;
  sha256: string;
  bytes: number;
};

export type CatalogServiceProvider = {
  name: string;
  cnpj: string | null;
};

export type CatalogInvestorComposition = {
  referenceDate: string;
  totalAccounts: number;
  individualAccounts: number | null;
  legalEntityAccounts: number | null;
  legalEntityCategories: {
    nonFinancial: number | null;
    commercialBanks: number | null;
    brokersAndDistributors: number | null;
    otherFinancial: number | null;
    nonResidents: number | null;
    openPension: number | null;
    closedPension: number | null;
    publicPension: number | null;
    insurersAndReinsurers: number | null;
    capitalizationAndLeasing: number | null;
    realEstateFunds: number | null;
    otherFunds: number | null;
    distributors: number | null;
    other: number | null;
  };
  largestLegalEntityHolder: {
    name: string;
    document: string | null;
    ownershipPercent: number | null;
    source: string;
  } | null;
};

export type CatalogCapital = {
  referenceDate: string;
  netWorth: number | null;
  issuedShares: number | null;
  reportedNavPerShare: number | null;
};

export type CatalogPortfolio = {
  referenceDate: string;
  totalInvested: number | null;
  directRealEstate: number;
  creditReceivables: number;
  equityHoldings: number;
  fundShares: number;
  fixedIncomeAndCash: number;
  otherAssets: number;
};

export type CatalogDataQuality = {
  basicComplete: boolean;
  essentialComplete: boolean;
  applicableToEssentialTarget: boolean;
  missingBasic: string[];
  missingEssential: string[];
  warnings: string[];
};

export type CanonicalFundCatalogEntry = {
  schemaVersion: typeof FUND_CATALOG_SCHEMA_VERSION;
  ticker: string;
  identity: {
    cnpj: string;
    isin: string | null;
    cvmCode: string | null;
    legalName: string;
    tradeName: string | null;
    kind: FundKind;
  };
  serviceProviders: {
    administrator: CatalogServiceProvider;
    managers: CatalogServiceProvider[];
    managementModel: "external-manager" | "administrator-managed" | "not-reported";
  };
  classification: {
    sector: string;
    segment: string;
    strategy: string;
    declaredSegment: string | null;
    regulatoryClassification: string | null;
    mandate: string | null;
    managementType: string | null;
    targetAudience: string | null;
    condominiumForm: string | null;
    exclusive: boolean | null;
    isFundOfFunds: boolean | null;
    confidence: "high" | "medium" | "low";
    method: "portfolio-composition" | "fund-kind" | "declared";
  };
  capital: CatalogCapital | null;
  investors: CatalogInvestorComposition | null;
  portfolio: CatalogPortfolio | null;
  lifecycle: {
    status: CatalogLifecycleStatus;
    cvmStatus: string;
    b3Listed: boolean;
    operatingSince: string | null;
    canceledAt: string | null;
    lastSeenOnB3: string | null;
    missingB3Observations: number;
    replacedByTicker: string | null;
    previousTickers: string[];
    reason: string;
  };
  provenance: {
    catalogRunId: string;
    matchMethod: CatalogMatchMethod;
    matchConfidence: number;
    sourceIds: CatalogSourceSnapshot["id"][];
    referenceDate: string | null;
    generatedAt: string;
  };
  dataQuality: CatalogDataQuality;
  contentHash: string;
};

export type FundCatalogPlanItem = {
  ticker: string;
  action: CatalogPlanAction;
  reasons: string[];
  previousContentHash: string | null;
  catalog: CanonicalFundCatalogEntry;
};

export type FundCatalogCoverage = {
  b3Candidates: number;
  matchedCandidates: number;
  unmatchedCandidates: number;
  sourceMatchPercent: number;
  activeFunds: number;
  inactiveFunds: number;
  underReviewFunds: number;
  basicComplete: number;
  basicCoveragePercent: number;
  essentialApplicable: number;
  essentialComplete: number;
  essentialCoveragePercent: number;
  duplicateCnpjGroups: number;
};

export type FundCatalogRun = {
  id: string;
  status: CatalogRunStatus;
  mode: "official-backfill";
  actor: string;
  createdAt: string;
  appliedAt: string | null;
  failedAt: string | null;
  error: string | null;
  sourceHash: string;
  planHash: string;
  approvalHash: string;
  sources: CatalogSourceSnapshot[];
  coverage: FundCatalogCoverage;
  acceptance: {
    basicTargetPercent: 100;
    essentialTargetPercent: 95;
    sourceMatchTargetPercent: 100;
    meetsTargets: boolean;
    gaps: string[];
  };
  safety: {
    safeToApply: boolean;
    destructiveChangesAllowed: boolean;
    blockers: string[];
    sentinelsPresent: boolean;
  };
  totals: {
    planned: number;
    added: number;
    updated: number;
    inactivated: number;
    reactivated: number;
    unchanged: number;
  };
  reviewSamples: Array<{ ticker: string; issue: string }>;
  chunks: number;
  appliedItems: number;
  verifiedAt: string | null;
};

export type FundCatalogBuildResult = {
  run: FundCatalogRun;
  items: FundCatalogPlanItem[];
};

export type FundCatalogAudit = {
  generatedAt: string;
  runId: string | null;
  totalCatalogDocuments: number;
  activeDocuments: number;
  basicCoveragePercent: number;
  essentialCoveragePercent: number;
  duplicateCnpjGroups: number;
  missingBasic: Array<{ ticker: string; fields: string[] }>;
  missingEssential: Array<{ ticker: string; fields: string[] }>;
  staleOrInactive: Array<{ ticker: string; status: CatalogLifecycleStatus; reason: string }>;
  acceptanceMet: boolean;
};

export type FundCatalogDirectoryItem = {
  ticker: string;
  name: string;
  legalName: string;
  kind: FundKind;
  sector: string;
  segment: string;
  status: CatalogLifecycleStatus;
};

export type FundCatalogDirectory = {
  schemaVersion: typeof FUND_CATALOG_SCHEMA_VERSION;
  runId: string;
  generatedAt: string;
  total: number;
  items: FundCatalogDirectoryItem[];
};
