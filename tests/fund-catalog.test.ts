import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Native strip-types requires explicit extension.
import { FundCatalogEngine } from "../src/lib/catalog/FundCatalogEngine.ts";
// @ts-expect-error Native strip-types requires explicit extension.
import { parseB3Instruments, parseCvmRegistrations, parseFiagroMonthly, parseLatestDailyFunds, parseLatestFiiComplement, publicDirectoryCnpj } from "../src/lib/catalog/OfficialCatalogSources.ts";
import type { B3InstrumentRecord, CvmRegistrationRecord, OfficialCatalogDataset } from "../src/lib/catalog/OfficialCatalogSources.ts";

const encoder = new TextEncoder();
const now = "2026-07-16T12:00:00.000Z";

function fixedLine(length = 140) {
  return Array.from({ length }, () => " ");
}

function put(line: string[], start: number, end: number, value: string) {
  const padded = value.slice(0, end - start).padEnd(end - start, " ");
  for (let index = 0; index < padded.length; index += 1) line[start + index] = padded[index];
}

function b3Pair(ticker: string, legalName: string, category: string) {
  const issuer = fixedLine();
  put(issuer, 0, 2, "01");
  put(issuer, 2, 6, ticker.slice(0, 4));
  put(issuer, 6, 66, legalName);
  put(issuer, 66, 86, ticker);
  const instrument = fixedLine();
  put(instrument, 0, 2, "02");
  put(instrument, 2, 14, ticker);
  put(instrument, 21, 81, category);
  put(instrument, 111, 126, "VISTA");
  return [issuer.join(""), instrument.join("")];
}

function registration(cnpj: string, kind: CvmRegistrationRecord["kind"], legalName: string): CvmRegistrationRecord {
  return {
    cnpj,
    cvmCode: "1",
    kind,
    legalName,
    status: "EM FUNCIONAMENTO NORMAL",
    registrationDate: "2020-01-01",
    operatingSince: "2020-01-01",
    canceledAt: null,
    netWorth: null,
    netWorthDate: null,
    administrator: { name: "ADMINISTRADORA TESTE", cnpj: "11222333000144" },
    managers: [{ name: "GESTORA TESTE", cnpj: "55666777000188" }],
  };
}

function instrument(ticker: string, kindHint: B3InstrumentRecord["kindHint"], legalName: string, isin: string | null = null): B3InstrumentRecord {
  return { ticker, kindHint, legalName, isin, issuerCode: ticker.slice(0, 4), tradeName: ticker, category: kindHint === "FII" ? "FUNDOS IMOBILIARIOS" : "CERT.INVEST/TIT.DIV.PUBLICA" };
}

function dataset(overrides: Partial<OfficialCatalogDataset>): OfficialCatalogDataset {
  return {
    fetchedAt: now,
    sources: [
      { id: "b3-instruments", provider: "B3", url: "https://b3.test", fetchedAt: now, referenceDate: "2026-07-16", sha256: "a".repeat(64), bytes: 10_000 },
      { id: "cvm-registration", provider: "CVM", url: "https://cvm.test/cad", fetchedAt: now, referenceDate: "2026-07-16", sha256: "b".repeat(64), bytes: 10_000 },
      { id: "cvm-monthly", provider: "CVM", url: "https://cvm.test/monthly", fetchedAt: now, referenceDate: "2026-06-30", sha256: "c".repeat(64), bytes: 10_000 },
      { id: "cvm-fiagro-monthly", provider: "CVM", url: "https://cvm.test/fiagro", fetchedAt: now, referenceDate: "2026-06-01", sha256: "e".repeat(64), bytes: 10_000 },
      { id: "cvm-daily", provider: "CVM", url: "https://cvm.test/daily", fetchedAt: now, referenceDate: "2026-07-15", sha256: "d".repeat(64), bytes: 10_000 },
    ],
    b3: [],
    registrations: [],
    monthlyGeneral: new Map(),
    monthlyComplement: new Map(),
    monthlyAssets: new Map(),
    monthlyFiagro: new Map(),
    dailyFunds: new Map(),
    publicCnpjByTicker: new Map(),
    ...overrides,
  };
}

