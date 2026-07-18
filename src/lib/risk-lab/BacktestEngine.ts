import type { BacktestResult, RiskSnapshot } from "../../types/riskLab";
import { RiskRuleEngine } from "./RuleEngine";

export class BacktestEngine {
  private readonly ruleEngine: RiskRuleEngine;

  constructor(ruleEngine: RiskRuleEngine) {
    this.ruleEngine = ruleEngine;
  }

  run(snapshots: RiskSnapshot[]): BacktestResult {
    if (!snapshots.length) throw new Error("Backtest requires at least one snapshot.");
    const sorted = [...snapshots].sort((a, b) => Date.parse(a.asOf) - Date.parse(b.asOf));
    const ticker = sorted[0].ticker;
    if (sorted.some((snapshot) => snapshot.ticker !== ticker)) {
      throw new Error("Backtest snapshots must belong to the same ticker.");
    }

    const rows = sorted.map((snapshot, index) => {
      const history = sorted.slice(0, index);
      return this.ruleEngine.evaluate(snapshot, history);
    });

    return { ticker, rows };
  }
}
