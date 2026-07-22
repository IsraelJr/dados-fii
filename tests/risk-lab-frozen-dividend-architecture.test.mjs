import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const collector = readFileSync("src/lib/risk-lab/FrozenDividendNoticeCollector.ts", "utf8");
const discovery = readFileSync("src/lib/risk-lab/FnetDividendDocumentDiscovery.ts", "utf8");
const series = readFileSync("src/lib/risk-lab/FrozenDividendNoticeSeriesService.ts", "utf8");
const concurrent = readFileSync("src/lib/risk-lab/ConcurrentAutomaticDividendSeriesService.ts", "utf8");
const backtestService = readFileSync("src/lib/risk-lab/RiskLabCohortBacktestV2Service.ts", "utf8");
const script = readFileSync("scripts/collect-risk-lab-dividend-notices.ts", "utf8");
const workflow = readFileSync(".github/workflows/risk-lab-frozen-dividend-notices.yml", "utf8");
const route = readFileSync("src/app/api/system/risk-lab-cohort-backtest/route.ts", "utf8");
const dataset = JSON.parse(readFileSync("src/lib/risk-lab/frozen-dividend-notices-v0.1.json", "utf8"));

const COHORT = ["DEVA11", "VSLH11", "KNCR11", "KNSC11", "MCCI11", "RBRY11"];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("coletor é geral, sequencial e não contém exceções por ticker", () => {
  for (const ticker of COHORT) {
    assert.doesNotMatch(collector, new RegExp(ticker));
    assert.doesNotMatch(series, new RegExp(ticker));
    assert.doesNotMatch(concurrent, new RegExp(ticker));
    assert.doesNotMatch(script, new RegExp(ticker));
  }
  assert.doesNotMatch(collector, /Promise\.all/);
  assert.match(collector, /for \(const identity of identities\)/);
  assert.match(collector, /for \(const document of documents\)/);
  assert.doesNotMatch(`${collector}\n${series}\n${script}`, /manual_document_review|requiresHuman|approve\(|confirm\(/i);
});

test("protocolo histórico usa metadados oficiais do gerenciador sem endpoint bloqueante", () => {
  assert.match(discovery, /protocolMetadata/);
  assert.match(collector, /official_manager_metadata/);
  assert.match(collector, /protocolMetadataPayload/);
  assert.doesNotMatch(collector, /parseFnetProtocolHtml/);
  assert.doesNotMatch(collector, /fetchHtml\(protocolUrl\)/);
  assert.match(collector, /sha256Text\(protocolMetadataPayload\(document\)\)/);
});

test("workflow coleta fora da Vercel com checkpoint, retomada e evidência imutável", () => {
  assert.match(workflow, /actions\/download-artifact@v4/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /risk-lab-dividend-notices-checkpoint\.json/);
  assert.match(workflow, /collect-risk-lab-dividend-notices\.ts/);
  assert.match(workflow, /git push --force-with-lease/);
  assert.match(workflow, /gh pr create/);
  assert.match(workflow, /Premium integrado: \\`false\\`/);
  assert.match(workflow, /notificações enviadas: \\`false\\`/);
});

test("workflow e endpoint compartilham exatamente o mesmo identificador protegido", () => {
  const match = backtestService.match(/export const RISK_LAB_COHORT_BACKTEST_RUN_ID = "([^"]+)"/);
  assert.ok(match, "Constante protegida do backtest não encontrada.");
  assert.match(workflow, new RegExp(`RUN_ID:\\s*${escapeRegex(match[1])}`));
  assert.match(workflow, /src\/lib\/risk-lab\/RiskLabCohortBacktestV2Service\.ts/);
  assert.match(route, /parameters\.runId === RISK_LAB_COHORT_BACKTEST_RUN_ID/);
});

test("endpoint de identidades continua protegido pelo SHA exato de Produção", () => {
  assert.match(route, /parameters\.release === deployedRelease/);
  assert.match(route, /parameters\.source === "github-actions"/);
  assert.match(route, /action === "identities"/);
});

test("backtest usa avisos congelados e CVM somente como reconciliação auxiliar", () => {
  assert.match(concurrent, /FrozenDividendNoticeSeriesService/);
  assert.match(concurrent, /CvmMonthlyCohortDividendSeriesAdapter/);
  assert.match(concurrent, /não alimenta o detector/);
  assert.doesNotMatch(series, /CvmMonthlyDividendSeriesService|official_monthly_liability_per_share/);
});

test("dataset inicial permanece bloqueado até a coleta primária automática", () => {
  assert.equal(dataset.status, "pending");
  assert.equal(dataset.cases.length, 0);
  assert.equal(dataset.datasetHash, null);
});