test("catálogo B3 inclui FII, FIAGRO e FI-Infra, mas exclui FIP de infraestrutura", () => {
  const lines = [
    ...b3Pair("TEST11", "FUNDO IMOBILIARIO TESTE", "FUNDOS IMOBILIARIOS"),
    ...b3Pair("AGRO11", "FUNDO DE INVESTIMENTO FIAGRO TESTE", "CERT.INVEST/TIT.DIV.PUBLICA"),
    ...b3Pair("BODB11", "BOCAINA FDO DE INVESTIMENTO EM INFRAESTRUTURA RF", "CERT.INVEST/TIT.DIV.PUBLICA"),
    ...b3Pair("FIPX11", "FUNDO DE INVESTIMENTO EM PARTICIPACOES EM INFRAESTRUTURA", "CERT.INVEST/TIT.DIV.PUBLICA"),
  ];
  const parsed = parseB3Instruments(encoder.encode(lines.join("\n")));
  assert.deepEqual(parsed.map((item) => [item.ticker, item.kindHint]), [
    ["AGRO11", "FIAGRO"],
    ["BODB11", "FI_INFRA"],
    ["TEST11", "FII"],
  ]);
});

test("ponte pública só aceita o CNPJ quando a página pertence ao ticker esperado", () => {
  const html = "<title>BISE11 - BRADESCO ISENTO</title><h4>Cnpj</h4><strong>64.964.327/0001-66</strong>";
  assert.equal(publicDirectoryCnpj(html, "BISE11"), "64964327000166");
  assert.equal(publicDirectoryCnpj(html, "CDII11"), null);
});

test("informe mensal FIAGRO normaliza patrimônio, cotas e composição PF/PJ sem duplicar o documento", () => {
  const csv = [
    "CNPJ_Classe;Nome_Classe;Data_Referencia;Codigo_ISIN;Numero_Cotistas;Numero_Cotistas_Pessoa_Natural;Numero_Cotistas_Pessoa_Juridica_Nao_Financeira;Numero_Cotistas_Pessoa_Juridica_Financeira;Patrimonio_Liquido;Cotas_Emitidas;Valor_Patrimonial_Cotas;Total_Investido;Imoveis_Rurais;Participacoes_Societarias;Titulos_Divida_Corporativa;Valor_Titulos_Credito;Demais_Direitos_Creditorios;Titulos_Securitizacao;Cotas_Fundos_Investimento;Total_Necessidades_Liquidez",
    "41.745.701/0001-37;KINEA CRÉDITO AGRO FIAGRO;2026-06-01;BRKNCACTF006;50000;49750;150;100;2200000000;200000000;11;2150000000;0;0;100000000;1800000000;50000000;100000000;50000000;50000000",
  ].join("\n");
  const parsed = parseFiagroMonthly(encoder.encode(csv));
  assert.equal(parsed.raw.size, 1);
  assert.equal(parsed.complement.get("41745701000137")?.Total_Numero_Cotistas, "50000");
  assert.equal(parsed.complement.get("41745701000137")?.Numero_Cotistas_Pessoa_Fisica, "49750");
  assert.equal(parsed.assets.get("41745701000137")?.CRI_CRA, "2050000000");
});

