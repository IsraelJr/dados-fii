import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../src/app/carteira/page.tsx", import.meta.url);
const source = await readFile(path, "utf8");

if (source.includes("const currentYearBest = history.best;")) {
  process.exit(0);
}

const functionAnchor = `function SimpleMonthlySummary({ insights, historicalStats, topWeight, topWeightPercent }: { insights: WalletInsights; historicalStats: HistoricalDividendStats; topWeight?: EnrichedFii; topWeightPercent: number }) {
  const history = insights.dividendHistory;
  return (`;

const functionReplacement = `function SimpleMonthlySummary({ insights, historicalStats, topWeight, topWeightPercent }: { insights: WalletInsights; historicalStats: HistoricalDividendStats; topWeight?: EnrichedFii; topWeightPercent: number }) {
  const history = insights.dividendHistory;
  const currentYearBest = history.best;
  const currentYearWorst = history.worst;
  const currentYearTotal = history.total;
  const currentYearAverage = history.average;
  const historicalBestValue = historicalStats.allTimeBest?.estimatedMonthlyIncome ?? 0;
  const historicalWorstValue = historicalStats.allTimeWorst?.estimatedMonthlyIncome ?? Number.POSITIVE_INFINITY;
  const allTimeBest = currentYearBest && currentYearBest.value >= historicalBestValue
    ? { label: \`${"${currentYearBest.label}"}/${"${String(historicalStats.currentYear).slice(-2)}"}\`, value: currentYearBest.value }
    : historicalStats.allTimeBest
      ? { label: historicalStats.allTimeBest.label, value: historicalStats.allTimeBest.estimatedMonthlyIncome }
      : null;
  const allTimeWorst = currentYearWorst && currentYearWorst.value <= historicalWorstValue
    ? { label: \`${"${currentYearWorst.label}"}/${"${String(historicalStats.currentYear).slice(-2)}"}\`, value: currentYearWorst.value }
    : historicalStats.allTimeWorst
      ? { label: historicalStats.allTimeWorst.label, value: historicalStats.allTimeWorst.estimatedMonthlyIncome }
      : null;
  const bestYear = !historicalStats.bestYear || currentYearTotal >= historicalStats.bestYear.total
    ? { year: historicalStats.currentYear, total: currentYearTotal }
    : historicalStats.bestYear;
  return (`;

const metricsAnchor = `<LightMetric label={\`Maior mês de ${"${historicalStats.currentYear}"}\`} value={historicalStats.currentYearBest ? \`${"${getSnapshotMonthLabel(historicalStats.currentYearBest)}"}: ${"${formatCurrency(historicalStats.currentYearBest.estimatedMonthlyIncome)}"}\` : "-"} />
        <LightMetric label={\`Menor mês de ${"${historicalStats.currentYear}"}\`} value={historicalStats.currentYearWorst ? \`${"${getSnapshotMonthLabel(historicalStats.currentYearWorst)}"}: ${"${formatCurrency(historicalStats.currentYearWorst.estimatedMonthlyIncome)}"}\` : "-"} />
        <LightMetric label="Total no ano" value={formatCurrency(historicalStats.currentYearTotal)} />
        <LightMetric label="Média mensal" value={formatCurrency(historicalStats.currentYearAverage)} />
        <LightMetric label="Maior mês do histórico" value={historicalStats.allTimeBest ? \`${"${historicalStats.allTimeBest.label}"}: ${"${formatCurrency(historicalStats.allTimeBest.estimatedMonthlyIncome)}"}\` : "-"} />
        <LightMetric label="Menor mês do histórico" value={historicalStats.allTimeWorst ? \`${"${historicalStats.allTimeWorst.label}"}: ${"${formatCurrency(historicalStats.allTimeWorst.estimatedMonthlyIncome)}"}\` : "-"} />
        <LightMetric label="Maior ano de dividendos" value={historicalStats.bestYear ? \`${"${historicalStats.bestYear.year}"}: ${"${formatCurrency(historicalStats.bestYear.total)}"}\` : "-"} />`;

const metricsReplacement = `<LightMetric label={\`Maior mês de ${"${historicalStats.currentYear}"}\`} value={currentYearBest ? \`${"${currentYearBest.label}"}: ${"${formatCurrency(currentYearBest.value)}"}\` : "-"} />
        <LightMetric label={\`Menor mês de ${"${historicalStats.currentYear}"}\`} value={currentYearWorst ? \`${"${currentYearWorst.label}"}: ${"${formatCurrency(currentYearWorst.value)}"}\` : "-"} />
        <LightMetric label="Total no ano" value={formatCurrency(currentYearTotal)} />
        <LightMetric label="Média mensal" value={formatCurrency(currentYearAverage)} />
        <LightMetric label="Maior mês do histórico" value={allTimeBest ? \`${"${allTimeBest.label}"}: ${"${formatCurrency(allTimeBest.value)}"}\` : "-"} />
        <LightMetric label="Menor mês do histórico" value={allTimeWorst ? \`${"${allTimeWorst.label}"}: ${"${formatCurrency(allTimeWorst.value)}"}\` : "-"} />
        <LightMetric label="Maior ano de dividendos" value={bestYear ? \`${"${bestYear.year}"}: ${"${formatCurrency(bestYear.total)}"}\` : "-"} />`;

if (!source.includes(functionAnchor)) {
  throw new Error("SimpleMonthlySummary anchor not found");
}

const withFunction = source.replace(functionAnchor, functionReplacement);
if (!withFunction.includes(metricsAnchor)) {
  throw new Error("Summary metric anchor not found");
}

await writeFile(path, withFunction.replace(metricsAnchor, metricsReplacement));
