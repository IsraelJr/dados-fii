import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../src/app/carteira/page.tsx", import.meta.url);
let source = await readFile(path, "utf8");

const oldInvocation = "<SimpleMonthlySummary insights={insights} historicalStats={historicalDividendStats} topWeight={topWeight} topWeightPercent={topWeightPercent} />";
const snapshotInvocation = "<SimpleMonthlySummary insights={insights} snapshots={consolidatedSnapshots} topWeight={topWeight} topWeightPercent={topWeightPercent} />";
if (source.includes(oldInvocation)) source = source.replace(oldInvocation, snapshotInvocation);

const start = source.indexOf("function SimpleMonthlySummary(");
const end = source.indexOf("\n\nfunction VisualHistorySection", start);
if (start < 0 || end < 0) throw new Error("SimpleMonthlySummary boundaries not found");

const replacement = `function SimpleMonthlySummary({ insights, snapshots, topWeight, topWeightPercent }: { insights: WalletInsights; snapshots: readonly WalletSnapshot[]; topWeight?: EnrichedFii; topWeightPercent: number }) {
  const history = insights.dividendHistory;
  const currentYear = new Date().getFullYear();
  const currentYearBest = history.best;
  const currentYearWorst = history.worst;
  const currentYearTotal = history.total;
  const currentYearAverage = history.average;

  const previousPaidSnapshots = snapshots.filter(
    (snapshot) => snapshot.estimatedMonthlyIncome > 0 && getSnapshotYear(snapshot) !== currentYear,
  );
  const previousSorted = [...previousPaidSnapshots].sort(
    (left, right) => right.estimatedMonthlyIncome - left.estimatedMonthlyIncome,
  );
  const previousBest = previousSorted[0] || null;
  const previousWorst = previousSorted.at(-1) || null;

  const currentBestValue = currentYearBest?.value ?? 0;
  const currentWorstValue = currentYearWorst?.value ?? Number.POSITIVE_INFINITY;
  const allTimeBest = currentYearBest && (!previousBest || currentBestValue >= previousBest.estimatedMonthlyIncome)
    ? { label: \`\${currentYearBest.label}/\${currentYear}\`, value: currentBestValue }
    : previousBest
      ? { label: \`\${getSnapshotMonthLabel(previousBest)}/\${getSnapshotYear(previousBest)}\`, value: previousBest.estimatedMonthlyIncome }
      : null;
  const allTimeWorst = currentYearWorst && (!previousWorst || currentWorstValue <= previousWorst.estimatedMonthlyIncome)
    ? { label: \`\${currentYearWorst.label}/\${currentYear}\`, value: currentWorstValue }
    : previousWorst
      ? { label: \`\${getSnapshotMonthLabel(previousWorst)}/\${getSnapshotYear(previousWorst)}\`, value: previousWorst.estimatedMonthlyIncome }
      : null;

  const previousTotalsByYear = previousPaidSnapshots.reduce((totals, snapshot) => {
    const year = getSnapshotYear(snapshot);
    totals.set(year, (totals.get(year) || 0) + snapshot.estimatedMonthlyIncome);
    return totals;
  }, new Map<number, number>());
  const previousBestYear = [...previousTotalsByYear.entries()].sort((left, right) => right[1] - left[1])[0] || null;
  const bestYear = !previousBestYear || currentYearTotal >= previousBestYear[1]
    ? { year: currentYear, total: currentYearTotal }
    : { year: previousBestYear[0], total: previousBestYear[1] };

  return (
    <section className="mt-6 rounded-2xl bg-white p-5 text-slate-800 shadow-sm ring-1 ring-slate-200">
      <div>
        <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-700"><BarChart3 size={14} /> Resumo</p>
        <h2 className="mt-3 text-xl font-black text-slate-900">Leitura rápida dos números</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Meses informados manualmente substituem a estimativa calculada com as cotas atuais.</p>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <LightMetric label={\`Maior mês (\${currentYear})\`} value={currentYearBest ? \`\${currentYearBest.label}/\${currentYear}: \${formatCurrency(currentYearBest.value)}\` : "-"} />
        <LightMetric label={\`Menor mês (\${currentYear})\`} value={currentYearWorst ? \`\${currentYearWorst.label}/\${currentYear}: \${formatCurrency(currentYearWorst.value)}\` : "-"} />
        <LightMetric label="Maior da história" value={allTimeBest ? \`\${allTimeBest.label}: \${formatCurrency(allTimeBest.value)}\` : "-"} />
        <LightMetric label="Menor da história" value={allTimeWorst ? \`\${allTimeWorst.label}: \${formatCurrency(allTimeWorst.value)}\` : "-"} />
        <LightMetric label="Maior ano de dividendos" value={\`\${bestYear.year}: \${formatCurrency(bestYear.total)}\`} />
        <LightMetric label="Total do ano" value={\`\${currentYear}: \${formatCurrency(currentYearTotal)}\`} />
        <LightMetric label="Média mensal" value={formatCurrency(currentYearAverage)} />
        <LightMetric label="Maior pagador estimado" value={history.topPayer ? \`\${history.topPayer.ticker}: \${formatCurrency(history.topPayer.value)}\` : "-"} />
        <LightMetric label="Maior peso financeiro" value={topWeight ? \`\${topWeight.ticker}: \${formatPercentValue(topWeightPercent)}\` : "-"} />
      </div>
    </section>
  );
}`;

source = source.slice(0, start) + replacement + source.slice(end);
await writeFile(path, source);