test("informe FII preserva a última composição PF/PJ coerente quando a competência mais nova vem sem abertura", () => {
  const csv = [
    "CNPJ_Fundo_Classe;Data_Referencia;Versao;Data_Informacao_Numero_Cotistas;Total_Numero_Cotistas;Numero_Cotistas_Pessoa_Fisica;Numero_Cotistas_Pessoa_Juridica_Nao_Financeira;Patrimonio_Liquido;Cotas_Emitidas",
    "01.201.140/0001-90;2026-04-01;1;2026-04-30;13000;12800;200;500000000;4700000",
    "01.201.140/0001-90;2026-05-01;1;2026-05-31;13433;;;521976248.89;4709082",
  ].join("\n");
  const row = parseLatestFiiComplement(encoder.encode(csv)).get("01201140000190")!;
  assert.equal(row.Data_Referencia, "2026-05-01");
  assert.equal(row.Patrimonio_Liquido, "521976248.89");
  assert.equal(row.Total_Numero_Cotistas, "13000");
  assert.equal(row.Numero_Cotistas_Pessoa_Fisica, "12800");
  assert.equal(row.Data_Referencia_Composicao_Cotistas, "2026-04-30");
});

test("cadastro CVM reconhece fundo FI-Infra sem transformar qualquer fundo financeiro em infraestrutura", () => {
  const headers = ["Tipo_Fundo", "CNPJ_Fundo", "ID_Registro_Fundo", "Codigo_CVM", "Denominacao_Social", "Situacao", "Data_Inicio_Situacao", "Data_Cancelamento", "Data_Registro", "Data_Constituicao", "Patrimonio_Liquido", "Data_Patrimonio_Liquido", "Administrador", "CNPJ_Administrador", "Gestor", "CPF_CNPJ_Gestor"];
  const rows = [
    ["FI", "41.771.670/0001-99", "infra-1", "1", "BOCAINA FUNDO DE INVESTIMENTO EM INFRAESTRUTURA RF", "EM FUNCIONAMENTO NORMAL", "2020-01-01", "", "2020-01-01", "2020-01-01", "1000,00", "2026-07-15", "ADMIN", "11.222.333/0001-44", "GESTORA", "55.666.777/0001-88"],
    ["FI", "00.000.000/0001-00", "generic-1", "2", "FUNDO DE RENDA FIXA GENERICO", "EM FUNCIONAMENTO NORMAL", "2020-01-01", "", "2020-01-01", "2020-01-01", "1000,00", "2026-07-15", "ADMIN", "11.222.333/0001-44", "GESTORA", "55.666.777/0001-88"],
  ];
  const parsed = parseCvmRegistrations(encoder.encode([headers.join(";"), ...rows.map((row) => row.join(";"))].join("\n")));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].cnpj, "41771670000199");
  assert.equal(parsed[0].kind, "FI_INFRA");
});

test("FI-Infra recebe PL, cota, quantidade derivada de cotas e total de cotistas da fonte diária", () => {
  const cnpj = "41771670000199";
  const engine = new FundCatalogEngine();
  const result = engine.build(dataset({
    b3: [instrument("BODB11", "FI_INFRA", "BOCAINA INFRA")],
    registrations: [registration(cnpj, "FI_INFRA", "BOCAINA FUNDO DE INVESTIMENTO EM INFRAESTRUTURA RF")],
    dailyFunds: new Map([[cnpj, { CNPJ_FUNDO_CLASSE: cnpj, DT_COMPTC: "2026-07-15", VL_PATRIM_LIQ: "760000000,00", VL_QUOTA: "76,00", NR_COTST: "25000" }]]),
  }), [{ id: "BODB11", data: { code: "BODB11", cnpj } }], [], "admin@test.com");
  const entry = result.items.find((item) => item.ticker === "BODB11")!.catalog;
  assert.equal(entry.identity.kind, "FI_INFRA");
  assert.equal(entry.classification.sector, "Infraestrutura");
  assert.equal(entry.capital?.issuedShares, 10_000_000);
  assert.equal(entry.capital?.reportedNavPerShare, 76);
  assert.equal(entry.investors?.totalAccounts, 25_000);
  assert.equal(entry.investors?.individualAccounts, null);
  assert.equal(entry.dataQuality.basicComplete, true);
  assert.equal(entry.dataQuality.essentialComplete, true);
  assert.match(entry.dataQuality.warnings.join(" "), /não separa PF e PJ/i);
});

