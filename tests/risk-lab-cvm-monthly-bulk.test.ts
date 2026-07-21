import assert from "node:assert/strict";
import test from "node:test";
import { zipSync } from "fflate";
import {
  deriveCvmMonthlyYear,
  parseCvmMonthlyArchive,
} from "../src/lib/risk-lab/CvmMonthlyBulkParser";
import { CvmMonthlyDividendSeriesService } from "../src/lib/risk-lab/CvmMonthlyDividendSeriesService";

const CNPJ = "16.706.958/0001-32";
const CNPJ_DIGITS = "16706958000132";

function bytes(value: string) {
  return new TextEncoder().encode(value);
}

interface MonthFixture {
  month: number;
  amount: number;
  version?: number;
  deliveredAt?: string;
  shares?: number;
}

function archiveZip(year: number, months: MonthFixture[]) {
  const ativo = ["CNPJ_Fundo_Classe;Data_Referencia;Versao;Rendimentos_Distribuir"];
  const complemento = ["CNPJ_Fundo_Classe;Data_Referencia;Versao;Cotas_Emitidas"];
  const geral = ["CNPJ_Fundo_Classe;Data_Referencia;Versao;Cotas_Emitidas;Data_Entrega"];

  for (const item of months) {
    const month = String(item.month).padStart(2, "0");
    const reference = `${year}-${month}-28`;
    const version = item.version || 1;
    const shares = item.shares || 100_000_000;
    const distribution = Math.round(item.amount * shares * 100) / 100;
    const deliveredAt = item.deliveredAt || `${year}-${month}-15 18:00:00`;
    ativo.push(`${CNPJ};${reference};${version};${distribution}`);
    complemento.push(`${CNPJ};${reference};${version};${shares}`);
    geral.push(`${CNPJ};${reference};${version};${shares};${deliveredAt}`);
  }

  return zipSync({
    [`inf_mensal_fii_ativo_passivo_${year}.csv`]: bytes(`${ativo.join("\n")}\n`),
    [`inf_mensal_fii_complemento_${year}.csv`]: bytes(`${complemento.join("\n")}\n`),
    [`inf_mensal_fii_geral_${year}.csv`]: bytes(`${geral.join("\n")}\n`),
  });
}

test("parser deriva rendimento por cota com hash, versão e Data_Entrega oficiais", () => {
  const zip = archiveZip(2023, [
    { month: 1, amount: 1.2 },
    { month: 2, amount: 1.1 },
  ]);
  const sourceUrl = "https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_2023.zip";
  const archive = parseCvmMonthlyArchive(2023, sourceUrl, zip);
  const result = deriveCvmMonthlyYear(
    "KNCR11",
    CNPJ_DIGITS,
    archive,
    "2023-01-01",
    "2023-12-31",
    "2026-07-21T12:00:00-03:00",
  );

  assert.equal(result.conflicts.length, 0);
  assert.equal(result.observations.length, 2);
  assert.equal(result.observations[0].competenceMonth, "2023-01");
  assert.equal(result.observations[0].amountPerShare, 1.2);
  assert.equal(result.observations[0].announcedAt, "2023-01-15T18:00:00-03:00");
  assert.equal(result.observations[0].source.sourceUrl, sourceUrl);
  assert.equal(result.observations[0].source.sourceVersion, "inf_mensal_fii_2023.zip:v1");
  assert.match(result.observations[0].source.sourceHash || "", /^[a-f0-9]{64}$/);
  assert.match(result.observations[0].source.protocolHash || "", /^[a-f0-9]{64}$/);
  assert.equal(result.observations[0].source.protocolVersion, 1);
});

