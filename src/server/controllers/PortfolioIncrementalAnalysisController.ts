import { featureEnabled } from "@/lib/featureFlags";
import { isStrictSameOrigin } from "@/lib/security/SameOriginPolicy";
import { resolveVerifiedWalletIdentity } from "@/server/auth/WalletIdentityResolver";
import { createPortfolioIncrementalServerAnalysisService } from "@/server/services/PortfolioIncrementalServerRuntime";
import { createPortfolioIncrementalAnalysisHandler } from "./PortfolioIncrementalControllerCore";

const service = createPortfolioIncrementalServerAnalysisService();

export const POST = createPortfolioIncrementalAnalysisHandler({
  enabled: () => featureEnabled("ENABLE_INCREMENTAL_PORTFOLIO_REPORT", false),
  sameOrigin: isStrictSameOrigin,
  resolveIdentity: resolveVerifiedWalletIdentity,
  compareAndStore: (input) => service.compareAndStore(input),
});
