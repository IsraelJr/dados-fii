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

function realFundResolverHtml(id = "20031") {
  return `
    <html>
      <body>
        <input type="hidden" id="idFundo" name="idFundo" multiple="multiple" value="">
        <input
          type="hidden"
          disabled="disabled"
          class="fundoItemInicial"
          data-id="${id}"
          data-text="FII KINEA RI - KINEA RENDIMENTOS IMOBILIÁRIOS FII"
        >
      </body>
    </html>
  `;
}

test("resolve idFundo pelo data-id real do item inicial do Fundos.NET", () => {
  assert.equal(resolveFnetInternalFundId(realFundResolverHtml()), "20031");
});

test("mantém compatibilidade com valor direto e contrato legado", () => {
  assert.equal(
    resolveFnetInternalFundId('<input type="hidden" id="idFundo" name="idFundo" value="20031">'),
    "20031",
  );
  assert.equal(resolveFnetInternalFundId('<input id="20031" type="hidden">'), "20031");
});

test("falha fechada quando o resolvedor retorna zero ou múltiplos fundos", () => {
  assert.throws(() => resolveFnetInternalFundId('<input id="idFundo" type="hidden" value="">'), /0 candidato/);
  assert.throws(
    () => resolveFnetInternalFundId(`${realFundResolverHtml("20031")}${realFundResolverHtml("20032")}`),
    /2 candidato/,
  );
});

test("mapeia avisos e preserva metadados oficiais equivalentes ao protocolo", () => {
  const documents = mapFnetDividendRows([
    row(),
    row({ id: 2, tipoDocumento: "Relatório Gerencial" }),
    row({ id: 3, dataEntrega: "01/01/2026 10:00" }),
    row({ id: 4, situacaoDocumento: "C" }),
    row({ id: 5, dataReferencia: "02/2022", dataEntrega: "28/02/2022 18:00", versao: 2 }),
  ], "2022-01-01", "2025-12-31");

  assert.deepEqual(documents.map((item) => item.documentId), ["261398", "5"]);
  assert.equal(documents[0].receivedAt, "2022-01-31T18:02:00-03:00");
  assert.deepEqual(documents[0].protocolMetadata, {
    referenceDate: "2022-01-31",
    deliveredAt: "2022-01-31T18:02:00-03:00",
    version: 1,
    status: "Ativo com visualização",
    modality: "Apresentação",
    situation: "A",
    sourceUrl: "https://fnet.bmfbovespa.com.br/fnet/publico/pesquisarGerenciadorDocumentosDados",
  });
  assert.equal(documents[1].competenceDate, "2022-02-01");
  assert.equal(documents[1].protocolMetadata.version, 2);
  assert.match(documents[1].auditResult || "", /versão 2/);
});

test("falha fechada quando um aviso aceito não possui protocolo oficial íntegro", () => {
  assert.throws(
    () => mapFnetDividendRows([row({ dataEntrega: "", versao: 0 })], "2022-01-01", "2025-12-31"),
    /Metadados oficiais de protocolo inválidos/,
  );
});

test("descoberta pagina pelo contrato real e preserva documentos oficiais", async () => {
  const calls: URL[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push(url);
    if (url.pathname.endsWith("pesquisarGerenciadorDocumentosCVM")) {
      assert.equal(url.searchParams.get("cnpjFundo"), "16706958000132");
      return new Response(realFundResolverHtml(), {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }

    assert.equal(url.searchParams.get("idFundo"), "20031");
    assert.equal(url.searchParams.get("cnpj"), "16.706.958/0001-32");
    assert.equal(url.searchParams.get("cnpjFundo"), "16.706.958/0001-32");
    assert.equal(url.searchParams.get("isSession"), "false");
    assert.equal(url.searchParams.get("dataInicial"), "01/01/2022");
    assert.equal(url.searchParams.get("dataFinal"), "31/12/2025");
    assert.equal(url.searchParams.get("l"), "100");

    const start = Number(url.searchParams.get("s"));
    const data = start === 0
      ? [row()]
      : [row({ id: 261399, dataReferencia: "28/02/2022", dataEntrega: "28/02/2022 18:00" })];
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
  assert.equal(result.documents.every((item) => item.protocolMetadata.version === 1), true);
  assert.equal(calls.filter((url) => url.pathname.endsWith("pesquisarGerenciadorDocumentosDados")).length, 2);
});

test("descoberta bloqueia endpoint que ignorou o filtro", async () => {
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("pesquisarGerenciadorDocumentosCVM")) {
      return new Response(realFundResolverHtml(), { status: 200 });
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
