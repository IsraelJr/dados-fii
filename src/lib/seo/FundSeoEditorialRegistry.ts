import type { FundSeoEditorialReview } from "./FundSeoPagePolicy";

const EDITORIAL_REVIEWS: Readonly<Record<string, FundSeoEditorialReview>> = Object.freeze({});

export function getFundSeoEditorialReview(ticker: string): FundSeoEditorialReview | null {
  return EDITORIAL_REVIEWS[ticker] || null;
}

export function listFundSeoEditorialReviews() {
  return Object.entries(EDITORIAL_REVIEWS)
    .map(([ticker, review]) => ({ ticker, review }))
    .sort((left, right) => left.ticker.localeCompare(right.ticker));
}
