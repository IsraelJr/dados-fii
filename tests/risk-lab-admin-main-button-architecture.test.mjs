import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const layout = readFileSync("src/app/admin/sistema/layout.tsx", "utf8");
const action = readFileSync("src/app/admin/sistema/AdminSprint35QuickAction.tsx", "utf8");

function executable(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

test("Admin principal exibe a ação rápida da Sprint 3.5", () => {
  assert.match(layout, /AdminSprint35QuickAction/);
  assert.match(action, /Executar pendências automaticamente/);
  assert.match(action, /\/api\/admin\/system\/risk-lab\/cohort-backtest/);
  assert.match(action, /method:\s*"POST"/);
  assert.match(action, /JSON\.stringify\(\{ action: "execute" \}\)/);
});

test("ação rápida usa sessão Admin e não pede aprovação técnica", () => {
  const source = executable(action);
  assert.match(source, /credentials:\s*"same-origin"/);
  assert.doesNotMatch(source, /confirm\(|checkbox|approve|reject|manual_document_review|approvalHash/);
});

test("ação rápida mantém efeitos externos isolados", () => {
  const source = executable(action);
  assert.doesNotMatch(source, /sendEmail|sendNotification|createAlert|getPremiumReport|AIInsights/);
  assert.match(action, /\/admin\/risk-lab\/cohort-backtest/);
  assert.match(action, /coveragePercent/);
  assert.match(action, /blockers/);
});
