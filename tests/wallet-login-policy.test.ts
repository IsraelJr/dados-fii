import assert from "node:assert/strict";
import test from "node:test";
import { isWalletPasswordFormatValid } from "../src/lib/users/WalletLoginPolicy";

test("login aceita senha Firebase com letra, número e caractere especial", () => {
  assert.equal(isWalletPasswordFormatValid("Qa1!fixture"), true);
});

test("login preserva requisitos mínimos sem restringir o alfabeto da senha", () => {
  assert.equal(isWalletPasswordFormatValid("abcdef!"), false);
  assert.equal(isWalletPasswordFormatValid("123456!"), false);
  assert.equal(isWalletPasswordFormatValid("Qa1!"), false);
  assert.equal(isWalletPasswordFormatValid("Qa1234"), true);
});
