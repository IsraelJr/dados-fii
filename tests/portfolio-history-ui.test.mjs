import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function text(path) {
  return readFileSync(path, "utf8");
}

test("painel de histórico usa API server-side e não Firestore", () => {
  const source = text("src/app/components/PortfolioHistoryPanel.tsx");
  assert.match(source, /\/api\/portfolio\/history/);
  assert.match(source, /x-wallet-email/);
  assert.match(source, /x-wallet-session/);
  assert.doesNotMatch(source, /firebaseAdmin|adminDb|\.collection\(/);
});

test("painel permite incluir, sobrescrever e excluir registros manuais", () => {
  const source = text("src/app/components/PortfolioHistoryPanel.tsx");
  const flush = text("src/lib/portfolio/PortfolioHistoryFlush.ts");
  assert.match(flush, /input\.request\("POST"/);
  assert.match(flush, /input\.request\("PATCH"/);
  assert.match(flush, /input\.request\("DELETE"/);
  assert.match(source, /entry\.source !== "manual"/);
  assert.match(source, /pendingRef/);
  assert.match(source, /reconcilePortfolioHistoryQueueAfterFlush/);
  assert.match(source, /inFlightUpserts/);
  assert.match(source, /Meses informados/);
  assert.match(source, /Salvar mês/);
});

test("relatório incremental atualiza somente após confirmação remota sem payload sensível", () => {
  const panel = text("src/app/components/PortfolioHistoryPanel.tsx");
  const flush = text("src/lib/portfolio/PortfolioHistoryFlush.ts");
  const report = text("src/app/components/PortfolioIncrementalReportPanel.tsx");
  assert.match(panel, /new Event\(PORTFOLIO_HISTORY_PERSISTED_EVENT\)/);
  assert.doesNotMatch(panel, /new CustomEvent\(PORTFOLIO_HISTORY_PERSISTED_EVENT/);
  assert.match(flush, /if \(remoteMutationCompleted\) input\.onPersisted\(\)/);
  assert.match(report, /addEventListener\(PORTFOLIO_HISTORY_PERSISTED_EVENT, refreshAfterPersistence\)/);
  assert.match(report, /scheduleRefresh\(REFRESH_DEBOUNCE_MS\)/);
});

test("histórico manual está integrado à página da carteira", () => {
  const preferences = text("src/app/components/PortfolioNotificationPreferences.tsx");
  assert.match(preferences, /PortfolioHistoryPanel/);
  assert.match(preferences, /<PortfolioHistoryPanel \/>/);
});

test("sincronização cobre saída, background, congelamento e retorno online", () => {
  const panel = text("src/app/components/PortfolioHistoryPanel.tsx");
  const preferences = text("src/app/components/PortfolioNotificationPreferences.tsx");
  assert.match(panel, /pagehide/);
  assert.match(panel, /keepalive/);
  assert.match(preferences, /visibilitychange/);
  assert.match(preferences, /visibilityState === "hidden"/);
  assert.match(preferences, /"freeze"/);
  assert.match(preferences, /"online"/);
});

test("telemetria registra apenas nomes allowlistados e não envia valores financeiros", () => {
  const panel = text("src/app/components/PortfolioHistoryPanel.tsx");
  const contract = text("src/lib/product/ProductEvent.ts");
  const controller = text("src/server/controllers/ProductEventController.ts");
  assert.match(panel, /\/api\/product\/events/);
  for (const event of [
    "portfolio_viewed",
    "history_month_added",
    "history_month_updated",
    "history_month_deleted",
  ]) {
    assert.match(panel, new RegExp(event));
    assert.match(contract, new RegExp(event));
  }
  assert.match(panel, /JSON\.stringify\(\{ name \}\)/);
  assert.doesNotMatch(controller, /totalValue|dividends|ticker|email\s*:/);
});

test("interface não contém e-mail pessoal nem desbloqueio por anúncio", () => {
  const source = [
    text("src/app/components/PortfolioHistoryPanel.tsx"),
    text("src/app/components/PortfolioNotificationPreferences.tsx"),
  ].join("\n");
  assert.doesNotMatch(source, /israel\.junior2111@gmail\.com/i);
  assert.doesNotMatch(source, /adsense|assistir.*anúncio|propaganda/i);
});

test("resumo e gráfico consomem os mesmos snapshots sem patches de build", () => {
  const page = text("src/app/carteira/page.tsx");
  const layout = text("src/app/carteira/layout.tsx");
  const uxEnhancer = text("src/app/components/WalletPageUxEnhancer.tsx");
  const packageJson = JSON.parse(text("package.json"));
  const vercel = JSON.parse(text("vercel.json"));

  assert.match(page, /<VisualHistorySection snapshots=\{consolidatedSnapshots\} \/>/);
  assert.match(page, /<SimpleMonthlySummary snapshots=\{consolidatedSnapshots\} \/>/);
  assert.match(page, /snapshots: readonly WalletSnapshot\[\]/);
  assert.match(page, /className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6"/);
  assert.match(page, /function SummaryMetric\(\{ label, primary, value \}/);
  assert.match(page, /text-indigo-700/);
  assert.doesNotMatch(page, /mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4/);
  assert.doesNotMatch(page, /historicalStats|HistoricalDividendStats|buildHistoricalDividendStats/);
  assert.doesNotMatch(uxEnhancer, /replaceDividendExtremesSummary|readHistoricalDividendSnapshots|data-dividend-extremes-fixed/);
  assert.doesNotMatch(layout, /WalletHistoricalSummaryEnhancer/);
  assert.equal(existsSync("src/app/components/WalletHistoricalSummaryEnhancer.tsx"), false);
  assert.equal(existsSync("scripts/apply-current-year-summary-source.mjs"), false);
  assert.equal(existsSync(".github/workflows/patch-current-year-summary.yml"), false);
  assert.equal(packageJson.scripts["prepare:summary-source"], undefined);
  assert.equal(packageJson.scripts.predev, undefined);
  assert.equal(packageJson.scripts.build, "next build");
  assert.equal(vercel.buildCommand, undefined);
});
