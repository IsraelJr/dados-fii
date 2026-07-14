import type { RawFundDocument } from "./RegulatoryTypes.ts";

export interface RegulatoryRepository {
  getFundDocument(ticker: string): Promise<RawFundDocument | null>;
}
