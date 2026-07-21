import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const parser = readFileSync("src/lib/risk-lab/CvmMonthlyBulkParser.ts", "utf8");
const monthly = readFileSync("src/lib/risk-lab/CvmMonthlyDividendSeriesService.ts", "utf8");
const adapter = readFileSync("src/lib/risk-lab/CvmMonthlyCohortDividendSeriesAdapter.ts", "utf8");
const compatibility = readFileSync("src/lib/risk-lab/ConcurrentAutomaticDividendSeriesService.ts", "utf8");
const segmented = readFileSync("src/lib/risk-lab/SegmentedRiskLabCohortBacktestService.ts", "utf8");

const source = `${parser}\n${monthly}\n${adapter}\n${compatibility}`;

test("execução segmentada mantém contrato e recebe o adaptador oficial CVM", () => {
  assert.match(segmented, /ConcurrentAutomaticDividendSeriesService/);
  assert.match(compatibility, /CvmMonthlyCohortDividendSeriesAdapter/);
  assert.match(compatibility, /build\(ticker: string, documents: AutomaticDocumentEvidence\[\]\)/);
});

test("lote mensal usa somente fonte oficial e evidência versionada", () => {
  assert.match(monthly, /dados\.cvm\.gov\.br\/dados\/FII\/DOC\/INF_MENSAL\/DADOS/);
  assert.match(parser, /Rendimentos_Distribuir/);
  assert.match(parser, /Cotas_Emitidas/);
  assert.match(parser, /Data_Entrega/);
  assert.match(parser, /sourceVersion/);
  assert.match(parser, /sha256/);
});

test("janela nasce da coorte congelada sem parâmetros técnicos do usuário", () => {
  assert.match(adapter, /out-of-sample-cohort-v0\.1\.json/);
  assert.match(adapter, /analysisWindow\.start/);
  assert.match(adapter, /analysisWindow\.end/);
  assert.doesNotMatch(source, /manual_document_review|approve\(|confirm\(|checkbox/);
});

test("Premium, IA textual e notificações permanecem fora da coleta", () => {
  assert.doesNotMatch(source, /sendEmail|sendNotification|AIInsights|openai|premiumIntegrated|notificationsSent/);
});

test("caminho crítico não consulta páginas individuais do Fundos.NET", () => {
  assert.doesNotMatch(source, /exibirDocumento|visualizarProtocolo|fnet\.bmfbovespa/);
});
