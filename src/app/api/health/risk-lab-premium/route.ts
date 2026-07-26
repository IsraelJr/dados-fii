import { NextResponse } from "next/server";
import { featureEnabled } from "@/lib/featureFlags";
import {
  RISK_LAB_PREMIUM_REGISTRY_VERSION,
  RISK_LAB_PREMIUM_RULESET_VERSION,
} from "@/lib/risk-lab/RiskLabPremiumReadModel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const enabled = featureEnabled("ENABLE_RISK_LAB_PREMIUM_READONLY", false);
  const payload = {
    ok: enabled,
    service: "risk-lab-premium-readonly",
    enabled,
    mode: "read_only",
    registryVersion: RISK_LAB_PREMIUM_REGISTRY_VERSION,
    rulesetVersion: RISK_LAB_PREMIUM_RULESET_VERSION,
    notificationsAllowed: false,
    externalEffectsAllowed: false,
    deploymentCommit: process.env.VERCEL_GIT_COMMIT_SHA || null,
  } as const;

  return NextResponse.json(payload, {
    status: enabled ? 200 : 503,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
