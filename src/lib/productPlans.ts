export type ProductPlan = "free" | "premium" | "super_premium";
export type PaidProductPlan = Exclude<ProductPlan, "free">;

export const MONITORED_FUND_LIMITS: Readonly<Record<ProductPlan, number>> = Object.freeze({
  free: 1,
  premium: 10,
  super_premium: 10,
});

export function monitoredFundLimit(plan: ProductPlan) {
  return MONITORED_FUND_LIMITS[plan];
}

export function productPlanLabel(plan: ProductPlan | string) {
  if (plan === "super_premium") return "Super Premium";
  if (plan === "premium") return "Premium";
  return "Grátis";
}

export function paidPlanFromRecord(data: Record<string, unknown>): PaidProductPlan | null {
  const subscription = data.subscription && typeof data.subscription === "object" ? data.subscription as Record<string, unknown> : {};
  const plan = String(data.plan || subscription.plan || data.subscriptionPlan || "").trim().toLowerCase().replace(/[ -]/g, "_");
  const status = String(subscription.status || data.subscriptionStatus || "").trim().toLowerCase();
  const active = !status || ["active", "trialing", "paid"].includes(status);
  if (!active) return null;
  if (data.isVip === true || data.isVIP === true || ["vip", "pro", "super_premium", "superpremium"].includes(plan)) return "super_premium";
  if (data.isPremium === true || data.premium === true || plan === "premium") return "premium";
  return null;
}
