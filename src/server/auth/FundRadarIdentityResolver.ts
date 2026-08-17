import { isAllowedAdminEmail } from "@/lib/adminSecurity";
import { FundRadarIdentityError } from "@/lib/fund-radar/FundRadarIdentity";
import { paidPlanFromRecord } from "@/lib/productPlans";
import { resolvePremiumEntitlement, resolvePremiumRequestIdentity } from "@/lib/premiumSecurity";
import { userRepository } from "@/lib/users/UserRepository";
import type { FundRadarSubject } from "@/lib/fund-radar/FundRadarRepository";
import { resolveVerifiedWalletIdentity } from "./WalletIdentityResolver";

export async function resolveFundRadarSubject(request: Request): Promise<FundRadarSubject> {
  if (String(request.headers.get("authorization") || "").startsWith("Bearer ")) {
    const verified = await resolvePremiumRequestIdentity(request as never);
    if (!verified.ok) throw new FundRadarIdentityError(verified.status === 401 ? "FUND_RADAR_AUTH_REQUIRED" : "FUND_RADAR_AUTH_FORBIDDEN", verified.status);
    const entitlement = await resolvePremiumEntitlement(verified.identity);
    return Object.freeze({ ownerId: verified.identity.uid, plan: entitlement?.plan || "free" });
  }

  try {
    const identity = await resolveVerifiedWalletIdentity(request);
    const user = await userRepository.find({ uid: identity.ownerId });
    const email = String(user.data.email || "").trim().toLowerCase();
    const plan = isAllowedAdminEmail(email) ? "super_premium" : paidPlanFromRecord(user.data) || "free";
    return Object.freeze({ ownerId: identity.ownerId, plan });
  } catch {
    throw new FundRadarIdentityError("FUND_RADAR_AUTH_REQUIRED", 401);
  }
}
