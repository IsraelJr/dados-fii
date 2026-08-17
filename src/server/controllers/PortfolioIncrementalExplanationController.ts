import { featureEnabled } from "@/lib/featureFlags";
import { distributedRateLimitRepository } from "@/lib/security/DistributedRateLimitRepository";
import { PortfolioIncrementalRateLimit } from "@/lib/security/PortfolioIncrementalRateLimit";
import { isStrictSameOrigin } from "@/lib/security/SameOriginPolicy";
import { resolveVerifiedWalletIdentity } from "@/server/auth/WalletIdentityResolver";
import {
  portfolioIncrementalExplanationService,
} from "@/server/services/PortfolioIncrementalExplanationService";
import { createPortfolioIncrementalStoredComparisonService } from "@/server/services/PortfolioIncrementalServerRuntime";
import { createPortfolioIncrementalExplanationHandler } from "./PortfolioIncrementalControllerCore";

const comparisons = createPortfolioIncrementalStoredComparisonService();
const rateLimit = new PortfolioIncrementalRateLimit(distributedRateLimitRepository);

export const POST = createPortfolioIncrementalExplanationHandler({
  enabled: () => featureEnabled("ENABLE_INCREMENTAL_PORTFOLIO_REPORT", false),
  sameOrigin: isStrictSameOrigin,
  resolveIdentity: resolveVerifiedWalletIdentity,
  consumeRateLimit: (ownerId, request) => rateLimit.consume(ownerId, request),
  loadComparison: (input) => comparisons.load(input),
  generate: (input) => portfolioIncrementalExplanationService.generate(input),
  fallback: (input) => portfolioIncrementalExplanationService.fallback(input),
});