test("informe diário preserva o último total positivo de cotistas quando a linha mais nova vem zerada", () => {
  const cnpj = "54895184000124";
  const csv = [
    "TP_FUNDO_CLASSE;CNPJ_FUNDO_CLASSE;DT_COMPTC;VL_PATRIM_LIQ;VL_QUOTA;NR_COTST",
    `CLASSES - FIF;${cnpj};2026-07-10;136628401.65;9.10856011;5365`,
    `CLASSES - FIF;${cnpj};2026-07-14;136769937.34;9.11799582;0`,
  ].join("\n");
  const latest = parseLatestDailyFunds(encoder.encode(csv), new Set([cnpj])).get(cnpj)!;
  assert.equal(latest.NR_COTST, "5365");
  assert.equal(latest.NR_COTST_REFERENCE_DATE, "2026-07-10");
  assert.equal(latest.DT_COMPTC, "2026-07-14");
});

test("patrimônio regulatório negativo é preservado como alerta, não tratado como campo ausente", () => {
  const cnpj = "00613094000174";
  const result = new FundCatalogEngine().build(dataset({
    b3: [instrument("PABY11", "FII", "FII PANAMBY")],
    registrations: [registration(cnpj, "FII", "FUNDO DE INVESTIMENTO IMOBILIÁRIO PANAMBY")],
    monthlyComplement: new Map([[cnpj, { Data_Referencia: "2026-05-01", Patrimonio_Liquido: "-26327409.6", Cotas_Emitidas: "758400", Valor_Patrimonial_Cotas: "-34.7144", Total_Numero_Cotistas: "518", Numero_Cotistas_Pessoa_Fisica: "501" }]]),
  }), [{ id: "PABY11", data: { code: "PABY11", cnpj } }], [], "admin@test.com");
  const entry = result.items.find((item) => item.ticker === "PABY11")!.catalog;
  assert.equal(entry.capital?.netWorth, -26_327_409.6);
  assert.equal(entry.dataQuality.missingEssential.includes("patrimônio líquido"), false);
  assert.match(entry.dataQuality.warnings.join(" "), /não positivo/i);
});

test("composição de cotistas preserva contagens brutas e não inventa o maior cotista PJ", () => {
  const cnpj = "97521225000125";
  const engine = new FundCatalogEngine();
  const result = engine.build(dataset({
    b3: [instrument("MXRF11", "FII", "MAXI RENDA")],
    registrations: [registration(cnpj, "FII", "MAXI RENDA FUNDO DE INVESTIMENTO IMOBILIARIO")],
    monthlyComplement: new Map([[cnpj, {
      Data_Referencia: "2026-05-31",
      Patrimonio_Liquido: "4313000000,00",
      Cotas_Emitidas: "460270000",
      Valor_Patrimonial_Cotas: "9,372",
      Total_Numero_Cotistas: "1468513",
      Numero_Cotistas_Pessoa_Fisica: "1467643",
      Numero_Cotistas_Pessoa_Juridica_Nao_Financeira: "400",
      Numero_Cotistas_Banco_Comercial: "10",
    }]]),
  }), [{ id: "MXRF11", data: { code: "MXRF11", cnpj } }], [], "admin@test.com");
  const entry = result.items.find((item) => item.ticker === "MXRF11")!.catalog;
  assert.equal(entry.investors?.totalAccounts, 1_468_513);
  assert.equal(entry.investors?.individualAccounts, 1_467_643);
  assert.equal(entry.investors?.legalEntityAccounts, 870);
  assert.equal(entry.investors?.largestLegalEntityHolder, null);
});

test("conciliação por assinatura resolve nomes abreviados sem escolher um fundo genérico", () => {
  const caete = registration("50749446000191", "FIAGRO", "CAETÊ FIAGRO - FUNDO DE INVESTIMENTO NAS CADEIAS PRODUTIVAS DO AGRONEGÓCIO");
  const generic = registration("41272747000186", "FIAGRO", "PATRIA CREDITO AGRO FI NAS CADEIAS PRODUTIVAS DO AGRONEGOCIO - FIAGRO");
  const result = new FundCatalogEngine().build(dataset({
    b3: [instrument("CTEM11", "FIAGRO", "CAETÊ FIAGRO - FI NAS CAD PROD DO AGRO")],
    registrations: [generic, caete],
  }), [], [], "admin@test.com");
  assert.equal(result.items.find((item) => item.ticker === "CTEM11")?.catalog.identity.cnpj, caete.cnpj);
});

