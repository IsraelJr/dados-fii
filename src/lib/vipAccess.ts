function toDate(value: any): Date | null {
  if (!value) return null;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function vipExpiration(data: any) {
  return toDate(data?.vipUntil || data?.vip?.expiresAt || data?.subscription?.expiresAt);
}

export function hasVipFlag(data: any) {
  const plan = String(data?.plan || data?.subscription?.plan || "").trim().toLowerCase();
  return Boolean(
    data?.isVip ||
    data?.isVIP ||
    data?.isPremium ||
    data?.premium ||
    ["vip", "premium", "pro"].includes(plan)
  );
}

export function hasActiveVip(data: any, now = new Date()) {
  if (!hasVipFlag(data)) return false;
  const expiration = vipExpiration(data);
  return !expiration || expiration.getTime() > now.getTime();
}

export function vipAccessSummary(data: any, now = new Date()) {
  const expiration = vipExpiration(data);
  const active = hasActiveVip(data, now);
  return {
    active,
    permanent: active && !expiration,
    expiresAt: expiration?.toISOString() || null,
    remainingDays: active && expiration
      ? Math.max(Math.ceil((expiration.getTime() - now.getTime()) / 86400000), 1)
      : null,
  };
}
