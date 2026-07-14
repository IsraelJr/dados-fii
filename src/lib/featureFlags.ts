export type Phase2Feature =
  | "ENABLE_SYSTEM_VALIDATION"
  | "ENABLE_HEALTH_MONITOR"
  | "ENABLE_AI_INSIGHTS"
  | "ENABLE_REPORT_PREMIUM"
  | "ENABLE_SCORE_ENGINE";

export function featureEnabled(name: Phase2Feature, defaultValue = true) {
  const value = process.env[name];
  if (value == null || value === "") return defaultValue;
  return !["0", "false", "off", "no"].includes(value.trim().toLowerCase());
}
