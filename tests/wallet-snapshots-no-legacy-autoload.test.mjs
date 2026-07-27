import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controller = readFileSync("src/server/controllers/WalletSnapshotsController.ts", "utf8");

test("snapshots da web não carregam automaticamente patrimônio ou dividendos legados do documento User", () => {
  assert.doesNotMatch(controller, /legacyWalletSnapshots/);
  assert.doesNotMatch(controller, /mergeWalletSnapshots/);
  assert.doesNotMatch(controller, /userRef\.get\(\)/);
  assert.match(controller, /userRef\.collection\("WalletSnapshots"\)/);
});

test("não existe exceção de histórico vinculada a e-mail pessoal", () => {
  assert.doesNotMatch(controller, /israel\.junior2111@gmail\.com/i);
  assert.doesNotMatch(controller, /PREMIUM_PREVIEW_EMAILS/);
});
