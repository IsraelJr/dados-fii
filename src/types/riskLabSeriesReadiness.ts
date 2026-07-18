export interface DividendSeriesReadiness {
  ticker: string;
  approvedObservations: number;
  firstCompetence: string | null;
  lastCompetence: string | null;
  missingMonths: string[];
  longestContiguousMonths: string[];
  longestContiguousCount: number;
  requiredContiguousCount: number;
  readyForStressDetection: boolean;
  detectorExecuted: false;
}
