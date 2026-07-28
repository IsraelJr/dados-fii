import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../src/app/carteira/page.tsx", import.meta.url);
let source = await readFile(path, "utf8");

const oldInvocation = "<SimpleMonthlySummary insights={insights} historicalStats={historicalDividendStats} topWeight={topWeight} topWeightPercent={topWeightPercent} />";
const newInvocation = "<SimpleMonthlySummary insights={insights} snapshots={consolidatedSnapshots} topWeight={topWeight} topWeightPercent={topWeightPercent} />";

if (source.includes(oldInvocation)) {
  source = source.replace(oldInvocation, newInvocation);
}

const startMarker = "function SimpleMonthlySummary(";
const endMarker = "\n\nfunction VisualHistorySection";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

if (start < 0 || end < 0) {
  throw new Error("SimpleMonthlySummary boundaries not found");
}

const replacement = `function SimpleMonthlySummary({ insights, snapshots, topWeight, topWeightPercent }: { insights: WalletInsights; snapshots: WalletSnapshot[]; topWeight?: EnrichedFii; topWeightPercent: number }) {
  const history = insights.dividendHistory;
  const currentYear = new Date().getFullYear();
  const paidSnapshots = snapshots.filter((snapshot) => snapshot.estimatedMonthlyIncome > 0);
  const currentYearSnapshots = paidSnapshots.filter((snapshot) => getSnapshotYear(snapshot) === currentYear);
  const byIncomeDescending = (items: readonly WalletSnapshot[]) => [...items].sort((left, right) => right.estimatedMonthlyIncome - left.estimatedMonthlyIncome);
  const currentYearSorted = byIncomeDescending(currentYearSnapshots);
  const allTimeSorted = byIncomeDescending(paidSnapshots);
  const currentYearTotal = currentYearSnapshots.reduce((total, snapshot) => total + snapshot.estimatedMonthlyIncome, 0);
  const currentYearAverage = currentYearSnapshots.length ? currentYearTotal / currentYearSnapshots.length : 0;
  const currentYearBest = currentYearSorted[0] || null;
  const currentYearWorst = currentYearSorted.at(-1) || null;
  const allTimeBest = allTimeSorted[0] || null;
  const allTimeWorst = allTimeSorted.at(-1) || null;
  const totalsByYear = paidSnapshots.reduce((totals, snapshot) => {
    const year = getSnapshotYear(snapshot);
    totals.set(year, (totals.get(year) || 0) + snapshot.estimatedMonthlyIncome);
    return totals;
  }, new Map<number, number>());
  const bestYearEntry = [...totalsByYear.entries()].sort((left, right) => right[1] - left[1])[0];
  const bestYear = bestYearEntry ? { year: bestYearEntry[0], total: bestYearEntry[1] } : null;

  return (
    <section className="mt-6 rounded-2xl bg-white p-5 text-slate-800 shadow-sm ring-1 ring-slate-200">
      <div>
        <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-700"><BarChart3 size={14} /> Resumo</p>
        <h2 className="mt-3 text-xl font-black text-slate-900">Leitura rápida dos números</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Meses informados manualmente substituem a estimativa calculada com as cotas atuais.</p>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <LightMetric label={\`Maior mês de \${currentYear}\`} value={currentYearBest ? \`\${getSnapshotMonthLabel(currentYearBest)}: \${formatCurrency(currentYearBest.estimatedMonthlyIncome)}\` : "-"} />
        <LightMetric label={\`Menor mês de \${currentYear}\`} value={currentYearWorst ? \`\${getSnapshotMonthLabel(currentYearWorst)}: \${formatCurrency(currentYearWorst.estimatedMonthlyIncome)}\` : "-"} />
        <LightMetric label="Total no ano" value={formatCurrency(currentYearTotal)} />
        <LightMetric label="Média mensal" value={formatCurrency(currentYearAverage)} />
        <LightMetric label="Maior mês do histórico" value={allTimeBest ? \`\${allTimeBest.label}: \${formatCurrency(allTimeBest.estimatedMonthlyIncome)}\` : "-"} />
        <LightMetric label="Menor mês do histórico" value={allTimeWorst ? \`\${allTimeWorst.label}: \${formatCurrency(allTimeWorst.estimatedMonthlyIncome)}\` : "-"} />
        <LightMetric label="Maior ano de dividendos" value={bestYear ? \`\${bestYear.year}: \${formatCurrency(bestYear.total)}\` : "-"} />
        <LightMetric label="Maior pagador estimado" value={history.topPayer ? \`\${history.topPayer.ticker}: \${formatCurrency(history.topPayer.value)}\` : "-"} />
        <LightMetric label="Maior peso financeiro" value={topWeight ? \`\${topWeight.ticker}: \${formatPercentValue(topWeightPercent)}\` : "-"} />
      </div>
    </section>
  );
}`;

source = source.slice(0, start) + replacement + source.slice(end);
await writeFile(path, source);
