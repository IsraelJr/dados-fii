import type { RegulatorySource } from "@/types/regulatory";
import type { FundScores, ScoreLevel } from "@/types/scores";
import type { RegulatoryTimelineItem } from "@/types/timeline";
import type { CatalogInvestorComposition } from "@/types/fund-catalog";

export type FreeReportSignal = {
  category: string;
  title: string;
  detail: string;
  level: ScoreLevel | "info";
  score?: number | null;
  confidence?: number | null;
};

export type FreeFundReport = {
  reportVersion: string;
  ticker: string;
  generatedAt: string;
  identity: {
    name: string;
    corporateName: string | null;
    cnpj: string | null;
    fundKind: string;
    sector: string | null;
    segment: string | null;
    regulatoryClassification: string | null;
    managementType: string | null;
    targetAudience: string | null;
    condominiumForm: string | null;
    exclusive: boolean | null;
    isFundOfFunds: boolean | null;
    manager: string | null;
    administrator: string | null;
  };
  fundamentals: {
    netWorth: number | null;
    issuedShares: number | null;
    navPerShare: number | null;
    referenceDate: string | null;
    investors: {
      totalAccounts: number;
      individualAccounts: number | null;
      individualPercent: number | null;
      legalEntityAccounts: number | null;
      legalEntityPercent: number | null;
      legalEntityCategories: CatalogInvestorComposition["legalEntityCategories"] | null;
      largestLegalEntityHolder: { name: string; ownershipPercent: number | null } | null;
    } | null;
  };
  market: {
    price: string | number | null;
    variation: string | number | null;
    dividendYield: number | null;
    pvp: number | null;
    lastDividend: number | null;
    lastDividendReference: string | null;
    lastDividendDateWith: string | null;
    lastDividendPriceDateWith: number | null;
    lastDividendYieldOnDateWithPercent: number | null;
    lastDividendYieldOnCurrentPricePercent: number | null;
  };
  analysis: {
    valuation: {
      premiumDiscountPercent: number | null;
      position: "premium" | "discount" | "near_nav" | "unknown";
      annualizedDistributionOnNavPercent: number | null;
    };
    income: {
      observations: number;
      latest: number | null;
      average3m: number | null;
      previousAverage3m: number | null;
      changeVsPrevious3mPercent: number | null;
      minimum12m: number | null;
      maximum12m: number | null;
      volatilityPercent: number | null;
      cuts12m: number;
      annualizedYieldFromLatestPercent: number | null;
      trend: "rising" | "falling" | "stable" | "unknown";
    };
  };
  scores: FundScores | null;
  highlights: FreeReportSignal[];
  attentionPoints: FreeReportSignal[];
  dataQuality: {
    validationValid: boolean;
    errors: number;
    warnings: number;
    sourceCount: number;
    completenessScore: number | null;
    completenessConfidence: number | null;
  };
  recentEvents: RegulatoryTimelineItem[];
  sources: RegulatorySource[];
  methodology: string[];
  disclaimer: string[];
};
