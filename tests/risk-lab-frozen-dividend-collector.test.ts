import assert from "node:assert/strict";
import test from "node:test";
import { FrozenDividendNoticeCollector } from "../src/lib/risk-lab/FrozenDividendNoticeCollector";
import type { FrozenDividendCohortIdentity } from "../src/lib/risk-lab/FrozenDividendNoticeCollector";
import type { FnetDividendDocumentEvidence } from "../src/lib/risk-lab/FnetDividendDocumentDiscovery";
import type { FrozenDividendCollectionCheckpoint } from "../src/types/riskLabFrozenDividendDataset";

const TICKERS = ["AAAA11", "BBBB11", "CCCC11", "DDDD11", "EEEE11", "FFFF11"];

function identities(): FrozenDividendCohortIdentity[] {
  return TICKERS.map((ticker, index) => ({
    ticker,
    cnpj: String(index + 1).padStart(14, "0"),
    role: index < 2 ? "severe_deterioration" : index < 4 ? "healthy_control" : "reversible_stress",
    fromDate: "2022-01-01",
    untilDate: "2022-12-31",
  }));
}

function table(rows: Array<[string, string]>) {
  return `<html><body><table>${rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join("")}</table></body></html>`;
}

function notice(ticker: string, amount = "1,00") {
  return table([
    ["Nome do Fundo:", `FUNDO ${ticker}`],
    ["Data da Informação:", "31/01/2022"],
    ["Código de negociação:", ticker],
    ["Data-base (último dia de negociação “com” direito ao provento)", "31/01/2022"],
    ["Valor do provento (R$/unidade)", amount],
    ["Data do pagamento", "14/02/2022"],
    ["Período de referência", "01-2022"],
    ["Rendimento isento de IR*", "Sim"],
  ]);
}

function document(id: string): FnetDividendDocumentEvidence {
  return {
    documentId: id,
    documentType: "Aviso aos Cotistas - Estruturado - Rendimentos e Amortizações",
    fileName: `fnet-rendimentos-${id}.html`,
    competenceDate: "2022-01-31",
    receivedAt: "2022-01-31T18:02:00-03:00",
    link: `https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?id=${id}&cvm=true`,
    sourceYear: 2022,
    auditResult: "Ativo com visualização; Apresentação; versão 1",
    confidence: 99,
    protocolMetadata: {
      referenceDate: "2022-01-31",
      deliveredAt: "2022-01-31T18:02:00-03:00",
      version: 1,
      status: "Ativo com visualização",
      modality: "Apresentação",
      situation: "A",
      sourceUrl: "https://fnet.bmfbovespa.com.br/fnet/publico/pesquisarGerenciadorDocumentosDados",
    },
  };
}

function fixture(failingDocumentId: string | null = null) {
  const tickerByDocument = new Map<string, string>();
  const documentByCnpj = new Map<string, FnetDividendDocumentEvidence>();
  identities().forEach((identity, index) => {
    const id = String(1001 + index);
    tickerByDocument.set(id, identity.ticker);
    documentByCnpj.set(identity.cnpj, document(id));
  });
  let active = 0;
  let maximumActive = 0;
  const calls = new Map<string, number>();
  const paths: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const id = url.searchParams.get("id") || "";
    paths.push(url.pathname);
    calls.set(id, (calls.get(id) || 0) + 1);
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active -= 1;
    if (id === failingDocumentId) throw new TypeError("fetch failed");
    const ticker = tickerByDocument.get(id);
    assert.ok(ticker);
    return new Response(notice(ticker), {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  }) as typeof fetch;
  const discovery = {
    async discover(cnpj: string) {
      const item = documentByCnpj.get(cnpj);
      assert.ok(item);
      return {
        internalFundId: cnpj,
        documents: [item],
        recordsInspected: 1,
        sourceUrl: "https://fnet.bmfbovespa.com.br/fnet/publico/pesquisarGerenciadorDocumentosDados",
      };
    },
  };
  return { fetchImpl, discovery, calls, paths, maximumActive: () => maximumActive };
}

const RELEASE = "a".repeat(40);

async function collect(
  failingDocumentId: string | null,
  checkpoint: FrozenDividendCollectionCheckpoint | null = null,
) {
  const source = fixture(failingDocumentId);
  let persisted = checkpoint;
  const collector = new FrozenDividendNoticeCollector({
    discovery: source.discovery,
    fetchImpl: source.fetchImpl,
    attempts: 1,
    now: () => new Date("2026-07-21T20:00:00-03:00"),
  });
  const result = await collector.collect(
    identities(),
    RELEASE,
    checkpoint,
    async (value) => { persisted = structuredClone(value); },
  );
  assert.ok(persisted);
  return { ...result, source, persisted };
}

test("coleta os seis fundos e todos os documentos de forma estritamente sequencial", async () => {
  const result = await collect(null);
  assert.equal(result.dataset.status, "complete");
  assert.equal(result.dataset.cases.length, 6);
  assert.equal(result.dataset.cases.every((item) => item.observations.length === 1), true);
  assert.equal(result.source.maximumActive(), 1);
  assert.equal(result.source.paths.every((path) => path.endsWith("/exibirDocumento")), true);
  assert.match(result.dataset.datasetHash || "", /^[a-f0-9]{64}$/);
  for (const item of result.dataset.cases) {
    assert.match(item.caseHash, /^[a-f0-9]{64}$/);
    assert.match(item.observations[0].sourceHash, /^[a-f0-9]{64}$/);
    assert.match(item.observations[0].protocolHash, /^[a-f0-9]{64}$/);
    assert.equal(item.observations[0].protocolEvidenceType, "official_manager_metadata");
    assert.match(item.observations[0].sourceVersion, /manager-metadata/);
  }
});

