import assert from "node:assert/strict";
import test from "node:test";
import { classifyRiskLabCategory } from "../src/lib/risk-lab/RiskLabCategoryPolicy";
import { RiskLabPremiumReadModel } from "../src/lib/risk-lab/RiskLabPremiumReadModel";

const cases = [
  ["MXRF11", { fundKind: "FII", segment: "Papel / Recebíveis" }, "paper_credit", true],
  ["VGIA11", { fundKind: "FIAGRO", segment: "Cadeias agroindustriais" }, "fiagro", false],
  ["KNCA11", { fundKind: "FIAGRO", sector: "Agronegócio" }, "fiagro", false],
  ["BODB11", { fundKind: "FII", segment: "Fundo de papel e crédito" }, "paper_credit", true],
  ["HGLG11", { fundKind: "FII", segment: "Logística" }, "brick", false],
  ["KFOF11", { fundKind: "FII", isFundOfFunds: true }, "fund_of_funds", false],
  ["TGAR11", { fundKind: "FII", segment: "Híbrido" }, "hybrid", false],
  ["BDIF11", { fundKind: "FI-Infra", segment: "Infraestrutura" }, "fi_infra", false],
] as const;

test("política classifica categorias representativas sem exceção por ticker", () => {
  for (const [ticker, context, category, calibrated] of cases) {
    const result = classifyRiskLabCategory(context);
    assert.equal(result.category, category, ticker);
    assert.equal(result.calibrated, calibrated, ticker);
  }
});

test("[REG-DEF-14] categorias sem calibração falham explicitamente e sem alerta inventado", () => {
  const model = new RiskLabPremiumReadModel();
  for (const [ticker, context, category, calibrated] of cases) {
    const result = model.read(ticker, { enabled: true, category: context });
    assert.equal(result.applicabilityCategory, category, ticker);
    assert.equal(result.categoryCalibrated, calibrated, ticker);
    if (!calibrated) {
      assert.equal(result.availability, "insufficient_data", ticker);
      assert.equal(result.riskAlert, null, ticker);
      assert.equal(result.disposition, null, ticker);
    }
  }
});
