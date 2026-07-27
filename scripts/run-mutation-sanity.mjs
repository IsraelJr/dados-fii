import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const target = path.resolve("src/lib/risk-lab/RiskLabPremiumReadModel.ts");
const original = readFileSync(target, "utf8");
const protectedRule = "notificationsAllowed: false,\n    externalEffectsAllowed: false,";
const mutation = "notificationsAllowed: true,\n    externalEffectsAllowed: false,";

assert.equal(
  original.split(protectedRule).length - 1,
  1,
  "A regra central de somente leitura deve possuir um único ponto mutável.",
);

function runRegression() {
  return spawnSync(
    process.execPath,
    [
      "--import",
      "./tests/register-ts-loader.mjs",
      "--experimental-strip-types",
      "--test",
      "tests/risk-lab-premium-readonly.test.ts",
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf8",
    },
  );
}

let mutatedResult;
try {
  writeFileSync(target, original.replace(protectedRule, mutation), "utf8");
  mutatedResult = runRegression();
} finally {
  writeFileSync(target, original, "utf8");
}

assert.notEqual(mutatedResult?.status, 0, "A suíte deve reprovar quando notificações são habilitadas.");
assert.match(
  `${mutatedResult?.stdout || ""}\n${mutatedResult?.stderr || ""}`,
  /true !== false|Expected values to be strictly equal/,
  "A mutação deve ser detectada por uma asserção semântica.",
);

const restoredResult = runRegression();
assert.equal(
  restoredResult.status,
  0,
  `A suíte deve voltar a aprovar após a restauração.\n${restoredResult.stdout}\n${restoredResult.stderr}`,
);
assert.equal(readFileSync(target, "utf8"), original, "O arquivo mutado deve ser restaurado byte a byte.");

console.log("Mutation sanity aprovado: a regra alterada falhou, foi restaurada e voltou a passar.");
