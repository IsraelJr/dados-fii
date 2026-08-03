import assert from "node:assert/strict";
import test from "node:test";
import {
  parseDisplayedPercentage,
// @ts-expect-error Node's native strip-types runner requires the explicit .ts suffix.
} from "./e2e/support/parse-displayed-percentage.ts";

test("parser interpreta percentuais pt-BR e com ponto decimal sem multiplicar por cem", () => {
  assert.equal(parseDisplayedPercentage("20,91%"), 20.91);
  assert.equal(parseDisplayedPercentage("20.91%"), 20.91);
  assert.equal(parseDisplayedPercentage("-0,35%"), -0.35);
  assert.equal(parseDisplayedPercentage("-0.35%"), -0.35);
  assert.equal(parseDisplayedPercentage("+1,20%"), 1.2);
  assert.equal(parseDisplayedPercentage("+1.20%"), 1.2);
  assert.notEqual(parseDisplayedPercentage("20.91%"), 2091);
});

test("parser trata explicitamente milhar, decimal, espaços, sinal e entradas inválidas", () => {
  assert.equal(parseDisplayedPercentage("  +1.234,56 % "), 1234.56);
  assert.equal(parseDisplayedPercentage("-1,234.56%"), -1234.56);
  assert.equal(parseDisplayedPercentage("1.234.567%"), 1234567);
  assert.equal(parseDisplayedPercentage("1\u00a0234,50 %"), 1234.5);
  assert.equal(parseDisplayedPercentage("percentual indisponível"), null);
  assert.equal(parseDisplayedPercentage("1,2,3%"), null);
  assert.equal(parseDisplayedPercentage("12.34,56%"), null);
  assert.equal(parseDisplayedPercentage("1,2,3.45%"), null);
});
