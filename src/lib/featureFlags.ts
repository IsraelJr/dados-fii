export type Phase2Feature =
  | "ENABLE_SYSTEM_VALIDATION"
  | "ENABLE_HEALTH_MONITOR"
  | "ENABLE_AI_INSIGHTS"
  | "ENABLE_REPORT_PREMIUM"
  | "ENABLE_AUTOMATIC_MONITOR"
  | "ENABLE_SCORE_ENGINE"
  | "ENABLE_RISK_LAB_ADMIN"
  | "ENABLE_RISK_LAB_PREMIUM_READONLY"
  | "ENABLE_WALLET_RISK_REPORT_AUTOMATIC"
  | "ENABLE_WALLET_RISK_REPORT_MANUAL_FALLBACK";

export function featureEnabled(name: Phase2Feature, defaultValue = true) {
  const value = process.env[name];
  if (value == null || value === "") return defaultValue;
  return !["0", "false", "off", "no"].includes(value.trim().toLowerCase());
}
