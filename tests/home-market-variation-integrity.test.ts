import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
// @ts-expect-error Node's native strip-types runner requires the explicit .ts suffix.
import { calculateIntradayVariationPercent, formatMarketVariation, parseMarketNumber } from "../src/lib/market/MarketQuoteNormalization.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("normaliza preços brasileiros e calcula variação pela abertura", () => {
  assert.equal(parseMarketNumber("R$ 84,11"), 84.11);
  assert.equal(parseMarketNumber("1.234,56"), 1234.56);
  assert.equal(calculateIntradayVariationPercent("R$ 10,10", "R$ 10,00"), 1);
  assert.equal(calculateIntradayVariationPercent("R$ 9,82", "R$ 10,00"), -1.8);
  assert.equal(formatMarketVariation(1.2345), "1.2345%");
});

test("falha fechado para preço, abertura ou oscilação implausível", () => {
  assert.equal(calculateIntradayVariationPercent("R$ 0,00", "R$ 10,00"), null);
  assert.equal(calculateIntradayVariationPercent("R$ 10,00", "R$ 0,00"), null);
  assert.equal(calculateIntradayVariationPercent("R$ 64,48", "R$ 10,00"), null);
  assert.equal(calculateIntradayVariationPercent("R$ 1,00", "R$ 10,00"), null);
  assert.equal(calculateIntradayVariationPercent("R$ 13,00", "R$ 10,00"), 30);
  assert.equal(calculateIntradayVariationPercent("R$ 13,01", "R$ 10,00"), null);
});

test("painel não usa mais a variação bruta da planilha para ordenar", () => {
  const panel = read("src/app/components/FiiTopPanels.tsx");
  assert.match(panel, /calculateIntradayVariationPercent\(fii\.price, fii\.opening\)/);
  assert.match(panel, /fiis\.flatMap/);
  assert.match(panel, /fii\.variationNum > 0/);
  assert.match(panel, /fii\.variationNum < 0/);
  assert.doesNotMatch(panel, /parsePercent|sheetVar|variationFromSheet/);
});

test("API pública substitui variação recebida pelo cálculo preço versus abertura", () => {
  const route = read("src/app/api/fii/route.ts");
  assert.match(route, /calculateIntradayVariationPercent\(quote\.price, quote\.opening\)/);
  assert.match(route, /variation: formatMarketVariation\(calculatedVariation\)/);
  assert.match(route, /variationSource: calculatedVariation !== null \? "calculated_price_opening" : "unavailable"/);
});

test("botão de Login fica disponível na Home para autenticação não administrativa", () => {
  const login = read("src/app/components/Login.tsx");
  assert.match(login, /onAuthStateChanged\(auth, setUser\)/);
  assert.match(login, /aria-controls="login-dialog"/);
  assert.match(login, /aria-label="Sair da conta"/);
  assert.doesNotMatch(login, /usePathname|pathname === "\/"/);
});
