import { createHash } from "crypto";
import { RegulatoryCache } from "@/lib/regulatory/RegulatoryCache";
import { regulatoryDataService, type RegulatoryDataService } from "@/lib/regulatoryDataService";
import { nowIso } from "@/lib/regulatory/RegulatoryNormalizer";
import { listFundSeoEditorialReviews } from "./FundSeoEditorialRegistry";
import { buildFundSeoManifest, type FundSeoManifest } from "./FundSeoManifest";
import {
  fundSeoManifestRepository,
  type FundSeoManifestRepository,
} from "./FundSeoManifestRepository";
import { buildFundSeoEligibilityInput } from "./FundSeoPagePolicy";

const SEO_MANIFEST_CACHE_TTL_MS = 10 * 60_000;
const MAX_EDITORIAL_FUNDS = 200;

type EditorialReviewsProvider = typeof listFundSeoEditorialReviews;

function editorialFingerprint(explanation: string) {
  const normalized = explanation
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export class FundSeoManifestService {
  private readonly cache = new RegulatoryCache<FundSeoManifest>(SEO_MANIFEST_CACHE_TTL_MS, 1);
  private readonly dataService: RegulatoryDataService;
  private readonly repository: FundSeoManifestRepository;
  private readonly reviewsProvider: EditorialReviewsProvider;
  private rebuildPromise: Promise<FundSeoManifest> | null = null;

  constructor(
    dataService: RegulatoryDataService = regulatoryDataService,
    repository: FundSeoManifestRepository = fundSeoManifestRepository,
    reviewsProvider: EditorialReviewsProvider = listFundSeoEditorialReviews,
  ) {
    this.dataService = dataService;
    this.repository = repository;
    this.reviewsProvider = reviewsProvider;
  }

  async getCurrent(options?: { force?: boolean }) {
    const cached = options?.force ? null : this.cache.get("current");
    if (cached) return cached;
    const manifest = await this.repository.getCurrent();
    if (manifest) this.cache.set("current", manifest);
    return manifest;
  }

  async rebuild(actor: string) {
    if (!actor.trim()) throw new Error("Ator do manifesto SEO obrigatório.");
    if (this.rebuildPromise) return this.rebuildPromise;
    this.rebuildPromise = this.rebuildInternal(actor);
    try {
      return await this.rebuildPromise;
    } finally {
      this.rebuildPromise = null;
    }
  }

  private async rebuildInternal(actor: string) {
    const reviews = this.reviewsProvider().slice(0, MAX_EDITORIAL_FUNDS);
    const generatedAt = nowIso();
    if (!reviews.length) {
      const empty = buildFundSeoManifest([], generatedAt);
      await this.repository.saveCurrent(empty, actor);
      this.cache.set("current", empty);
      return empty;
    }

    const tickers = reviews.map((item) => item.ticker);
    const funds = await this.dataService.getMany(tickers, MAX_EDITORIAL_FUNDS);
    const candidates = reviews.map(({ ticker, review }) => ({
      input: buildFundSeoEligibilityInput(ticker, funds.items[ticker] || null, review),
      contentFingerprint: editorialFingerprint(review.explanation),
    }));
    const manifest = buildFundSeoManifest(candidates, generatedAt);
    await this.repository.saveCurrent(manifest, actor);
    this.cache.set("current", manifest);
    return manifest;
  }

  clearCache() {
    this.cache.clear();
  }
}

export const fundSeoManifestService = new FundSeoManifestService();
