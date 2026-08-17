import { featureEnabled } from "@/lib/featureFlags";
import { logObservabilityEvent } from "@/lib/observability";
import { consumeFundRadarRateLimit } from "@/lib/security/FundRadarRateLimit";
import { isStrictSameOrigin } from "@/lib/security/SameOriginPolicy";
import { resolveFundRadarSubject } from "@/server/auth/FundRadarIdentityResolver";
import { createFundRadarRuntime } from "@/server/services/FundRadarRuntime";
import { createFundRadarHandlers } from "./FundRadarControllerCore";

const runtime = createFundRadarRuntime();

const handlers = createFundRadarHandlers({
  enabled: () => featureEnabled("ENABLE_FUND_RADAR", false),
  sameOrigin: isStrictSameOrigin,
  resolveSubject: resolveFundRadarSubject,
  consumeRateLimit: consumeFundRadarRateLimit,
  service: runtime.service,
  async telemetry(event, subject) {
    await logObservabilityEvent({
      type: event,
      ok: true,
      source: "fund-radar",
      metadata: { plan: subject.plan },
    });
  },
});

export const { GET, POST, PATCH, DELETE, REFRESH } = handlers;
