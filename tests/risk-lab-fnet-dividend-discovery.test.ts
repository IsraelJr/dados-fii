import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  FnetDividendDocumentDiscovery,
  mapFnetDividendRows,
  resolveFnetInternalFundId,
} from "../src/lib/risk-lab/FnetDividendDocumentDiscovery";
import { ConcurrentAutomaticDividendSeriesService } from "../src/lib/risk-lab/ConcurrentAutomaticDividendSeriesService";
import type { AutomaticDocumentEvidence, AutomaticMonthlySeries } from "../src/types/riskLabAutomatic";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 261398,
    categoriaDocumento: "Aviso aos Cotistas - Estruturado",
    tipoDocumento: "Rendimentos e Amortizações",
    dataReferencia: "31/01/2022",
    dataEntrega: "31/01/2022 18:02",
    descricaoFundo: "FUNDO GENÉRICO",
    nomePregao: "FII GENERICO",
    descricaoStatus: "Ativo com visualização",
    descricaoModalidade: "Apresentação",
    situacaoDocumento: "A",
    versao: 1,
    ...overrides,
  };
}

function eventDocument(year: number): AutomaticDocumentEvidence {
  return {
    documentId: `event-${year}`,
    documentType: "Fato Relevante",
    fileName: `fato-${year}.pdf`,
    competenceDate: `${year}-01-01`,
    receivedAt: `${year}-01-10T12:00:00-03:00`,
    link: "https://dados.cvm.gov.br/documento.pdf",
    sourceYear: year,
    auditResult: "OK",
    confidence: 99,
  };
}

function monthlySeries(year: number): AutomaticMonthlySeries {
  return {
    status: "incomplete",
    observations: [],
    sources: [{
      year,
      sourceUrl: "https://fnet.bmfbovespa.com.br",
      sourceHash: null,
      fetched: true,
      documentsInspected: 1,
      matchingRows: 1,
      acceptedMonths: 0,
      error: null,
    }],
    missingMonths: [],
    conflicts: [],
    longestContiguousSequence: 0,
    method: "unavailable",
    detectorResult: null,
    detectorExecuted: false,
    classificationFinal: false,
    limitation: "insufficient_structured_series",
  };
}

test("helper legado de idFundo permanece isolado e fail-closed", () => {
  const html = `<input name="paginaCertificados" value="false" type="hidden"><input id="20031" type="hidden"><input id="cnpj" name="cnpj" type="text">`;
  assert.equal(resolveFnetInternalFundId(html), "20031");
  assert.throws(() => resolveFnetInternalFundId("<input id='1' type='hidden'><input id='2' type='hidden'>"), /idFundo único/);
});

test("mapeia somente avisos estruturados válidos dentro da janela conhecida", () => {
  const documents = mapFnetDividendRows([
    row(),
    row({ id: 2, tipoDocumento: "Relatório Gerencial" }),
    row({ id: 3, dataEntrega: "01/01/2026 10:00" }),
    row({ id: 4, situacaoDocumento: "C" }),
    row({ id: 5, dataReferencia: "02/2022", dataEntrega: "28/02/2022 18:00", versao: 2 }),
  ], "2022-01-01", "2025-12-31");

  assert.deepEqual(documents.map((item) => item.documentId), ["261398", "5"]);
  assert.equal(documents[0].receivedAt, "2022-01-31T18:02:00-03:00");
  assert.equal(documents[1].competenceDate, "2022-02-01");
  assert.match(documents[1].auditResult || "", /versão 2/);
});

test("descoberta usa cnpjFundo, pagina em blocos de cem e não consulta o gerenciador", async () => {
  const calls: URL[] = [];
  const allRows = Array.from({ length: 101 }, (_, index) => row({
    id: 300000 + index,
    dataReferencia: `${String(index % 12 + 1).padStart(2, "0")}/2022`,
    dataEntrega: `${String(index % 27 + 1).padStart(2, "0")}/${String(index % 12 + 1).padStart(2, "0")}/2022 18:00`,
  }));
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push(url);
    assert.ok(url.pathname.endsWith("pesquisarGerenciadorDocumentosDados"));
    assert.equal(url.searchParams.get("idFundo"), "");
    assert.equal(url.searchParams.get("cnpjFundo"), "16706958000132");
    assert.equal(url.searchParams.get("cnpj"), "16.706.958/0001-32");
    assert.equal(url.searchParams.get("l"), "100");
    assert.equal(url.searchParams.get("dataInicial"), "01/01/2022");
    assert.equal(url.searchParams.get("dataFinal"), "31/12/2025");
    const start = Number(url.searchParams.get("s"));
    const data = allRows.slice(start, start + 100);
    return Response.json({ data, draw: Number(url.searchParams.get("d")), recordsFiltered: 101, recordsTotal: 101 });
  }) as typeof fetch;

  const result = await new FnetDividendDocumentDiscovery({ fetchImpl }).discover(
    "16706958000132",
    "2022-01-01",
    "2025-12-31",
  );

  assert.equal(result.internalFundId, null);
  assert.equal(result.filterMode, "cnpjFundo");
  assert.equal(result.recordsInspected, 101);
  assert.equal(result.documents.length, 101);
  assert.equal(calls.length, 2);
});

