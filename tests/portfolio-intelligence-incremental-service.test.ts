import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("contrato público não oferece caminho legado que persiste resultado fornecido pelo cliente", () => {
  const source = readFileSync(
    "src/lib/portfolio-intelligence/PortfolioIntelligenceIncrementalService.ts",
    "utf8",
  );
  const server = readFileSync(
    "src/server/services/PortfolioIncrementalServerAnalysisService.ts",
    "utf8",
  );

  assert.doesNotMatch(source, /class\s+PortfolioIntelligenceIncrementalService/);
  assert.doesNotMatch(source, /result:\s*PortfolioIntelligenceResult/);
  assert.doesNotMatch(source, /createPortfolioIntelligenceReference\(input\.result/);
  assert.match(server, /canonicalInput = await this\.input\.load/);
  assert.match(server, /analyzer\.analyze\(canonicalInput/);
});
