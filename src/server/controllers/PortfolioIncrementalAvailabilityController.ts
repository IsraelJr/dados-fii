import { featureEnabled } from "@/lib/featureFlags";
import { createPortfolioIncrementalAvailabilityHandler } from "./PortfolioIncrementalControllerCore";

export const GET = createPortfolioIncrementalAvailabilityHandler({
  enabled: () => featureEnabled("ENABLE_INCREMENTAL_PORTFOLIO_REPORT", false),
});
