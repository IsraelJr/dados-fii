import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
// @ts-expect-error Node strip-types exige sufixo explícito.
import { loadRiskLabPremiumRegistry, RiskLabPremiumReadModel } from "../src/lib/risk-lab/RiskLabPremiumReadModel.ts";

const model = new RiskLabPremiumReadModel();

test("feature flag desligada falha para indisponível sem efeito externo", () => {
  const result = model.read("DEVA11", { enabled: false });
  assert.equal(result.availability, "disabled");
  assert.equal(result.disposition, null);
  assert.equal(result.readOnly, true);
  assert.equal(result.notificationsAllowed, false);
  assert.equal(result.externalEffectsAllowed, false);
});

test("coorte homologada preserva disposições e caso inconclusivo", () => {
  const expected = {
    DEVA11: ["available", "elevated_risk", true],
    VSLH11: ["available", "elevated_risk", true],
    KNCR11: ["available", "none", false],
    KNSC11: ["available", "informational_recovery", false],
    MCCI11: ["inconclusive", "inconclusive", null],
    RBRY11: ["available", "informational_recovery", false],
  } as const;
  for (const [ticker, values] of Object.entries(expected)) {
    const result = model.read(ticker, { enabled: true });
    assert.equal(result.availability, values[0], ticker);
    assert.equal(result.disposition, values[1], ticker);
    assert.equal(result.riskAlert, values[2], ticker);
    assert.equal(result.notificationsAllowed, false, ticker);
    assert.equal(result.externalEffectsAllowed, false, ticker);
  }
  assert.equal(model.read("MCCI11", { enabled: true }).outcome, "inconclusive_unscored");
});

test("fundo fora da coorte recebe fallback explícito e não classificação por semelhança", () => {
  const result = model.read("MXRF11", { enabled: true });
  assert.equal(result.availability, "outside_verified_cohort");
  assert.equal(result.status, null);
  assert.equal(result.riskAlert, null);
  assert.match(result.summary, /não pertence à coorte/i);
  assert.match(result.limitations.join(" "), /não significa ausência de risco/i);
});

test("qualquer adulteração do registro falha fechado antes da leitura", () => {
  const original = readFileSync("src/lib/risk-lab/risk-lab-premium-readonly-v1.json", "utf8");
  const tampered = original.replace('"recoveryPercentOfBaseline": 89.97', '"recoveryPercentOfBaseline": 89.98');
  assert.notEqual(tampered, original);
  const root = mkdtempSync(path.join(tmpdir(), "risk-lab-premium-"));
  writeFileSync(path.join(root, "registry.json"), tampered);
  assert.throws(() => loadRiskLabPremiumRegistry(root, "registry.json"), /SHA-256 integral do registro Premium/);
});
