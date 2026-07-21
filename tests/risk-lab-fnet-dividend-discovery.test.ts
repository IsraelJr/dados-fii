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

test("resolve idFundo interno sem depender de ticker", () => {
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

test("descoberta usa idFundo mais CNPJ, pagina e preserva documentos oficiais", async () => {
  const calls: URL[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push(url);
    if (url.pathname.endsWith("pesquisarGerenciadorDocumentosCVM")) {
      return new Response(`<html><input id="20031" type="hidden"></html>`, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }
    assert.equal(url.searchParams.get("idFundo"), "20031");
    assert.equal(url.searchParams.get("cnpj"), "16.706.958/0001-32");
    assert.equal(url.searchParams.get("dataInicial"), "01/01/2022");
    assert.equal(url.searchParams.get("dataFinal"), "31/12/2025");
    const start = Number(url.searchParams.get("s"));
    const data = start === 0 ? [row()] : [row({ id: 261399, dataReferencia: "28/02/2022", dataEntrega: "28/02/2022 18:00" })];
    return Response.json({ data, draw: start === 0 ? 1 : 2, recordsFiltered: 2, recordsTotal: 2 });
  }) as typeof fetch;

  const result = await new FnetDividendDocumentDiscovery({ fetchImpl }).discover(
    "16706958000132",
    "2022-01-01",
    "2025-12-31",
  );

  assert.equal(result.internalFundId, "20031");
  assert.equal(result.recordsInspected, 2);
  assert.deepEqual(result.documents.map((item) => item.documentId), ["261398", "261399"]);
  assert.equal(calls.filter((url) => url.pathname.endsWith("pesquisarGerenciadorDocumentosDados")).length, 2);
});

test("descoberta bloqueia endpoint que ignorou o filtro do fundo", async () => {
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("pesquisarGerenciadorDocumentosCVM")) {
      return new Response(`<input id="20031" type="hidden">`, { status: 200 });
    }
    return Response.json({ data: [row()], draw: 1, recordsFiltered: 164880, recordsTotal: 164880 });
  }) as typeof fetch;

  await assert.rejects(
    () => new FnetDividendDocumentDiscovery({ fetchImpl }).discover("16706958000132", "2022-01-01", "2025-12-31"),
    /não ficou restrita ao fundo/,
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
          internalFundId: "20031",
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

test("implementação é generalizada e não contém exceções da coorte", () => {
  const discovery = readFileSync("src/lib/risk-lab/FnetDividendDocumentDiscovery.ts", "utf8");
  const concurrent = readFileSync("src/lib/risk-lab/ConcurrentAutomaticDividendSeriesService.ts", "utf8");
  for (const ticker of ["DEVA11", "VSLH11", "KNCR11", "KNSC11", "MCCI11", "RBRY11"]) {
    assert.doesNotMatch(discovery, new RegExp(ticker));
    assert.doesNotMatch(concurrent, new RegExp(ticker));
  }
  assert.doesNotMatch(`${discovery}\n${concurrent}`, /manual_document_review|approve\(|confirm\(/);
});
