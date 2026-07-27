import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("API pública do IFIX usa a marca Dados FII e preserva provedor apenas internamente", () => {
  const route = read("src/app/api/ifix/route.ts");
  assert.match(route, /const PUBLIC_IFIX_SOURCE = "Dados FII"/);
  assert.match(route, /source: PUBLIC_IFIX_SOURCE/);
  assert.match(route, /technicalSource: "Yahoo Finance"/);
  assert.match(route, /technicalSource: "brapi\.dev"/);
  assert.doesNotMatch(route, /source: quote\.source/);
  assert.doesNotMatch(route, /details:\s*errors/);
});

test("painéis de altas e baixas mantêm contraste acessível", () => {
  const panel = read("src/app/components/FiiTopPanels.tsx");
  assert.match(panel, /text-green-700/);
  assert.match(panel, /text-red-700/);
  assert.doesNotMatch(panel, /text-green-400/);
  assert.doesNotMatch(panel, /text-red-400/);
});
