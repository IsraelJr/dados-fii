import type { RegulatorySource } from "@/types/regulatory";
import type { FundScores, ScoreLevel } from "@/types/scores";
import type { RegulatoryTimelineItem } from "@/types/timeline";

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
    segment: string | null;
    manager: string | null;
    administrator: string | null;
  };
  market: {
    price: string | number | null;
    variation: string | number | null;
    dividendYield: number | null;
    pvp: number | null;
    lastDividend: number | null;
    lastDividendReference: string | null;
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
