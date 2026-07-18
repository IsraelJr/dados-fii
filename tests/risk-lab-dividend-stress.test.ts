import assert from "node:assert/strict";
import test from "node:test";
import { DividendStressWindowEngine } from "../src/lib/risk-lab/DividendStressWindowEngine";
import type {
  VerifiedDividendNotice,
  VerifiedMaterialCreditEvent,
} from "../src/types/riskLabDividendStress";

const engine = new DividendStressWindowEngine();

function monthAfter(start: string, offset: number) {
  const [year, month] = start.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function notices(
  amounts: number[],
  options: {
    ticker?: string;
    start?: string;
    sourceUrl?: string;
    sourceType?: "primary_regulatory" | "primary_manager";
  } = {},
): VerifiedDividendNotice[] {
  const ticker = options.ticker || "MCCI11";
  const start = options.start || "2023-01";
  const sourceUrl = options.sourceUrl || "https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?id=1";
  const sourceType = options.sourceType || "primary_regulatory";

  return amounts.map((amountPerShare, index) => {
    const competenceMonth = monthAfter(start, index);
    const announcedAt = `${monthAfter(start, index + 1)}-05T18:00:00-03:00`;
    return {
      ticker,
      competenceMonth,
      amountPerShare,
      announcedAt,
      source: {
        documentId: `${ticker}-${competenceMonth}`,
        sourceUrl,
        sourceType,
        reviewMethod: "manual_document_review",
        reviewedBy: "risk-lab-test",
        reviewedAt: "2026-07-18T12:00:00-03:00",
        page: 1,
        excerpt: `Rendimento confirmado de R$ ${amountPerShare.toFixed(2)} por cota.`,
      },
    };
  });
}

function materialEvent(ticker = "MCCI11"): VerifiedMaterialCreditEvent {
  return {
    ticker,
    knownAt: "2023-11-20T18:00:00-03:00",
    type: "default",
    documentId: `${ticker}-default-1`,
    sourceUrl: "https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?id=999",
    reviewedBy: "risk-lab-test",
    reviewedAt: "2026-07-18T12:00:00-03:00",
  };
}

test("queda exata de 20% seguida de recuperação de 90% confirma estresse reversível", () => {
  const result = engine.detect(notices([
    1, 1, 1, 1, 1, 1,
    0.8, 0.8, 0.8,
    0.9, 0.9, 0.9,
  ]));

  assert.equal(result.status, "reversible_stress_confirmed");
  assert.equal(result.baselineMedian, 1);
  assert.equal(result.stressAverage, 0.8);
  assert.equal(result.stressDropPercent, 20);
  assert.equal(result.recoveryAverage, 0.9);
  assert.equal(result.recoveryPercentOfBaseline, 90);
  assert.deepEqual(result.stressMonths, ["2023-07", "2023-08", "2023-09"]);
  assert.deepEqual(result.recoveryMonths, ["2023-10", "2023-11", "2023-12"]);
});

test("queda de 19% não atende ao critério pré-registrado", () => {
  const result = engine.detect(notices([
    1, 1, 1, 1, 1, 1,
    0.81, 0.81, 0.81,
    1, 1, 1,
  ]));

  assert.equal(result.status, "no_qualifying_stress");
  assert.equal(result.stressDetectedAt, null);
});

test("detecção usa a data do terceiro anúncio, não a competência", () => {
  const series = notices([1, 1, 1, 1, 1, 1, 0.8, 0.8, 0.8]);
  series[8].announcedAt = "2023-10-19T21:30:00-03:00";

  const result = engine.detect(series);

  assert.equal(result.status, "stress_without_recovery");
  assert.equal(result.stressDetectedAt, "2023-10-19T21:30:00-03:00");
});

test("mês ausente impede atravessar lacuna e fabricar recuperação", () => {
  const series = notices([
    1, 1, 1, 1, 1, 1,
    0.8, 0.8, 0.8,
    0.9, 0.9, 0.9, 0.9,
  ]);
  series.splice(9, 1);

  const result = engine.detect(series);

  assert.equal(result.status, "stress_without_recovery");
  assert.deepEqual(result.recoveryMonths, []);
});

test("default material conhecido até a recuperação bloqueia classificação reversível", () => {
  const result = engine.detect(
    notices([
      1, 1, 1, 1, 1, 1,
      0.8, 0.8, 0.8,
      0.9, 0.9, 0.9,
    ]),
    { creditEvents: [materialEvent()] },
  );

  assert.equal(result.status, "recovery_blocked_by_material_credit_event");
  assert.equal(result.blockingCreditEvent?.type, "default");
});

test("fonte fora dos hosts oficiais é rejeitada", () => {
  assert.throws(
    () => engine.detect(notices([1, 1, 1, 1, 1, 1, 0.8, 0.8, 0.8], {
      sourceUrl: "https://agregador.example/rendimento",
    })),
    /Fonte de rendimento não é primária autorizada/,
  );
});

test("tipo de fonte secundária é rejeitado mesmo com URL oficial", () => {
  const series = notices([1, 1, 1, 1, 1, 1, 0.8, 0.8, 0.8]) as Array<VerifiedDividendNotice & {
    source: VerifiedDividendNotice["source"] & { sourceType: string };
  }>;
  series[0].source.sourceType = "secondary";

  assert.throws(
    () => engine.detect(series as VerifiedDividendNotice[]),
    /Tipo de fonte não autorizado/,
  );
});

test("competência duplicada é rejeitada", () => {
  const series = notices([1, 1, 1, 1, 1, 1, 0.8, 0.8, 0.8]);
  series[8].competenceMonth = series[7].competenceMonth;

  assert.throws(() => engine.detect(series), /Competência duplicada/);
});

test("menos de nove observações não produz estresse", () => {
  const result = engine.detect(notices([1, 1, 1, 1, 1, 0.8, 0.8, 0.8]));

  assert.equal(result.status, "no_qualifying_stress");
  assert.equal(result.observationsUsed, 8);
});
