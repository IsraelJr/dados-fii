export type Phase2Feature =
  | "ENABLE_SYSTEM_VALIDATION"
  | "ENABLE_HEALTH_MONITOR"
  | "ENABLE_AI_INSIGHTS"
  | "ENABLE_REPORT_PREMIUM"
  | "ENABLE_AUTOMATIC_MONITOR"
  | "ENABLE_SCORE_ENGINE"
  | "ENABLE_RISK_LAB_ADMIN"
  | "ENABLE_RISK_LAB_PREMIUM_READONLY";

export function featureEnabled(name: Phase2Feature, defaultValue = true) {
  const value = process.env[name];
  if (value == null || value === "") return defaultValue;
  return !["0", "false", "off", "no"].includes(value.trim().toLowerCase());
}
