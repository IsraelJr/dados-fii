import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ConcurrentAutomaticDividendSeriesService } from "../src/lib/risk-lab/ConcurrentAutomaticDividendSeriesService";
import { CvmMonthlyCohortDividendSeriesAdapter } from "../src/lib/risk-lab/CvmMonthlyCohortDividendSeriesAdapter";
import type { AutomaticMonthlySeries } from "../src/types/riskLabAutomatic";

function series(ticker: string): AutomaticMonthlySeries {
  return {
    status: "ready",
    observations: [],
    sources: [],
    missingMonths: [],
    conflicts: [],
    longestContiguousSequence: 12,
    method: "official_monthly_liability_per_share",
    detectorResult: null,
    detectorExecuted: true,
    classificationFinal: false,
    limitation: "material_credit_events_not_automatically_validated",
  };
}

test("adaptador usa CNPJ, anos e janela congelada do controle KNCR11", async () => {
  const calls: unknown[][] = [];
  const adapter = new CvmMonthlyCohortDividendSeriesAdapter({
    resolveCnpj: async (ticker) => {
      assert.equal(ticker, "KNCR11");
      return "16706958000132";
    },
    monthly: {
      async build(...args) {
        calls.push(args);
        return series(String(args[0]));
      },
    },
    now: () => new Date("2026-07-21T12:00:00-03:00"),
  });

  const result = await adapter.build("KNCR11", []);
  assert.equal(result.status, "ready");
  assert.deepEqual(calls, [[
    "KNCR11",
    "16706958000132",
    [2022, 2023, 2024, 2025],
    "2022-01-01",
    "2025-12-31",
  ]]);
});

test("janela aberta de DEVA11 termina na data atual injetada sem informação futura", async () => {
  let captured: unknown[] = [];
  const adapter = new CvmMonthlyCohortDividendSeriesAdapter({
    resolveCnpj: async () => "12345678000199",
    monthly: {
      async build(...args) {
        captured = args;
        return series(String(args[0]));
      },
    },
    now: () => new Date("2026-07-21T12:00:00-03:00"),
  });

  await adapter.build("DEVA11", []);
  assert.deepEqual(captured, [
    "DEVA11",
    "12345678000199",
    [2021, 2022, 2023, 2024, 2025, 2026],
    "2021-01-01",
    "2026-07-21",
  ]);
});

test("ticker fora da coorte falha fechado antes de consultar qualquer fonte", async () => {
  let calls = 0;
  const adapter = new CvmMonthlyCohortDividendSeriesAdapter({
    resolveCnpj: async () => {
      calls += 1;
      return "12345678000199";
    },
    monthly: {
      async build() {
        calls += 1;
        return series("ABCD11");
      },
    },
  });

  await assert.rejects(() => adapter.build("ABCD11", []), /não pertence à coorte externa congelada/);
  assert.equal(calls, 0);
});

test("serviço concorrente preserva contrato legado e delega ao lote oficial", async () => {
  let captured: unknown[] = [];
  const service = new ConcurrentAutomaticDividendSeriesService({
    resolveCnpj: async () => "16706958000132",
    monthly: {
      async build(...args) {
        captured = args;
        return series(String(args[0]));
      },
    },
    now: () => new Date("2026-07-21T12:00:00-03:00"),
    yearConcurrency: 3,
  });

  const result = await service.build("KNSC11", []);
  assert.equal(result.method, "official_monthly_liability_per_share");
  assert.deepEqual(captured, [
    "KNSC11",
    "16706958000132",
    [2022, 2023, 2024, 2025],
    "2022-01-01",
    "2025-12-31",
  ]);
});

test("caminho crítico não usa scraping FNET, aprovação manual, Premium ou notificações", () => {
  const concurrent = readFileSync("src/lib/risk-lab/ConcurrentAutomaticDividendSeriesService.ts", "utf8");
  const adapter = readFileSync("src/lib/risk-lab/CvmMonthlyCohortDividendSeriesAdapter.ts", "utf8");
  const monthly = readFileSync("src/lib/risk-lab/CvmMonthlyDividendSeriesService.ts", "utf8");
  const source = `${concurrent}\n${adapter}\n${monthly}`;

  assert.doesNotMatch(source, /fnet\.bmfbovespa|exibirDocumento|visualizarProtocolo/);
  assert.doesNotMatch(source, /manual_document_review|confirm\(|approve\(|sendNotification|sendEmail|premiumIntegrated/);
  assert.match(source, /inf_mensal_fii_/);
  assert.match(source, /dados\.cvm\.gov\.br/);
});
