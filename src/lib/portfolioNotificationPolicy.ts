export const PORTFOLIO_NOTIFICATION_POLICY_VERSION = 1;
export const FREE_PATRIMONY_CHANGE_THRESHOLD_PERCENT = 3;
export const MIN_PAID_PATRIMONY_CHANGE_THRESHOLD_PERCENT = 0.5;
export const MAX_PAID_PATRIMONY_CHANGE_THRESHOLD_PERCENT = 20;

export type PortfolioValueChangeDecision = {
  shouldNotify: boolean;
  shouldRebaseline: boolean;
  reason: "incomplete_data" | "initial_baseline" | "configuration_changed" | "dividend_changed" | "below_threshold" | "threshold_reached";
  direction: "up" | "down" | null;
  changePercent: number | null;
  currentValue: number;
  referenceValue: number | null;
  thresholdPercent: number;
};

function finitePositive(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function paidPatrimonyThresholdPercent(value: unknown) {
  const parsed = finitePositive(value);
  if (parsed === null) return FREE_PATRIMONY_CHANGE_THRESHOLD_PERCENT;
  const bounded = Math.min(Math.max(parsed, MIN_PAID_PATRIMONY_CHANGE_THRESHOLD_PERCENT), MAX_PAID_PATRIMONY_CHANGE_THRESHOLD_PERCENT);
  return Number(bounded.toFixed(1));
}

export function patrimonyThresholdPercent(isPaid: boolean, preference: unknown) {
  return isPaid ? paidPatrimonyThresholdPercent(preference) : FREE_PATRIMONY_CHANGE_THRESHOLD_PERCENT;
}

export function portfolioValueChangeDecision(input: {
  currentValue: unknown;
  referenceValue: unknown;
  thresholdPercent: unknown;
  dataComplete: boolean;
  dividendChanged: boolean;
  configurationChanged: boolean;
}): PortfolioValueChangeDecision {
  const currentValue = finitePositive(input.currentValue) || 0;
  const referenceValue = finitePositive(input.referenceValue);
  const thresholdPercent = paidPatrimonyThresholdPercent(input.thresholdPercent);

  if (!input.dataComplete || currentValue <= 0) {
    return { shouldNotify: false, shouldRebaseline: false, reason: "incomplete_data", direction: null, changePercent: null, currentValue, referenceValue, thresholdPercent };
  }
  if (referenceValue === null) {
    return { shouldNotify: false, shouldRebaseline: true, reason: "initial_baseline", direction: null, changePercent: null, currentValue, referenceValue, thresholdPercent };
  }
  if (input.configurationChanged) {
    return { shouldNotify: false, shouldRebaseline: true, reason: "configuration_changed", direction: null, changePercent: null, currentValue, referenceValue, thresholdPercent };
  }
  if (input.dividendChanged) {
    return { shouldNotify: false, shouldRebaseline: true, reason: "dividend_changed", direction: null, changePercent: null, currentValue, referenceValue, thresholdPercent };
  }

  const changePercent = ((currentValue - referenceValue) / referenceValue) * 100;
  const direction = changePercent >= 0 ? "up" : "down";
  const thresholdReached = Math.abs(changePercent) + Number.EPSILON >= thresholdPercent;
  return {
    shouldNotify: thresholdReached,
    shouldRebaseline: thresholdReached,
    reason: thresholdReached ? "threshold_reached" : "below_threshold",
    direction,
    changePercent: Number(changePercent.toFixed(4)),
    currentValue,
    referenceValue,
    thresholdPercent,
  };
}
