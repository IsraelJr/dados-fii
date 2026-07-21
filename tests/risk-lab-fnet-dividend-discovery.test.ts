import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  FnetDividendDocumentDiscovery,
  mapFnetDividendRows,
  resolveFnetInternalFundId,
} from "../src/lib/risk-lab/FnetDividendDocumentDiscovery";

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

test("descoberta diagnóstica pagina e preserva documentos oficiais", async () => {
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

test("descoberta diagnóstica bloqueia endpoint que ignorou o filtro", async () => {
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

test("coletor FNET permanece isolado do caminho crítico e sem exceções por ticker", () => {
  const discovery = readFileSync("src/lib/risk-lab/FnetDividendDocumentDiscovery.ts", "utf8");
  const critical = readFileSync("src/lib/risk-lab/ConcurrentAutomaticDividendSeriesService.ts", "utf8");
  for (const ticker of ["DEVA11", "VSLH11", "KNCR11", "KNSC11", "MCCI11", "RBRY11"]) {
    assert.doesNotMatch(discovery, new RegExp(ticker));
    assert.doesNotMatch(critical, new RegExp(ticker));
  }
  assert.doesNotMatch(critical, /FnetDividendDocumentDiscovery|fnet\.bmfbovespa|exibirDocumento/);
  assert.doesNotMatch(`${discovery}\n${critical}`, /manual_document_review|approve\(|confirm\(/);
});
