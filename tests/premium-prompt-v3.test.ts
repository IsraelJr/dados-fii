import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node strip-types exige sufixo explícito.
import { PREMIUM_INSIGHTS_PROMPT_VERSION, PREMIUM_MANAGER_MODE_SOURCE_SHA256, premiumPromptV3System } from "../src/lib/ai/PremiumPromptV3.ts";
// @ts-expect-error Node strip-types exige sufixo explícito.
import { PremiumReportEngine } from "../src/lib/reports/PremiumReportEngine.ts";
import type { FreeFundReport } from "../src/types/reports.ts";

function freeReport(): FreeFundReport {
  return {
    reportVersion: "1.2.0", ticker: "DEVA11", generatedAt: "2026-07-25T00:00:00.000Z",
    identity: { name: "DEVA", corporateName: null, cnpj: null, fundKind: "FII", sector: "Papel", segment: "Recebíveis", regulatoryClassification: null, managementType: null, targetAudience: null, condominiumForm: null, exclusive: null, isFundOfFunds: null, manager: null, administrator: null },
    fundamentals: { netWorth: 100, issuedShares: 10, navPerShare: 10, referenceDate: null, investors: null },
    market: { price: 8, variation: null, dividendYield: 12, pvp: 0.8, lastDividend: 0.1, lastDividendReference: "Junho/2026", lastDividendDateWith: null, lastDividendPriceDateWith: null, lastDividendYieldOnDateWithPercent: null, lastDividendYieldOnCurrentPricePercent: 1.25 },
    analysis: { valuation: { premiumDiscountPercent: -20, position: "discount", annualizedDistributionOnNavPercent: 12 }, income: { observations: 12, latest: 0.1, average3m: 0.1, previousAverage3m: 0.12, changeVsPrevious3mPercent: -16.67, minimum12m: 0.08, maximum12m: 0.15, volatilityPercent: 20, cuts12m: 1, annualizedYieldFromLatestPercent: 15, trend: "falling" } },
    scores: null, highlights: [], attentionPoints: [], dataQuality: { validationValid: true, errors: 0, warnings: 0, sourceCount: 1, completenessScore: null, completenessConfidence: null }, recentEvents: [],
    sources: [{ provider: "CVM", kind: "regulatory" }], methodology: [], disclaimer: [],
  };
}

test("Prompt Premium v3 preserva cálculos e bloqueia recomendações inventadas", () => {
  const prompt = premiumPromptV3System();
  assert.equal(PREMIUM_INSIGHTS_PROMPT_VERSION, "premium-fund-analysis-v3");
  assert.equal(PREMIUM_MANAGER_MODE_SOURCE_SHA256, "420eb6c2ac23ab0b0daa331ffd54cdb7215f688f38c5b628c57eabccbcc25a59");
  for (const required of ["cálculos determinísticos", "Ausência de sinal", "recuperação informativa", "inconclusivo", "Maior desconto", "Não invente", "Não recomende compra"]) {
    assert.match(prompt, new RegExp(required, "i"));
  }
});

test("Modo Gestor determinístico declara qualidade, limites e ação somente de monitoramento", () => {
  const draft = new PremiumReportEngine().prepare(freeReport(), [], "2026-07-25T00:00:00.000Z", []);
  assert.equal(draft.reportVersion, "2.0.0");
  assert.equal(draft.managerMode.version, "premium-manager-mode-v3");
  assert.equal(draft.managerMode.actionability, "monitoring_only");
  assert.ok(draft.managerMode.dataQualityScore >= 0 && draft.managerMode.dataQualityScore <= 100);
  assert.match(draft.managerMode.missingInputs.join(" "), /quantidade planejada|preço médio|aporte mensal/i);
  assert.match(draft.managerMode.controlPrinciple, /não implica automaticamente melhor compra/i);
  assert.equal(draft.riskLab.notificationsAllowed, false);
});
