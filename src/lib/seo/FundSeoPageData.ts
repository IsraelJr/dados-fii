import "server-only";
import { cache } from "react";
import { normalizeTicker, regulatoryDataService } from "@/lib/regulatoryDataService";
import { getFundSeoEditorialReview } from "./FundSeoEditorialRegistry";
import { evaluatePublicFundSeo } from "./FundSeoPagePolicy";

export const loadFundSeoPageData = cache(async (value: unknown) => {
  const ticker = normalizeTicker(value);
  const editorial = ticker ? getFundSeoEditorialReview(ticker) : null;
  const fund = ticker ? await regulatoryDataService.getByTicker(ticker) : null;
  const eligibility = evaluatePublicFundSeo(ticker || String(value || ""), fund, editorial);

  return {
    ticker,
    fund,
    editorial,
    eligibility,
  };
});
