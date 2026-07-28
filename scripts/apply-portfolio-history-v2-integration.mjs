import { readFile, writeFile } from "node:fs/promises";

const path = "src/app/carteira/page.tsx";
let source = await readFile(path, "utf8");

function replaceOnce(search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Trecho não encontrado: ${label}`);
  source = source.replace(search, replacement);
}

replaceOnce(
  `type DividendMonth = { month: string; label: string; value: number };`,
  `type ManualHistoryEntry = Readonly<{\n  competence: string;\n  dividends: number | null;\n  source: "manual" | "automatic_snapshot" | "legacy";\n}>;\ntype DividendMonth = { month: string; label: string; value: number };`,
  "tipo do histórico manual",
);

replaceOnce(
  `const SNAPSHOT_KEY = "dados-fii-wallet-monthly-snapshots-v1";`,
  `const SNAPSHOT_KEY = "dados-fii-wallet-monthly-snapshots-v1";\nconst EMAIL_KEY = "dados-fii-wallet-email";\nconst TOKEN_KEY = "dados-fii-wallet-session";\nconst HISTORY_UPDATED_EVENT = "dados-fii-portfolio-history-updated";`,
  "constantes do histórico",
);

replaceOnce(
  `function buildDividendHistory(items: EnrichedFii[]): DividendHistory {`,
  `function buildDividendHistory(items: EnrichedFii[], manualEntries: readonly ManualHistoryEntry[]): DividendHistory {`,
  "assinatura de buildDividendHistory",
);

replaceOnce(
  `    const value = items.reduce((acc, item) => {\n      const earning = getYearData(item.data, year)?.[month]?.earnings;\n      const amount = parseCurrency(earning) * item.quotas;\n      if (amount > 0) byTicker[item.ticker] = (byTicker[item.ticker] || 0) + amount;\n      return acc + amount;\n    }, 0);\n    return { month, label: MONTHS_SHORT_PTBR[month], value };`,
  `    const estimatedValue = items.reduce((acc, item) => {\n      const earning = getYearData(item.data, year)?.[month]?.earnings;\n      const amount = parseCurrency(earning) * item.quotas;\n      if (amount > 0) byTicker[item.ticker] = (byTicker[item.ticker] || 0) + amount;\n      return acc + amount;\n    }, 0);\n    const competence = \`${year}-\${String(MONTHS.indexOf(month) + 1).padStart(2, "0")}\`;\n    const manualValue = manualEntries.find((entry) => entry.competence === competence)?.dividends;\n    const value = typeof manualValue === "number" ? manualValue : estimatedValue;\n    return { month, label: MONTHS_SHORT_PTBR[month], value };`,
  "precedência mensal",
);

replaceOnce(
  `  const [snapshots, setSnapshots] = useState<WalletSnapshot[]>([]);`,
  `  const [snapshots, setSnapshots] = useState<WalletSnapshot[]>([]);\n  const [manualHistory, setManualHistory] = useState<readonly ManualHistoryEntry[]>([]);`,
  "estado do histórico manual",
);

replaceOnce(
  `  useEffect(() => {\n    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));`,
  `  useEffect(() => {\n    const applyEntries = (entries: unknown) => {\n      if (!Array.isArray(entries)) return;\n      setManualHistory(entries.filter((entry): entry is ManualHistoryEntry => Boolean(\n        entry && typeof entry === "object" && typeof (entry as ManualHistoryEntry).competence === "string",\n      )));\n    };\n\n    const loadHistory = async () => {\n      const email = window.localStorage.getItem(EMAIL_KEY)?.trim().toLowerCase();\n      const token = window.localStorage.getItem(TOKEN_KEY);\n      if (!email || !token) {\n        setManualHistory([]);\n        return;\n      }\n      try {\n        const response = await fetch("/api/portfolio/history?portfolioId=default", {\n          headers: { "x-wallet-email": email, "x-wallet-session": token },\n        });\n        const json = await response.json();\n        if (response.ok && json?.ok) applyEntries(json.entries);\n      } catch {\n        // O painel de histórico exibe o erro de carregamento; os demais dados da carteira continuam disponíveis.\n      }\n    };\n\n    const onHistory = (event: Event) => {\n      const detail = (event as CustomEvent<{ entries?: unknown }>).detail;\n      applyEntries(detail?.entries);\n    };\n    const onSession = () => void loadHistory();\n\n    window.addEventListener(HISTORY_UPDATED_EVENT, onHistory);\n    window.addEventListener("dados-fii-wallet-session-updated", onSession);\n    void loadHistory();\n    return () => {\n      window.removeEventListener(HISTORY_UPDATED_EVENT, onHistory);\n      window.removeEventListener("dados-fii-wallet-session-updated", onSession);\n    };\n  }, []);\n\n  useEffect(() => {\n    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));`,
  "carregamento e evento do histórico",
);

replaceOnce(
  `    const dividendHistory = buildDividendHistory(enriched);`,
  `    const dividendHistory = buildDividendHistory(enriched, manualHistory);`,
  "consumo no resumo",
);

replaceOnce(
  `  }, [loaded]);`,
  `  }, [loaded, manualHistory]);`,
  "dependência do resumo",
);

replaceOnce(
  `  const topWeightPercent = insights.currentValue && topWeight ? (topWeight.currentValuePosition / insights.currentValue) * 100 : 0;`,
  `  const topWeightPercent = insights.currentValue && topWeight ? (topWeight.currentValuePosition / insights.currentValue) * 100 : 0;\n  const consolidatedSnapshots = useMemo(() => {\n    const byCompetence = new Map(snapshots.map((snapshot) => [snapshot.monthKey, snapshot]));\n    manualHistory.forEach((entry) => {\n      if (typeof entry.dividends !== "number") return;\n      const current = byCompetence.get(entry.competence);\n      byCompetence.set(entry.competence, {\n        monthKey: entry.competence,\n        label: monthLabelFromKey(entry.competence),\n        totalValue: current?.totalValue ?? 0,\n        estimatedMonthlyIncome: entry.dividends,\n        announcedMonthlyIncome: entry.dividends,\n        walletCount: current?.walletCount ?? items.length,\n        topWeightTicker: current?.topWeightTicker,\n        topIncomeTicker: current?.topIncomeTicker,\n        createdAt: current?.createdAt ?? new Date().toISOString(),\n        updatedAt: new Date().toISOString(),\n      });\n    });\n    return [...byCompetence.values()].sort((left, right) => left.monthKey.localeCompare(right.monthKey));\n  }, [snapshots, manualHistory, items.length]);`,
  "snapshots consolidados",
);

replaceOnce(
  `      <VisualHistorySection snapshots={snapshots} />`,
  `      <VisualHistorySection snapshots={consolidatedSnapshots} />`,
  "gráfico consolidado",
);

replaceOnce(
  `<LightMetric label="Maior mês estimado"`,
  `<LightMetric label="Maior mês do histórico"`,
  "rótulo maior mês",
);
replaceOnce(
  `<LightMetric label="Menor mês estimado"`,
  `<LightMetric label="Menor mês do histórico"`,
  "rótulo menor mês",
);
replaceOnce(
  `<LightMetric label="Total estimado no ano"`,
  `<LightMetric label="Total no ano"`,
  "rótulo total",
);
replaceOnce(
  `<LightMetric label="Média mensal estimada"`,
  `<LightMetric label="Média mensal"`,
  "rótulo média",
);

await writeFile(path, source);
