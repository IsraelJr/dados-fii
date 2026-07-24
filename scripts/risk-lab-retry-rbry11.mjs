import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { FrozenDividendNoticeCollector } from "../src/lib/risk-lab/FrozenDividendNoticeCollector.ts";
import { FnetDividendDocumentDiscovery } from "../src/lib/risk-lab/FnetDividendDocumentDiscovery.ts";

const checkpointPath = process.argv[2];
const identitiesPath = process.argv[3];
const outputDir = process.argv[4] || ".tmp/rbry11-retry";
assert.ok(checkpointPath && identitiesPath, "checkpoint e identidades são obrigatórios");

const frozenCheckpoint = JSON.parse(await readFile(checkpointPath, "utf8"));
const identityPayload = JSON.parse(await readFile(identitiesPath, "utf8"));
const identities = identityPayload.identities;
const target = identities.find((item) => item.ticker === "RBRY11");
assert.ok(target, "identidade RBRY11 ausente");
assert.equal(frozenCheckpoint.releaseCommit, identityPayload.releaseCommit);
assert.ok(frozenCheckpoint.cases.RBRY11, "checkpoint RBRY11 ausente");

const realDiscovery = new FnetDividendDocumentDiscovery();
const discovery = {
  async discover(cnpj, fromDate, untilDate) {
    if (cnpj === target.cnpj) return realDiscovery.discover(cnpj, fromDate, untilDate);
    return {
      internalFundId: cnpj,
      documents: [],
      recordsInspected: 0,
      sourceUrl: "https://fnet.bmfbovespa.com.br/fnet/publico/pesquisarGerenciadorDocumentosDados",
    };
  },
};

const isolatedCheckpoint = {
  schemaVersion: 1,
  datasetId: "risk-lab-fnet-dividend-notices-v0.1",
  releaseCommit: frozenCheckpoint.releaseCommit,
  cases: { RBRY11: structuredClone(frozenCheckpoint.cases.RBRY11) },
  updatedAt: frozenCheckpoint.updatedAt,
};

const collector = new FrozenDividendNoticeCollector({
  discovery,
  attempts: 6,
  timeoutMs: 90_000,
});

await mkdir(outputDir, { recursive: true });
let persisted = isolatedCheckpoint;
const result = await collector.collect(
  identities,
  frozenCheckpoint.releaseCommit,
  isolatedCheckpoint,
  async (value) => {
    persisted = structuredClone(value);
    await writeFile(`${outputDir}/checkpoint-progress.json`, JSON.stringify(value));
  },
);

const rbryCase = result.dataset.cases.find((item) => item.ticker === "RBRY11");
assert.ok(rbryCase, "caso RBRY11 ausente");
const rbryCheckpoint = result.checkpoint.cases.RBRY11;
assert.ok(rbryCheckpoint, "checkpoint final RBRY11 ausente");
const recovered = rbryCheckpoint.observationsByDocumentId["987180"];
assert.ok(recovered, "documento 987180 não foi recuperado pela fonte oficial");
assert.equal(recovered.ticker, "RBRY11");
assert.equal(recovered.competenceMonth, "2025-08");
assert.equal(recovered.protocolEvidenceType, "official_manager_metadata");
assert.match(recovered.sourceHash, /^[a-f0-9]{64}$/);
assert.match(recovered.protocolHash, /^[a-f0-9]{64}$/);
assert.equal(rbryCase.pendingDocumentIds.length, 0);

await writeFile(`${outputDir}/checkpoint.json`, JSON.stringify(persisted));
await writeFile(`${outputDir}/case.json`, JSON.stringify(rbryCase));
await writeFile(`${outputDir}/observation-987180.json`, JSON.stringify(recovered));
console.log(JSON.stringify({
  ticker: rbryCase.ticker,
  documentsDiscovered: rbryCase.documentsDiscovered,
  documentsProcessed: rbryCase.documentsProcessed,
  pendingDocumentIds: rbryCase.pendingDocumentIds,
  conflicts: rbryCase.conflicts,
  recovered,
}, null, 2));
