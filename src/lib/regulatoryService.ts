import {
  normalizeRegulatoryData,
  regulatoryDataService,
  type RegulatoryData,
  type RegulatoryFundView,
  type RegulatoryReportResult,
} from "@/services/regulatory";

export type RegulatoryDataDocument = RegulatoryData;
export type { RegulatoryFundView, RegulatoryReportResult };
export { normalizeRegulatoryData };

export async function getRegulatoryFund(tickerInput: unknown) {
  return regulatoryDataService.getFund(tickerInput);
}

export async function getRegulatoryReportInput(tickerInput: unknown) {
  return regulatoryDataService.getReportInput(tickerInput);
}
