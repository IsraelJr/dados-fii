import assert from "node:assert/strict";
import test from "node:test";
import { DividendStressRunService, hashVerifiedDividendNotices } from "../src/lib/risk-lab/DividendStressRunService";
import type { VerifiedDividendNotice } from "../src/types/riskLabDividendStress";
import type {
  DividendStressRun,
  DividendStressRunRepository,
  DividendStressRunTicker,
  VerifiedDividendNoticeReader,
} from "../src/types/riskLabDividendStressRun";

function monthAfter(start: string, offset: number) {
  const [year, month] = start.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function notices(
  values: number[],
  ticker: DividendStressRunTicker = "MCCI11",
  start = "2023-01",
): VerifiedDividendNotice[] {
  return values.map((amountPerShare, index) => {
    const competenceMonth = monthAfter(start, index);
    return {
      ticker,
      competenceMonth,
      amountPerShare,
      announcedAt: `${monthAfter(competenceMonth, 1)}-05T18:00:00-03:00`,
      source: {
        documentId: `${1000 + index}`,
        sourceUrl: `https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?id=${1000 + index}`,
        sourceType: "primary_regulatory",
        reviewMethod: "manual_document_review",
        reviewedBy: "reviewer@dadosfii.test",
        reviewedAt: "2026-07-18T12:00:00-03:00",
        page: null,
        excerpt: `Aviso estruturado confirmado para ${competenceMonth}.`,
      },
    };
  });
}

class FakeNoticeReader implements VerifiedDividendNoticeReader {
  current: VerifiedDividendNotice[];

  constructor(current: VerifiedDividendNotice[]) {
    this.current = current;
  }

  async listByTicker(ticker: string) {
    return this.current.filter((notice) => notice.ticker === ticker);
  }
}

class FakeRunRepository implements DividendStressRunRepository {
  runs = new Map<string, DividendStressRun>();
  saveCalls = 0;

  async getById(id: string) {
    return this.runs.get(id) || null;
  }

  async save(run: DividendStressRun) {
    this.saveCalls += 1;
    if (!this.runs.has(run.id)) this.runs.set(run.id, run);
    return this.runs.get(run.id)!;
  }

  async listLatestByTicker(ticker: DividendStressRunTicker, limit = 10) {
    return [...this.runs.values()]
      .filter((run) => run.ticker === ticker)
      .sort((left, right) => Date.parse(right.executedAt) - Date.parse(left.executedAt))
      .slice(0, limit);
  }
}

function serviceWith(series: VerifiedDividendNotice[]) {
  const reader = new FakeNoticeReader(series);
  const repository = new FakeRunRepository();
  const service = new DividendStressRunService({
    noticeReader: reader,
    runRepository: repository,
    now: () => "2026-07-18T18:00:00-03:00",
  });
  return { service, reader, repository };
}

test("oito meses consecutivos bloqueiam a execução", async () => {
  const { service, repository } = serviceWith(notices(Array(8).fill(1)));

  await assert.rejects(
    service.execute("MCCI11", "admin@dadosfii.test"),
    /Série insuficiente.*8\/9/,
  );
  assert.equal(repository.saveCalls, 0);
});

test("nove observações com lacuna continuam bloqueadas", async () => {
  const series = notices(Array(10).fill(1)).filter((notice) => notice.competenceMonth !== "2023-05");
  const { service, repository } = serviceWith(series);

  await assert.rejects(service.execute("MCCI11", "admin@dadosfii.test"), /Série insuficiente/);
  assert.equal(repository.saveCalls, 0);
});

test("nove meses consecutivos geram execução persistida sem efeitos externos", async () => {
  const { service, repository } = serviceWith(notices(Array(9).fill(1)));
  const result = await service.execute("MCCI11", "admin@dadosfii.test");

  assert.equal(result.created, true);
  assert.equal(result.run.result.status, "no_qualifying_stress");
  assert.equal(result.run.readiness.detectorExecuted, true);
  assert.equal(result.run.manualConfirmation, true);
  assert.equal(result.run.classificationFinal, false);
  assert.deepEqual(result.run.limitations, ["material_credit_events_not_reviewed"]);
  assert.deepEqual(result.run.externalEffects, {
    alertsCreated: false,
    notificationsSent: false,
    premiumUpdated: false,
  });
  assert.equal(repository.saveCalls, 1);
});

test("repetir a execução com o mesmo snapshot é idempotente", async () => {
  const { service, repository } = serviceWith(notices(Array(9).fill(1)));
  const first = await service.execute("MCCI11", "admin@dadosfii.test");
  const second = await service.execute("MCCI11", "other-admin@dadosfii.test");

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.run.id, first.run.id);
  assert.equal(second.run.executedBy, "admin@dadosfii.test");
  assert.equal(repository.saveCalls, 1);
});

test("alterar uma observação produz novo hash e nova execução", async () => {
  const initial = notices(Array(9).fill(1));
  const { service, reader, repository } = serviceWith(initial);
  const first = await service.execute("MCCI11", "admin@dadosfii.test");

  reader.current = notices([1, 1, 1, 1, 1, 1, 1, 1, 0.99]);
  const second = await service.execute("MCCI11", "admin@dadosfii.test");

  assert.notEqual(second.run.inputHash, first.run.inputHash);
  assert.notEqual(second.run.id, first.run.id);
  assert.equal(repository.saveCalls, 2);
});

test("resultado matemático de recuperação permanece preliminar sem revisão de crédito", async () => {
  const values = [1, 1, 1, 1, 1, 1, 0.8, 0.8, 0.8, 0.9, 0.9, 0.9];
  const { service } = serviceWith(notices(values, "RBRY11"));
  const result = await service.execute("RBRY11", "admin@dadosfii.test");

  assert.equal(result.run.result.status, "reversible_stress_confirmed");
  assert.equal(result.run.classificationFinal, false);
  assert.deepEqual(result.run.limitations, ["material_credit_events_not_reviewed"]);
});

test("hash independe da ordem recebida e muda com o documento", () => {
  const series = notices(Array(9).fill(1));
  const reversed = [...series].reverse();
  assert.equal(hashVerifiedDividendNotices(series), hashVerifiedDividendNotices(reversed));

  const changed = structuredClone(series);
  changed[0].source.documentId = "999999";
  assert.notEqual(hashVerifiedDividendNotices(series), hashVerifiedDividendNotices(changed));
});

test("ticker e responsável inválidos são rejeitados", async () => {
  const { service } = serviceWith(notices(Array(9).fill(1)));
  await assert.rejects(service.execute("HCTR11", "admin@dadosfii.test"), /Ticker não suportado/);
  await assert.rejects(service.execute("MCCI11", "admin-sem-email"), /Responsável administrativo inválido/);
});