test("revisão futura não substitui a versão conhecida na data simulada", () => {
  const archive = parseCvmMonthlyArchive(
    2023,
    "https://dados.cvm.gov.br/inf_mensal_fii_2023.zip",
    archiveZip(2023, [
      { month: 1, amount: 1.2, version: 1, deliveredAt: "2023-01-15 18:00:00" },
      { month: 1, amount: 0.5, version: 2, deliveredAt: "2024-01-10 12:00:00" },
    ]),
  );
  const result = deriveCvmMonthlyYear(
    "KNCR11",
    CNPJ_DIGITS,
    archive,
    "2023-01-01",
    "2023-12-31",
    "2026-07-21T12:00:00-03:00",
  );

  assert.equal(result.conflicts.length, 0);
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0].amountPerShare, 1.2);
  assert.equal(result.observations[0].source.protocolVersion, 1);
  assert.equal(result.observations[0].source.sourceVersion, "inf_mensal_fii_2023.zip:v1");
});

test("Data_Entrega posterior à janela simulada é excluída sem virar zero", () => {
  const archive = parseCvmMonthlyArchive(
    2023,
    "https://dados.cvm.gov.br/inf_mensal_fii_2023.zip",
    archiveZip(2023, [
      { month: 1, amount: 1 },
      { month: 2, amount: 1, deliveredAt: "2024-01-10 12:00:00" },
    ]),
  );
  const result = deriveCvmMonthlyYear(
    "KNCR11",
    CNPJ_DIGITS,
    archive,
    "2023-01-01",
    "2023-12-31",
    "2026-07-21T12:00:00-03:00",
  );

  assert.deepEqual(result.observations.map((item) => item.competenceMonth), ["2023-01"]);
  assert.equal(result.conflicts.length, 0);
});

test("cotas divergentes entre tabelas bloqueiam a competência", () => {
  const zip = archiveZip(2023, [{ month: 1, amount: 1 }]);
  const files = zipSync({
    "inf_mensal_fii_ativo_passivo_2023.csv": bytes(
      `CNPJ_Fundo_Classe;Data_Referencia;Versao;Rendimentos_Distribuir\n${CNPJ};2023-01-28;1;100000000\n`,
    ),
    "inf_mensal_fii_complemento_2023.csv": bytes(
      `CNPJ_Fundo_Classe;Data_Referencia;Versao;Cotas_Emitidas\n${CNPJ};2023-01-28;1;100000000\n`,
    ),
    "inf_mensal_fii_geral_2023.csv": bytes(
      `CNPJ_Fundo_Classe;Data_Referencia;Versao;Cotas_Emitidas;Data_Entrega\n${CNPJ};2023-01-28;1;90000000;2023-01-15 18:00:00\n`,
    ),
  });
  assert.ok(zip.byteLength > 0);
  const archive = parseCvmMonthlyArchive(2023, "https://dados.cvm.gov.br/inf_mensal_fii_2023.zip", files);
  const result = deriveCvmMonthlyYear(
    "KNCR11",
    CNPJ_DIGITS,
    archive,
    "2023-01-01",
    "2023-12-31",
    "2026-07-21T12:00:00-03:00",
  );

  assert.equal(result.observations.length, 0);
  assert.ok(result.conflicts.some((item) => item.includes("cotas divergentes")));
});

test("serviço anual usa cache e produz série pronta com doze competências", async () => {
  const zip = archiveZip(2024, Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    amount: index < 6 ? 1 : 0.9,
  })));
  const body = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
  let calls = 0;
  const service = new CvmMonthlyDividendSeriesService({
    fetchImpl: (async () => {
      calls += 1;
      return new Response(body, {
        status: 200,
        headers: { "content-type": "application/zip" },
      });
    }) as typeof fetch,
    now: () => new Date("2026-07-21T12:00:00-03:00"),
  });

  const first = await service.build("KNCR11", CNPJ_DIGITS, [2024], "2024-01-01", "2024-12-31");
  const second = await service.build("KNSC11", CNPJ_DIGITS, [2024], "2024-01-01", "2024-12-31");

  assert.equal(calls, 1);
  assert.equal(first.status, "ready");
  assert.equal(first.observations.length, 12);
  assert.equal(first.longestContiguousSequence, 12);
  assert.equal(first.method, "official_monthly_liability_per_share");
  assert.equal(first.detectorExecuted, true);
  assert.equal(second.observations.length, 12);
});