test("descoberta bloqueia endpoint que ignorou o CNPJ e devolveu o universo global", async () => {
  const fetchImpl = (async () => Response.json({
    data: [row()],
    draw: 1,
    recordsFiltered: 164880,
    recordsTotal: 164880,
  })) as typeof fetch;

  await assert.rejects(
    () => new FnetDividendDocumentDiscovery({ fetchImpl }).discover("16706958000132", "2022-01-01", "2025-12-31"),
    /não ficou restrita ao fundo/,
  );
});

test("descoberta bloqueia página repetida antes de entrar em loop", async () => {
  const repeated = Array.from({ length: 100 }, (_, index) => row({ id: 400000 + index }));
  const fetchImpl = (async () => Response.json({
    data: repeated,
    draw: 1,
    recordsFiltered: 150,
    recordsTotal: 150,
  })) as typeof fetch;

  await assert.rejects(
    () => new FnetDividendDocumentDiscovery({ fetchImpl }).discover("16706958000132", "2022-01-01", "2025-12-31"),
    /repetiu uma página/,
  );
});

test("descoberta bloqueia alteração do total entre páginas", async () => {
  let call = 0;
  const first = Array.from({ length: 100 }, (_, index) => row({ id: 500000 + index }));
  const fetchImpl = (async () => {
    call += 1;
    return Response.json({
      data: call === 1 ? first : [row({ id: 600000 })],
      draw: call,
      recordsFiltered: call === 1 ? 101 : 102,
      recordsTotal: call === 1 ? 101 : 102,
    });
  }) as typeof fetch;

  await assert.rejects(
    () => new FnetDividendDocumentDiscovery({ fetchImpl }).discover("16706958000132", "2022-01-01", "2025-12-31"),
    /mudou durante a paginação/,
  );
});

test("série concorrente descobre documentos quando o catálogo eventual não contém rendimentos", async () => {
  let resolvedTicker = "";
  let discoveryInput: unknown[] = [];
  let baseDocuments: AutomaticDocumentEvidence[] = [];
  const service = new ConcurrentAutomaticDividendSeriesService({
    resolveCnpj: async (ticker) => { resolvedTicker = ticker; return "16706958000132"; },
    discovery: {
      async discover(...input) {
        discoveryInput = input;
        return {
          internalFundId: null,
          filterMode: "cnpjFundo" as const,
          recordsInspected: 1,
          sourceUrl: "https://fnet.bmfbovespa.com.br",
          documents: [mapFnetDividendRows([row()], "2022-01-01", "2023-12-31")[0]],
        };
      },
    },
    base: {
      async build(_ticker, documents) {
        baseDocuments = documents;
        return monthlySeries(documents[0].sourceYear);
      },
    },
    now: () => new Date("2026-07-21T00:00:00-03:00"),
  });

  await service.build("KNCR11", [eventDocument(2022), eventDocument(2023)]);
  assert.equal(resolvedTicker, "KNCR11");
  assert.deepEqual(discoveryInput, ["16706958000132", "2022-01-01", "2023-12-31"]);
  assert.equal(baseDocuments[0].documentId, "261398");
});

test("implementação é generalizada e a execução ativa não depende de idFundo", () => {
  const discovery = readFileSync("src/lib/risk-lab/FnetDividendDocumentDiscovery.ts", "utf8");
  const concurrent = readFileSync("src/lib/risk-lab/ConcurrentAutomaticDividendSeriesService.ts", "utf8");
  for (const ticker of ["DEVA11", "VSLH11", "KNCR11", "KNSC11", "MCCI11", "RBRY11"]) {
    assert.doesNotMatch(discovery, new RegExp(ticker));
    assert.doesNotMatch(concurrent, new RegExp(ticker));
  }
  const activeMethod = discovery.slice(discovery.indexOf("async discover("));
  assert.match(activeMethod, /cnpjFundo/);
  assert.doesNotMatch(activeMethod, /resolveFundId|pesquisarGerenciadorDocumentosCVM/);
  assert.doesNotMatch(`${discovery}\n${concurrent}`, /manual_document_review|approve\(|confirm\(/);
});