test("conciliação prefere feeder/FIC ao master quando só o feeder está descrito no ticker listado", () => {
  const feeder = { ...registration("58171813000124", "FI_INFRA", "VALORA DEBÊNTURES INCENTIVADAS FI EM COTAS DE FUNDOS INCENTIVADOS DE INVESTIMENTO EM INFRA RENDA FIXA"), isFundOfFunds: true };
  const master = { ...registration("59312403000119", "FI_INFRA", "VALORA DEBÊNTURES INCENTIVADAS MASTER I FUNDO INCENTIVADO DE INVESTIMENTO EM INFRA RENDA FIXA"), isFundOfFunds: false };
  const result = new FundCatalogEngine().build(dataset({
    b3: [instrument("VALO11", "FI_INFRA", "VALORA DEB INC FIC FDO INC INV INFRA RF")],
    registrations: [master, feeder],
  }), [], [], "admin@test.com");
  assert.equal(result.items.find((item) => item.ticker === "VALO11")?.catalog.identity.cnpj, feeder.cnpj);
});

test("conciliação usa as marcas distintivas e não confunde AF Invest com Infra Real Estate", () => {
  const af = registration("60077386000161", "FII", "AF INVEST REAL ESTATE MULTIESTRATÉGIA FUNDO DE INVESTIMENTO IMOBILIÁRIO");
  const infra = registration("18369510000104", "FII", "FUNDO DE INVESTIMENTO IMOBILIÁRIO INFRA REAL ESTATE");
  const result = new FundCatalogEngine().build(dataset({
    b3: [instrument("AFHF11", "FII", "AF INVEST REAL ESTATE MULTIFUN DE INV IMO LTDA")],
    registrations: [infra, af],
  }), [], [], "admin@test.com");
  assert.equal(result.items.find((item) => item.ticker === "AFHF11")?.catalog.identity.cnpj, af.cnpj);
});

test("nome oficial praticamente idêntico prevalece sobre assinatura incidental de outro fundo", () => {
  const exact = registration("50686473000162", "FII", "IMMOBINVEST FUNDO DE INVESTIMENTO IMOBILIÁRIO RESPONSABILIDADE LIMITADA");
  const incidental = registration("38376805000107", "FII", "IMMOB V DESENVOLVIMENTO FUNDO DE INVESTIMENTO IMOBILIÁRIO - FII");
  const result = new FundCatalogEngine().build(dataset({
    b3: [instrument("IMMB11", "FII", "IMMOBINVEST FUNDO DE INVESTIMENTO IMOBILIÁRIO RESP")],
    registrations: [incidental, exact],
  }), [], [], "admin@test.com");
  assert.equal(result.items.find((item) => item.ticker === "IMMB11")?.catalog.identity.cnpj, exact.cnpj);
});

test("sequência distintiva resolve a classe vigente sem cair em produto antigo com termos genéricos", () => {
  const current = { ...registration("65654838000144", "FI_INFRA", "SPARTA INFRA ESTRATÉGICO FIF EM COTAS DE FUNDOS INCENTIVADOS DE INV EM INFR RENDA FIXA RESP LIMITADA"), isFundOfFunds: true };
  const legacy = registration("50038992000114", "FI_INFRA", "SPARTA DEB INC ESTRAT FUNDOS INCENTIVADOS DE INVEST FINANCEIRO EM INFRA RENDA FIXA - RESP LIMITADA");
  const result = new FundCatalogEngine().build(dataset({
    b3: [instrument("PREE11", "FI_INFRA", "SPARTA INFRA ESTRATEGICO FUND DE INVEST")],
    registrations: [legacy, current],
  }), [], [], "admin@test.com");
  assert.equal(result.items.find((item) => item.ticker === "PREE11")?.catalog.identity.cnpj, current.cnpj);
});