test("checkpoint retoma somente documento pendente sem duplicar observações anteriores", async () => {
  const first = await collect("1002");
  assert.equal(first.dataset.status, "pending");
  assert.deepEqual(first.dataset.cases[1].pendingDocumentIds, ["1002"]);
  assert.equal(first.dataset.cases[0].observations.length, 1);
  const firstSuccessfulCalls = first.source.calls.get("1001");

  const second = await collect(null, first.checkpoint);
  assert.equal(second.dataset.status, "complete");
  assert.equal(second.dataset.cases.every((item) => item.observations.length === 1), true);
  assert.equal(second.source.calls.get("1001") || 0, 0);
  assert.equal(firstSuccessfulCalls, 1);
  assert.equal(new Set(second.dataset.cases.flatMap((item) => item.observations.map((entry) => entry.documentId))).size, 6);
});


test("ignora classes secundárias da mesma família e escolhe a maior versão do evento antes da competência", async () => {
  const targetIdentities = identities();
  const documentsByCnpj = new Map<string, FnetDividendDocumentEvidence[]>();
  const htmlById = new Map<string, string>();

  targetIdentities.forEach((identity, index) => {
    const base = document(String(2000 + index * 10));
    documentsByCnpj.set(identity.cnpj, [base]);
    htmlById.set(base.documentId, notice(identity.ticker));
  });

  const first = targetIdentities[0];
  const v1 = document("2101");
  const v2 = document("2102");
  const secondary = document("2103");
  v1.protocolMetadata.version = 1;
  v2.protocolMetadata.version = 2;
  secondary.protocolMetadata.version = 1;
  documentsByCnpj.set(first.cnpj, [v1, v2, secondary]);
  htmlById.set("2101", notice(first.ticker).replace("01-2022", "12-2022"));
  htmlById.set("2102", notice(first.ticker).replace("1,00", "1,20"));
  htmlById.set("2103", notice(`${first.ticker.slice(0, 4)}13`, "9,99"));

  const collector = new FrozenDividendNoticeCollector({
    attempts: 1,
    now: () => new Date("2026-07-22T02:00:00-03:00"),
    discovery: {
      async discover(cnpj: string) {
        const documents = documentsByCnpj.get(cnpj);
        assert.ok(documents);
        return {
          internalFundId: cnpj,
          documents,
          recordsInspected: documents.length,
          sourceUrl: "https://fnet.bmfbovespa.com.br/fnet/publico/pesquisarGerenciadorDocumentosDados",
        };
      },
    },
    fetchImpl: (async (input: string | URL | Request) => {
      const id = new URL(String(input)).searchParams.get("id") || "";
      const html = htmlById.get(id);
      assert.ok(html);
      return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
    }) as typeof fetch,
  });

  const result = await collector.collect(
    targetIdentities,
    RELEASE,
    null,
    async () => undefined,
  );
  assert.equal(result.dataset.status, "complete");
  assert.equal(result.dataset.collectorVersion, "1.2.0");
  assert.equal(result.dataset.cases[0].pendingDocumentIds.length, 0);
  assert.equal(result.dataset.cases[0].documentsProcessed, 3);
  assert.equal(result.dataset.cases[0].observations.length, 1);
  assert.equal(result.dataset.cases[0].observations[0].documentId, "2102");
  assert.equal(result.dataset.cases[0].observations[0].amountPerShare, 1.2);
  assert.equal(result.dataset.cases[0].conflicts.length, 0);
});

test("ignora anomalia histórica de protocolo quando a competência está fora da coorte", async () => {
  const targetIdentities = identities();
  const documentsByCnpj = new Map<string, FnetDividendDocumentEvidence[]>();
  const htmlById = new Map<string, string>();

  targetIdentities.forEach((identity, index) => {
    const current = document(String(3000 + index * 10));
    documentsByCnpj.set(identity.cnpj, [current]);
    htmlById.set(current.documentId, notice(identity.ticker));
  });

  const first = targetIdentities[0];
  const historical = document("3999");
  historical.protocolMetadata.referenceDate = "2021-01-31";
  documentsByCnpj.set(first.cnpj, [historical, ...documentsByCnpj.get(first.cnpj)!]);
  htmlById.set("3999", notice(first.ticker).replace("01-2022", "12-2021"));

  const collector = new FrozenDividendNoticeCollector({
    attempts: 1,
    now: () => new Date("2026-07-22T03:00:00-03:00"),
    discovery: {
      async discover(cnpj: string) {
        const documents = documentsByCnpj.get(cnpj);
        assert.ok(documents);
        return {
          internalFundId: cnpj,
          documents,
          recordsInspected: documents.length,
          sourceUrl: "https://fnet.bmfbovespa.com.br/fnet/publico/pesquisarGerenciadorDocumentosDados",
        };
      },
    },
    fetchImpl: (async (input: string | URL | Request) => {
      const id = new URL(String(input)).searchParams.get("id") || "";
      const html = htmlById.get(id);
      assert.ok(html);
      return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
    }) as typeof fetch,
  });

  const result = await collector.collect(targetIdentities, RELEASE, null, async () => undefined);
  assert.equal(result.dataset.status, "complete");
  assert.equal(result.dataset.cases[0].documentsProcessed, 2);
  assert.equal(result.dataset.cases[0].pendingDocumentIds.length, 0);
  assert.equal(result.dataset.cases[0].observations.length, 1);
});
