import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

function gitBlobSha(content) {
  const size = Buffer.byteLength(content, "utf8");
  return createHash("sha1").update(`blob ${size}\0`, "utf8").update(content, "utf8").digest("hex");
}

test("ruleset v0.1.0 remains frozen during out-of-sample validation", () => {
  const manifest = JSON.parse(readFileSync(new URL("../docs/risk-lab/ruleset-freeze-v0.1.0.json", import.meta.url), "utf8"));
  const source = readFileSync(new URL("../src/lib/risk-lab/rules.ts", import.meta.url), "utf8");

  assert.equal(manifest.status, "frozen_out_of_sample_validation");
  assert.equal(manifest.rulesetVersion, "0.1.0");
  assert.equal(gitBlobSha(source), manifest.gitBlobSha, "rules.ts changed without a new formal ruleset version");
  assert.equal(manifest.changePolicy.allowThresholdChanges, false);
  assert.equal(manifest.changePolicy.allowWeightChanges, false);
  assert.equal(manifest.changePolicy.allowAlertLevelChanges, false);
  assert.equal(manifest.changePolicy.allowRuleLogicChanges, false);
});