test("CNPJ conhecido e compatível bloqueia ISIN mensal contraditório de outro fundo", () => {
  const kisu = registration("36669660000107", "FII", "KILIMA FUNDO DE INVESTIMENTO EM COTAS DE FUNDOS IMOBILIÁRIOS SUNO 30");
  const riviera = registration("65923811000100", "FII", "FUNDO DE INVESTIMENTO IMOBILIÁRIO RIVIERA RESIDENCIAL");
  const isin = "BRKISUCTF000";
  const result = new FundCatalogEngine().build(dataset({
    b3: [instrument("KISU11", "FII", "KILIMA FIC FDO IMOB SUNO 30", isin)],
    registrations: [riviera, kisu],
    monthlyGeneral: new Map([[riviera.cnpj, { CNPJ_Fundo_Classe: riviera.cnpj, Data_Referencia: "2026-05-01", Codigo_ISIN: isin, Nome_Fundo_Classe: riviera.legalName }]]),
  }), [{ id: "KISU11", data: { code: "KISU11", cnpj: kisu.cnpj } }], [], "admin@test.com");
  const entry = result.items.find((item) => item.ticker === "KISU11")!.catalog;
  assert.equal(entry.identity.cnpj, kisu.cnpj);
  assert.equal(entry.provenance.matchMethod, "existing-cnpj");
  assert.ok(result.run.reviewSamples.some((item) => item.ticker === "KISU11" && /conflita/i.test(item.issue)));
});

test("conciliação respeita abreviação residencial e o ano do produto", () => {
  const residential = registration("62951756000173", "FII", "GALAPAGOS DESENVOLVIMENTO RESIDENCIAL FUNDO DE INVESTIMENTO IMOBILIÁRIO");
  const logistics = registration("56061587000101", "FII", "GALAPAGOS DESENVOLVIMENTO LOGÍSTICO FUNDO DE INVESTIMENTO IMOBILIÁRIO");
  const september28 = { ...registration("60365671000188", "FI_INFRA", "ITAÚ ISENTO SETEMBRO 28 FUNDO DE INVESTIMENTO EM COTAS DE FIIF EM INFRA RF"), isFundOfFunds: true };
  const september29 = { ...registration("61351720000196", "FI_INFRA", "ITAÚ ISENTO SETEMBRO 29 FIC DE FUNDOS INCENTIVADOS DE INVESTIMENTO EM INFRA RF"), isFundOfFunds: true };
  const result = new FundCatalogEngine().build(dataset({
    b3: [
      instrument("GSRF11", "FII", "GALAPAGOS DESENV RES - FII RESP LIM"),
      instrument("ISET11", "FI_INFRA", "ITAÚ ISENTO SETEMBRO 28 FIC FIIF INFRA RF"),
      instrument("ISTT11", "FI_INFRA", "ITAÚ ISENTO SETEMBRO 29 FIC FIIF INFRA RF"),
    ],
    registrations: [logistics, residential, september29, september28],
  }), [], [], "admin@test.com");
  assert.equal(result.items.find((item) => item.ticker === "GSRF11")?.catalog.identity.cnpj, residential.cnpj);
  assert.equal(result.items.find((item) => item.ticker === "ISET11")?.catalog.identity.cnpj, september28.cnpj);
  assert.equal(result.items.find((item) => item.ticker === "ISTT11")?.catalog.identity.cnpj, september29.cnpj);
});

