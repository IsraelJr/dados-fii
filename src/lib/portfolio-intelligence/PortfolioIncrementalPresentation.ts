import type { PortfolioIncrementalChange } from "./PortfolioIntelligenceIncremental";

const PERCENT_CHANGE_CODES = new Set([
  "PATRIMONY_COVERAGE",
  "SEGMENT_COVERAGE",
  "INCOME_COVERAGE",
  "INCOME_TREND_CHANGED",
  "INCOME_VOLATILITY_CHANGED",
  "LARGEST_POSITION_CHANGED",
  "TOP_THREE_CONCENTRATION_CHANGED",
  "INCOME_CONCENTRATION_CHANGED",
]);

export function formatPortfolioIncrementalValue(
  change: PortfolioIncrementalChange,
  value: PortfolioIncrementalChange["before"],
) {
  if (value === null) return "Não disponível";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "string") {
    const labels: Record<string, string> = {
      info: "Informativa",
      attention: "Atenção",
      warning: "Alerta",
      sufficient: "Suficiente",
      partial: "Parcial",
      insufficient: "Insuficiente",
    };
    return labels[value] || value;
  }
  if (/LATEST_INCOME|ESTIMATED_INCOME_TOTAL/.test(change.code)) {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (PERCENT_CHANGE_CODES.has(change.code)) {
    return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  }
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
