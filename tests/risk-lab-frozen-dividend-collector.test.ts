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