test("conciliação distingue séries numeradas mesmo quando os nomes-base são iguais", () => {
  const first = registration("63492653000155", "FII", "PERMUTA RESIDENCIAL FUNDO DE INVESTIMENTO IMOBILIÁRIO RESPONSABILIDADE LIMITADA");
  const second = registration("65680221000101", "FII", "PERMUTA RESIDENCIAL II FUNDO DE INVESTIMENTO IMOBILIÁRIO RESPONSABILIDADE LIMITADA");
  const vinland = registration("61973575000185", "FI_INFRA", "VINLAND FIF FI INCENTIVADO EM DEBÊNTURES DE INFRA IPCA IMAB RF CRED PRIV LONGO PRAZO RESP LIMITADA");
  const vinland2 = registration("61543507000186", "FI_INFRA", "VINLAND 2 FI INCENTIVADO EM DEBÊNTURES DE INFRA ATIVO FIF RF");
  const result = new FundCatalogEngine().build(dataset({
    b3: [
      instrument("PMRL11", "FII", "PERMUTA RESIDENCIAL FII"),
      instrument("VINF11", "FI_INFRA", "VINLAND INFRAESTRUTURA FI FIF DEBENTURES INFRA"),
    ],
    registrations: [second, first, vinland2, vinland],
  }), [], [], "admin@test.com");
  assert.equal(result.items.find((item) => item.ticker === "PMRL11")?.catalog.identity.cnpj, first.cnpj);
  assert.equal(result.items.find((item) => item.ticker === "VINF11")?.catalog.identity.cnpj, vinland.cnpj);
});

test("fundo ainda presente na B3 e em liquidação na CVM entra em revisão, não é apagado", () => {
  const liquidating = { ...registration("09150967000124", "FII", "FII PATRIMONIAL IV"), status: "Em Liquidação" };
  const result = new FundCatalogEngine().build(dataset({
    b3: [instrument("OPTM11", "FII", "FII PATRIMONIAL IV")],
    registrations: [liquidating],
    publicCnpjByTicker: new Map([["OPTM11", liquidating.cnpj]]),
  }), [], [], "admin@test.com");
  const entry = result.items.find((item) => item.ticker === "OPTM11")!.catalog;
  assert.equal(entry.lifecycle.status, "under_review");
  assert.equal(entry.lifecycle.b3Listed, true);
});

test("fundo ausente da B3 e em liquidação na CVM é inativado sem apagar o histórico", () => {
  const liquidating = { ...registration("11260134000168", "FII", "CSHG PRIME OFFICES FUNDO DE INVESTIMENTO IMOBILIÁRIO"), status: "Em Liquidação" };
  const sentinels = ["MXRF11", "VGIA11", "TGAR11", "KNCA11"];
  const listed = Array.from({ length: 300 }, (_, index) => {
    const ticker = sentinels[index] || `T${String(index).padStart(3, "0")}11`;
    const cnpj = String(20_000_000_000_000 + index);
    return { ticker, cnpj, name: `FUNDO LISTADO ${index}` };
  });
  const result = new FundCatalogEngine().build(dataset({
    b3: listed.map((item) => instrument(item.ticker, "FII", item.name)),
    registrations: [liquidating, ...listed.map((item) => registration(item.cnpj, "FII", item.name))],
    monthlyComplement: new Map(listed.map((item) => [item.cnpj, {
      Data_Referencia: "2026-06-30", Patrimonio_Liquido: "1000000", Cotas_Emitidas: "100000",
      Valor_Patrimonial_Cotas: "10", Total_Numero_Cotistas: "1000", Numero_Cotistas_Pessoa_Fisica: "900",
    }])),
  }), [
    { id: "HGPO11", data: { code: "HGPO11", cnpj: liquidating.cnpj } },
  ], [], "admin@test.com");
  const entry = result.items.find((item) => item.ticker === "HGPO11")!;
  assert.equal(entry.action, "inactivate");
  assert.equal(entry.catalog.lifecycle.status, "inactive");
  assert.match(entry.catalog.lifecycle.reason, /liquidação/i);
});

