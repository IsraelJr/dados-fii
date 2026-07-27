import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native strip-types runner requires the explicit .ts suffix.
import { buildFiiRiskReportUserPrompt, FII_RISK_REPORT_PROMPT_VERSION, prepareFiiRiskReportInput } from "../src/lib/prompts/fiiRiskReport.ts";

test("renda mensal e participação na renda são determinísticas", () => {
  const prepared = prepareFiiRiskReportInput({
    portfolio: [
      { ticker: "BODB11", quantity: 70, currentValue: 535.5, lastDividend: 0.1, dailyLiquidity: 585 },
      { ticker: "MXRF11", quantity: 15, currentValue: 144.45, lastDividend: 0.1, dailyLiquidity: 14_717_512 },
      { ticker: "TGAR11", quantity: 40, currentValue: 2_017.2, lastDividend: 0.72, dailyLiquidity: 4_149_305 },
      { ticker: "VGIA11", quantity: 160, currentValue: 1_360, lastDividend: 0.13, dailyLiquidity: 1_598_174 },
      { ticker: "VISC11", quantity: 3, currentValue: 316.26, lastDividend: 0.84, dailyLiquidity: 4_894_924 },
    ],
  });

  const byTicker = Object.fromEntries(prepared.portfolio.map((asset) => [asset.ticker, asset]));
  assert.equal(byTicker.BODB11.estimatedMonthlyIncome, 7);
  assert.equal(byTicker.MXRF11.estimatedMonthlyIncome, 1.5);
  assert.equal(byTicker.TGAR11.estimatedMonthlyIncome, 28.8);
  assert.equal(byTicker.VGIA11.estimatedMonthlyIncome, 20.8);
  assert.equal(byTicker.VISC11.estimatedMonthlyIncome, 2.52);

  assert.equal(byTicker.BODB11.incomeWeight, 11.55);
  assert.equal(byTicker.MXRF11.incomeWeight, 2.47);
  assert.equal(byTicker.TGAR11.incomeWeight, 47.51);
  assert.equal(byTicker.VGIA11.incomeWeight, 34.31);
  assert.equal(byTicker.VISC11.incomeWeight, 4.16);

  const diagnostics = prepared.dataQualitySummary?.deterministicDiagnostics as Record<string, unknown>;
  assert.equal(diagnostics.totalEstimatedMonthlyIncome, 60.62);
  assert.equal(diagnostics.incomeCoverage, 100);
});

test("liquidez inválida falha fechado e não gera derivados de saída", () => {
  const prepared = prepareFiiRiskReportInput({
    portfolio: [
      { ticker: "BODB11", currentValue: 535.5, dailyLiquidity: 585 },
      { ticker: "MXRF11", currentValue: 144.45, dailyLiquidity: 14_717_512 },
      { ticker: "SEM11", currentValue: 100 },
    ],
  });
  const byTicker = Object.fromEntries(prepared.portfolio.map((asset) => [asset.ticker, asset]));

  assert.equal(byTicker.BODB11.liquidityDataQuality?.status, "invalid");
  assert.equal(byTicker.BODB11.positionToDailyLiquidityPercent, undefined);
  assert.equal(byTicker.BODB11.exitDaysAt20PctAdv, undefined);
  assert.equal(byTicker.MXRF11.liquidityDataQuality?.status, "valid");
  assert.equal(byTicker.MXRF11.positionToDailyLiquidityPercent, 0);
  assert.equal(byTicker.MXRF11.exitDaysAt20PctAdv, 0);
  assert.equal(byTicker.SEM11.liquidityDataQuality?.status, "missing");
  assert.equal(byTicker.SEM11.positionToDailyLiquidityPercent, undefined);
  assert.equal(byTicker.SEM11.exitDaysAt20PctAdv, undefined);

  const diagnostics = prepared.dataQualitySummary?.deterministicDiagnostics as Record<string, unknown>;
  assert.deepEqual(diagnostics.invalidLiquidityTickers, ["BODB11"]);
  assert.deepEqual(diagnostics.missingLiquidityTickers, ["SEM11"]);
  assert.match(String(diagnostics.calculationPolicy), /não produz percentual da posição nem estimativa de dias para saída/i);
});

test("fonte pública do IFIX é Dados FII e provedor técnico não chega ao prompt", () => {
  const input = {
    portfolio: [{ ticker: "MXRF11", quantity: 10, lastDividend: 0.1, currentValue: 100, dailyLiquidity: 1_000_000 }],
    benchmarkData: {
      ifix: {
        provider: "brapi",
        source: "brapi.dev",
        sourceType: "secondary_market_data_provider",
        close: 3_805.03,
        lastDate: "2026-07-24",
        attempts: [{ url: "https://example.com" }],
      },
      cdi: { source: "Banco Central do Brasil - SGS 12", twelveMonthsReturn: 14.6 },
      ipca: { source: "Banco Central do Brasil - SGS 433", twelveMonthsReturn: 4.55 },
      selic: { source: "Banco Central do Brasil - SGS 432", rate: 14.25 },
    },
  };

  const prepared = prepareFiiRiskReportInput(input);
  const ifix = prepared.benchmarkData?.ifix as Record<string, unknown>;
  assert.equal(ifix.source, "Dados FII");
  assert.equal(ifix.provider, undefined);
  assert.equal(ifix.attempts, undefined);
  assert.equal((prepared.benchmarkData?.cdi as Record<string, unknown>).source, "Banco Central do Brasil");

  const prompt = buildFiiRiskReportUserPrompt(input);
  assert.doesNotMatch(prompt, /brapi\.dev|secondary_market_data_provider|SGS 12|SGS 433|SGS 432/i);
  assert.match(prompt, /"source": "Dados FII"/);
});

test("prompt v2.3.1 aplica Modo Gestor e bloqueia derivados inválidos", () => {
  assert.equal(FII_RISK_REPORT_PROMPT_VERSION, "v2.3.1");
  const prompt = buildFiiRiskReportUserPrompt({ portfolio: [] });
  assert.match(prompt, /Modo Gestor — decisões e prioridades/);
  assert.match(prompt, /Não use nota de 0 a 10/);
  assert.match(prompt, /sem converter desconto em recomendação/i);
  assert.match(prompt, /não é possível estimar o risco de saída/i);
  assert.match(prompt, /Conteúdo informativo, sem recomendação de investimento/);
});