test("colisão aproximada de CNPJ nunca inativa ticker que continua presente na B3", () => {
  const cnpj = "11111111000191";
  const currentIsin = "BRNEWXCTF000";
  const result = new FundCatalogEngine().build(dataset({
    b3: [
      instrument("OLDX11", "FII", "FUNDO ALFA IMOBILIARIO"),
      instrument("NEWX11", "FII", "FUNDO ALFA", currentIsin),
    ],
    registrations: [registration(cnpj, "FII", "FUNDO ALFA IMOBILIARIO")],
    monthlyGeneral: new Map([[cnpj, { CNPJ_Fundo_Classe: cnpj, Data_Referencia: "2026-06-30", Codigo_ISIN: currentIsin, Nome_Fundo_Classe: "FUNDO ALFA IMOBILIARIO" }]]),
  }), [], [], "admin@test.com");
  const oldTicker = result.items.find((item) => item.ticker === "OLDX11")!.catalog;
  assert.equal(oldTicker.lifecycle.status, "under_review");
  assert.equal(oldTicker.lifecycle.replacedByTicker, null);
  assert.equal(result.items.find((item) => item.ticker === "OLDX11")!.action, "add");
  assert.ok(result.run.reviewSamples.some((item) => item.ticker === "OLDX11"));
});

test("troca de ticker só inativa o anterior ausente da B3 quando o ISIN oficial identifica um sucessor", () => {
  const cnpj = "11111111000191";
  const currentIsin = "BRTESTCTF000";
  const sentinels = [
    ["MXRF11", "22222222000172"],
    ["VGIA11", "33333333000153"],
    ["TGAR11", "44444444000134"],
    ["KNCA11", "55555555000115"],
  ] as const;
  const engine = new FundCatalogEngine();
  const result = engine.build(dataset({
    b3: [
      instrument("NEWX11", "FII", "FUNDO ALFA", currentIsin),
      ...sentinels.map(([ticker]) => instrument(ticker, ticker === "VGIA11" ? "FIAGRO" : "FII", ticker)),
    ],
    registrations: [
      registration(cnpj, "FII", "FUNDO ALFA IMOBILIARIO"),
      ...sentinels.map(([ticker, sentinelCnpj]) => registration(sentinelCnpj, ticker === "VGIA11" ? "FIAGRO" : "FII", ticker)),
    ],
    monthlyGeneral: new Map([[cnpj, { CNPJ_Fundo_Classe: cnpj, Data_Referencia: "2026-06-30", Codigo_ISIN: currentIsin, Nome_Fundo_Classe: "FUNDO ALFA IMOBILIARIO" }]]),
    monthlyComplement: new Map([
      [cnpj, { Data_Referencia: "2026-06-30", Patrimonio_Liquido: "1000000", Cotas_Emitidas: "100000", Valor_Patrimonial_Cotas: "10", Total_Numero_Cotistas: "1000", Numero_Cotistas_Pessoa_Fisica: "900" }],
      ...sentinels.map(([, sentinelCnpj]) => [sentinelCnpj, { Data_Referencia: "2026-06-30", Patrimonio_Liquido: "1000000", Cotas_Emitidas: "100000", Valor_Patrimonial_Cotas: "10", Total_Numero_Cotistas: "1000", Numero_Cotistas_Pessoa_Fisica: "900" }] as const),
    ]),
  }), [
    { id: "OLDX11", data: { code: "OLDX11", cnpj } },
    { id: "NEWX11", data: { code: "NEWX11", cnpj } },
    ...sentinels.map(([ticker, sentinelCnpj]) => ({ id: ticker, data: { code: ticker, cnpj: sentinelCnpj } })),
  ], [], "admin@test.com");
  const oldTicker = result.items.find((item) => item.ticker === "OLDX11")!.catalog;
  const newTicker = result.items.find((item) => item.ticker === "NEWX11")!.catalog;
  assert.equal(newTicker.lifecycle.status, "active");
  assert.equal(oldTicker.lifecycle.status, "inactive");
  assert.equal(oldTicker.lifecycle.replacedByTicker, "NEWX11");
  assert.match(oldTicker.lifecycle.reason, /ISIN oficial/i);
});
