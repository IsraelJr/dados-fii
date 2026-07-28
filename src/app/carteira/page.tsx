'use client';

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Download,
  LineChart,
  Loader2,
  Minus,
  PieChart,
  Plus,
  Save,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import WalletRiskReportCard from "../components/WalletRiskReportCard";
import AppToast from "../components/AppToast";
import WalletEmailVerifiedSync from "../components/WalletEmailVerifiedSync";
import PortfolioNotificationPreferences from "../components/PortfolioNotificationPreferences";

type WalletItem = { ticker: string; quotas: number };
type LoadedFii = WalletItem & { data?: any; error?: string };
type EnrichedFii = LoadedFii & {
  lastDividend: { month: string; info: any } | null;
  currentDividend: { month: string; info: any } | null;
  estimatedIncome: number;
  announcedIncome: number;
  currentValuePosition: number;
  segment: string;
  dailyVariation: number;
  waitingAnnouncement: boolean;
};
type Payment = { ticker: string; quotas: number; date: string; dateWith?: string; amount: number; dividend: number; month: string };
type ChartItem = { label: string; value: number; detail?: string };
type WalletSnapshot = {
  monthKey: string;
  label: string;
  totalValue: number;
  estimatedMonthlyIncome: number;
  announcedMonthlyIncome: number;
  walletCount: number;
  topWeightTicker?: string;
  topIncomeTicker?: string;
  createdAt: string;
  updatedAt: string;
};
type ManualHistoryEntry = Readonly<{
  competence: string;
  dividends: number | null;
  source: "manual" | "automatic_snapshot" | "legacy";
  updatedAt?: string;
}>;
type HistoricalDividendStats = Readonly<{
  currentYear: number;
  currentYearTotal: number;
  currentYearAverage: number;
  currentYearBest: WalletSnapshot | null;
  currentYearWorst: WalletSnapshot | null;
  allTimeBest: WalletSnapshot | null;
  allTimeWorst: WalletSnapshot | null;
  bestYear: { year: number; total: number } | null;
}>;
type DividendMonth = { month: string; label: string; value: number };
type DividendHistory = {
  months: DividendMonth[];
  visibleMonths: DividendMonth[];
  total: number;
  average: number;
  best: DividendMonth | null;
  worst: DividendMonth | null;
  topPayer: { ticker: string; value: number } | null;
};
type WalletInsights = {
  currentMonth: string;
  enriched: EnrichedFii[];
  monthlyIncome: number;
  announcedIncome: number;
  currentValue: number;
  pendingIncome: number;
  waiting: EnrichedFii[];
  topIncome: EnrichedFii[];
  topWeight: EnrichedFii[];
  segmentBreakdown: Array<{ ticker: string; value: string }>;
  mainSegment?: { ticker: string; value: string };
  assetWeights: ChartItem[];
  segmentWeights: ChartItem[];
  incomeByFii: ChartItem[];
  dividendHistory: DividendHistory;
};

const STORAGE_KEY = "dados-fii-wallet-v1";
const SNAPSHOT_KEY = "dados-fii-wallet-monthly-snapshots-v1";
const EMAIL_KEY = "dados-fii-wallet-email";
const TOKEN_KEY = "dados-fii-wallet-session";
const HISTORY_UPDATED_EVENT = "dados-fii-portfolio-history-updated";
const HISTORY_CACHE_KEY = "dados-fii-portfolio-history-cache-v2";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_PTBR: Record<string, string> = {
  January: "Janeiro",
  February: "Fevereiro",
  March: "Março",
  April: "Abril",
  May: "Maio",
  June: "Junho",
  July: "Julho",
  August: "Agosto",
  September: "Setembro",
  October: "Outubro",
  November: "Novembro",
  December: "Dezembro",
};
const MONTHS_SHORT_PTBR: Record<string, string> = {
  January: "Jan",
  February: "Fev",
  March: "Mar",
  April: "Abr",
  May: "Mai",
  June: "Jun",
  July: "Jul",
  August: "Ago",
  September: "Set",
  October: "Out",
  November: "Nov",
  December: "Dez",
};

function parseCurrency(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  return Number(String(value || "0").replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCurrencyCompact(value: number) {
  if (Math.abs(value) >= 1000) return `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: value >= 100 ? 0 : 2 });
}

function formatPercentValue(value: number) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function formatPaymentSummary(payment?: Payment) {
  return payment ? `${formatCurrency(payment.amount)} em ${payment.date}` : "Sem pagamento futuro na base";
}

function getCurrentMonthName() {
  return MONTHS[new Date().getMonth()];
}

function getYearData(data: any, year = new Date().getFullYear()) {
  return data?.[`earnings${year}`] || {};
}

function getCurrentYearData(data: any) {
  const year = new Date().getFullYear();
  return data?.[`earnings${year}`] || data?.[`earnings${year - 1}`] || {};
}

function getLastDividend(data: any) {
  const yearData = getCurrentYearData(data);
  const months = Object.keys(yearData).sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));
  const lastMonth = months[months.length - 1];
  return lastMonth ? { month: lastMonth, info: yearData[lastMonth] } : null;
}

function getCurrentMonthDividend(data: any) {
  const month = getCurrentMonthName();
  const yearData = getCurrentYearData(data);
  return yearData?.[month] ? { month, info: yearData[month] } : null;
}

function getSegmentName(data: any) {
  return data?.segment_new || data?.segment || "Sem segmento";
}

function percentToNumber(value: unknown) {
  return Number(String(value || "0").replace("%", "").replace(",", ".").trim()) || 0;
}

function getDailyVariation(data: any) {
  const value = percentToNumber(data?.variation ?? data?.dailyVariation ?? data?.changePercent);
  return Number.isFinite(value) ? value : 0;
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabelFromKey(key: string) {
  const [year, month] = key.split("-");
  const index = Number(month) - 1;
  return `${MONTHS_SHORT_PTBR[MONTHS[index]] || month}/${String(year).slice(-2)}`;
}

function getSnapshotYear(snapshot: WalletSnapshot) {
  const year = Number(String(snapshot.monthKey || "").slice(0, 4));
  return Number.isFinite(year) ? year : new Date().getFullYear();
}

function getSnapshotMonthIndex(snapshot: WalletSnapshot) {
  const index = Number(String(snapshot.monthKey || "").slice(5, 7)) - 1;
  return Number.isFinite(index) && index >= 0 ? index : 0;
}

function getSnapshotMonthLabel(snapshot: WalletSnapshot) {
  const month = MONTHS[getSnapshotMonthIndex(snapshot)];
  return MONTHS_SHORT_PTBR[month] || snapshot.label || snapshot.monthKey;
}

function getHistoryYears() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, index) => currentYear - index);
}

function getBarWidthClass(value: string) {
  const percent = percentToNumber(value);
  if (percent >= 90) return "w-full";
  if (percent >= 80) return "w-10/12";
  if (percent >= 70) return "w-9/12";
  if (percent >= 60) return "w-8/12";
  if (percent >= 50) return "w-7/12";
  if (percent >= 40) return "w-6/12";
  if (percent >= 30) return "w-5/12";
  if (percent >= 20) return "w-4/12";
  if (percent >= 10) return "w-3/12";
  if (percent > 0) return "w-2/12";
  return "w-0";
}

function getUpcomingPayments(items: LoadedFii[]) {
  const today = new Date();
  const payments: Payment[] = [];

  items.forEach((item) => {
    if (!item.data) return;
    Object.entries(getCurrentYearData(item.data)).forEach(([month, info]: any) => {
      if (!info?.payment_date) return;
      const [day, monthNumber, year] = String(info.payment_date).split("/").map(Number);
      if (!day || !monthNumber || !year) return;
      const paymentDate = new Date(year, monthNumber - 1, day, 23, 59, 59);
      if (paymentDate < today) return;
      const dividend = parseCurrency(info.earnings);
      payments.push({ ticker: item.ticker, quotas: item.quotas, date: info.payment_date, dateWith: info.date_with, amount: dividend * item.quotas, dividend, month });
    });
  });

  return payments.sort((a, b) => {
    const [dayA, monthA, yearA] = a.date.split("/").map(Number);
    const [dayB, monthB, yearB] = b.date.split("/").map(Number);
    return new Date(yearA, monthA - 1, dayA).getTime() - new Date(yearB, monthB - 1, dayB).getTime();
  });
}

function buildDividendHistory(items: EnrichedFii[], manualEntries: readonly ManualHistoryEntry[]): DividendHistory {
  const year = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth();
  const byTicker: Record<string, number> = {};
  const months = MONTHS.slice(0, currentMonthIndex + 1).map((month) => {
    const estimatedValue = items.reduce((acc, item) => {
      const earning = getYearData(item.data, year)?.[month]?.earnings;
      const amount = parseCurrency(earning) * item.quotas;
      if (amount > 0) byTicker[item.ticker] = (byTicker[item.ticker] || 0) + amount;
      return acc + amount;
    }, 0);
    const competence = `${year}-${String(MONTHS.indexOf(month) + 1).padStart(2, "0")}`;
    const manualValue = manualEntries.find((entry) => entry.competence === competence)?.dividends;
    const value = typeof manualValue === "number" ? manualValue : estimatedValue;
    return { month, label: MONTHS_SHORT_PTBR[month], value };
  });
  const visibleMonths = months.filter((item) => item.value > 0);
  const total = months.reduce((acc, item) => acc + item.value, 0);
  const average = visibleMonths.length ? total / visibleMonths.length : 0;
  const best = [...visibleMonths].sort((a, b) => b.value - a.value)[0] || null;
  const worst = [...visibleMonths].sort((a, b) => a.value - b.value)[0] || null;
  const topPayer = Object.entries(byTicker).sort((a, b) => b[1] - a[1]).map(([ticker, value]) => ({ ticker, value }))[0] || null;
  return { months, visibleMonths, total, average, best, worst, topPayer };
}

function buildCsv(items: LoadedFii[]) {
  const header = ["Ticker", "Movimento do dia", "Cotas", "Preco", "Ultimo rendimento", "Mes ultimo rendimento", "Renda estimada", "Rendimento mes atual", "Renda anunciada mes atual"];
  const rows = items.map((item) => {
    const lastDividend = getLastDividend(item.data);
    const currentDividend = getCurrentMonthDividend(item.data);
    const lastValue = parseCurrency(lastDividend?.info?.earnings);
    const currentValue = parseCurrency(currentDividend?.info?.earnings);
    return [
      item.ticker,
      item.data?.variation || "",
      String(item.quotas),
      item.data?.price || "",
      lastDividend?.info?.earnings || "",
      MONTHS_PTBR[lastDividend?.month || ""] || lastDividend?.month || "",
      formatCurrency(lastValue * item.quotas),
      currentDividend?.info?.earnings || "",
      formatCurrency(currentValue * item.quotas),
    ];
  });
  return [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
}

function toastVariant(message: string): "success" | "error" | "warning" | "info" {
  if (!message) return "info";
  const normalized = message.toLowerCase();
  if (normalized.includes("informe") || normalized.includes("erro") || normalized.includes("falha")) return "warning";
  if (normalized.includes("removido") || normalized.includes("atualizado") || normalized.includes("adicionado") || normalized.includes("sucesso")) return "success";
  return "info";
}

function readSnapshots(): WalletSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SNAPSHOT_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function snapshotSignature(items: WalletSnapshot[]) {
  return JSON.stringify(items.map((item) => ({ monthKey: item.monthKey, totalValue: item.totalValue, estimatedMonthlyIncome: item.estimatedMonthlyIncome })));
}

function normalizeManualHistory(entries: unknown): ManualHistoryEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry): entry is ManualHistoryEntry => Boolean(
      entry
      && typeof entry === "object"
      && typeof (entry as ManualHistoryEntry).competence === "string"
      && ((entry as ManualHistoryEntry).dividends === null || typeof (entry as ManualHistoryEntry).dividends === "number"),
    ))
    .sort((left, right) => left.competence.localeCompare(right.competence));
}

function readManualHistoryCache(): ManualHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return normalizeManualHistory(JSON.parse(window.localStorage.getItem(HISTORY_CACHE_KEY) || "[]"));
  } catch {
    return [];
  }
}

function entryTimestamp(entry: ManualHistoryEntry) {
  const timestamp = Date.parse(entry.updatedAt || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function reconcileManualHistory(localEntries: readonly ManualHistoryEntry[], remoteEntries: readonly ManualHistoryEntry[]) {
  const merged = new Map<string, ManualHistoryEntry>();
  remoteEntries.forEach((entry) => merged.set(entry.competence, entry));
  localEntries.forEach((local) => {
    const remote = merged.get(local.competence);
    if (!remote || entryTimestamp(local) >= entryTimestamp(remote)) merged.set(local.competence, local);
  });
  return [...merged.values()].sort((left, right) => left.competence.localeCompare(right.competence));
}

function buildHistoricalDividendStats(snapshots: readonly WalletSnapshot[]): HistoricalDividendStats {
  const currentYear = new Date().getFullYear();
  const paid = snapshots.filter((snapshot) => snapshot.estimatedMonthlyIncome > 0);
  const currentYearItems = paid.filter((snapshot) => getSnapshotYear(snapshot) === currentYear);
  const byValueDescending = (items: readonly WalletSnapshot[]) => [...items].sort((a, b) => b.estimatedMonthlyIncome - a.estimatedMonthlyIncome);
  const currentYearSorted = byValueDescending(currentYearItems);
  const allTimeSorted = byValueDescending(paid);
  const totalsByYear = paid.reduce((acc, snapshot) => {
    const year = getSnapshotYear(snapshot);
    acc.set(year, (acc.get(year) || 0) + snapshot.estimatedMonthlyIncome);
    return acc;
  }, new Map<number, number>());
  const bestYearEntry = [...totalsByYear.entries()].sort((a, b) => b[1] - a[1])[0];
  const currentYearTotal = currentYearItems.reduce((sum, snapshot) => sum + snapshot.estimatedMonthlyIncome, 0);
  return {
    currentYear,
    currentYearTotal,
    currentYearAverage: currentYearItems.length ? currentYearTotal / currentYearItems.length : 0,
    currentYearBest: currentYearSorted[0] || null,
    currentYearWorst: currentYearSorted.at(-1) || null,
    allTimeBest: allTimeSorted[0] || null,
    allTimeWorst: allTimeSorted.at(-1) || null,
    bestYear: bestYearEntry ? { year: bestYearEntry[0], total: bestYearEntry[1] } : null,
  };
}

export default function WalletPage() {
  const [ticker, setTicker] = useState("");
  const [quotas, setQuotas] = useState("");
  const [items, setItems] = useState<WalletItem[]>([]);
  const [loaded, setLoaded] = useState<LoadedFii[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [editingQuotas, setEditingQuotas] = useState<Record<string, string>>({});
  const [snapshots, setSnapshots] = useState<WalletSnapshot[]>([]);
  const [manualHistory, setManualHistory] = useState<readonly ManualHistoryEntry[]>([]);
  const quotasInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    setSnapshots(readSnapshots());
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) setItems(parsed);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const applyEntries = (entries: unknown) => {
      const normalized = normalizeManualHistory(entries);
      setManualHistory((current) => reconcileManualHistory(current, normalized));
    };

    applyEntries(readManualHistoryCache());

    const loadHistory = async () => {
      const email = window.localStorage.getItem(EMAIL_KEY)?.trim().toLowerCase();
      const token = window.localStorage.getItem(TOKEN_KEY);
      if (!email || !token) {
        setManualHistory([]);
        return;
      }
      try {
        const response = await fetch("/api/portfolio/history?portfolioId=default", {
          headers: { "x-wallet-email": email, "x-wallet-session": token },
        });
        const json = await response.json();
        if (response.ok && json?.ok) {
          const serverEntries = normalizeManualHistory(json.entries);
          setManualHistory(reconcileManualHistory(readManualHistoryCache(), serverEntries));
        }
      } catch {
        // O painel do histórico exibe o erro. A carteira permanece utilizável.
      }
    };

    const onHistory = (event: Event) => {
      const detail = (event as CustomEvent<{ entries?: unknown }>).detail;
      applyEntries(detail?.entries);
    };
    const onSession = () => void loadHistory();

    window.addEventListener(HISTORY_UPDATED_EVENT, onHistory);
    window.addEventListener("dados-fii-wallet-session-updated", onSession);
    void loadHistory();
    return () => {
      window.removeEventListener(HISTORY_UPDATED_EVENT, onHistory);
      window.removeEventListener("dados-fii-wallet-session-updated", onSession);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    setEditingQuotas((current) => {
      const next: Record<string, string> = {};
      items.forEach((item) => { next[item.ticker] = current[item.ticker] ?? String(item.quotas); });
      return next;
    });
  }, [items]);

  useEffect(() => {
    async function loadWallet() {
      if (!items.length) {
        setLoaded([]);
        return;
      }
      setLoading(true);
      try {
        const response = await fetch("/api/fii/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tickers: items.map((item) => item.ticker) }),
        });
        const json = await response.json();
        if (!response.ok || !json?.ok) {
          setLoaded(items.map((item) => ({ ...item, error: json?.error || "Erro ao buscar dados" })));
          return;
        }
        setLoaded(items.map((item) => {
          const data = json.items?.[item.ticker];
          if (!data) return { ...item, error: json.errors?.[item.ticker] || "FII não encontrado" };
          return { ...item, data };
        }));
      } catch {
        setLoaded(items.map((item) => ({ ...item, error: "Erro ao buscar dados" })));
      } finally {
        setLoading(false);
      }
    }

    loadWallet();
  }, [items]);

  const insights = useMemo<WalletInsights>(() => {
    const currentMonth = getCurrentMonthName();
    const enriched: EnrichedFii[] = loaded.map((item) => {
      const lastDividend = getLastDividend(item.data);
      const currentDividend = getCurrentMonthDividend(item.data);
      const lastValue = parseCurrency(lastDividend?.info?.earnings);
      const currentValue = parseCurrency(currentDividend?.info?.earnings);
      const price = parseCurrency(item.data?.price);
      const estimatedIncome = lastValue * item.quotas;
      const announcedIncome = currentValue * item.quotas;
      const currentValuePosition = price * item.quotas;
      const segment = getSegmentName(item.data);
      const dailyVariation = getDailyVariation(item.data);
      return { ...item, lastDividend, currentDividend, estimatedIncome, announcedIncome, currentValuePosition, segment, dailyVariation, waitingAnnouncement: Boolean(item.data) && !currentDividend };
    });
    const monthlyIncome = enriched.reduce((acc, item) => acc + item.estimatedIncome, 0);
    const announcedIncome = enriched.reduce((acc, item) => acc + item.announcedIncome, 0);
    const currentValue = enriched.reduce((acc, item) => acc + item.currentValuePosition, 0);
    const waiting = enriched.filter((item) => item.waitingAnnouncement);
    const topIncome = [...enriched].sort((a, b) => b.estimatedIncome - a.estimatedIncome).slice(0, 3);
    const topWeight = [...enriched].sort((a, b) => b.currentValuePosition - a.currentValuePosition).slice(0, 3);
    const assetWeights = topWeight.map((item) => ({ label: item.ticker, value: item.currentValuePosition, detail: currentValue ? formatPercentValue((item.currentValuePosition / currentValue) * 100) : "0,0%" }));
    const segmentValueTotals = enriched.reduce((acc: Record<string, number>, item) => {
      acc[item.segment] = (acc[item.segment] || 0) + item.currentValuePosition;
      return acc;
    }, {});
    const segmentWeights = Object.entries(segmentValueTotals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([segment, value]) => ({ label: segment, value, detail: currentValue ? formatPercentValue((value / currentValue) * 100) : "0,0%" }));
    const segmentBase = segmentWeights.reduce((acc, item) => acc + item.value, 0);
    const segmentBreakdown = segmentWeights.slice(0, 3).map((item) => ({ ticker: item.label, value: segmentBase > 0 ? formatPercentValue((item.value / segmentBase) * 100) : "0,0%" }));
    const incomeByFii = topIncome.map((item) => ({ label: item.ticker, value: item.estimatedIncome, detail: monthlyIncome ? formatPercentValue((item.estimatedIncome / monthlyIncome) * 100) : "0,0%" }));
    const dividendHistory = buildDividendHistory(enriched, manualHistory);
    return { currentMonth, enriched, monthlyIncome, announcedIncome, currentValue, pendingIncome: Math.max(monthlyIncome - announcedIncome, 0), waiting, topIncome, topWeight, segmentBreakdown, mainSegment: segmentBreakdown[0], assetWeights, segmentWeights, incomeByFii, dividendHistory };
  }, [loaded, manualHistory]);

  useEffect(() => {
    if (loading || !items.length || insights.currentValue <= 0) return;
    const now = new Date();
    const key = monthKey(now);
    const label = monthLabelFromKey(key);

    setSnapshots((currentSnapshots) => {
      const current = currentSnapshots.find((item) => item.monthKey === key);
      const nextSnapshot: WalletSnapshot = {
        monthKey: key,
        label,
        totalValue: insights.currentValue,
        estimatedMonthlyIncome: insights.monthlyIncome,
        announcedMonthlyIncome: insights.announcedIncome,
        walletCount: items.length,
        topWeightTicker: insights.topWeight[0]?.ticker,
        topIncomeTicker: insights.topIncome[0]?.ticker,
        createdAt: current?.createdAt || now.toISOString(),
        updatedAt: now.toISOString(),
      };
      const next = [...currentSnapshots.filter((item) => item.monthKey !== key), nextSnapshot].sort((a, b) => a.monthKey.localeCompare(b.monthKey)).slice(-60);
      if (snapshotSignature(next) === snapshotSignature(currentSnapshots)) return currentSnapshots;
      try {
        window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next));
      } catch {
        return currentSnapshots;
      }
      return next;
    });
  }, [loading, items.length, insights.currentValue, insights.monthlyIncome, insights.announcedIncome, insights.topIncome, insights.topWeight]);

  const upcomingPayments = useMemo(() => getUpcomingPayments(loaded), [loaded]);
  const displayedUpcomingPayments = upcomingPayments.slice(0, 12);
  const shouldScrollUpcomingPayments = displayedUpcomingPayments.length > 4;
  const firstPayment = upcomingPayments[0];
  const topIncome = insights.topIncome[0];
  const topWeight = insights.topWeight[0];
  const topWeightPercent = insights.currentValue && topWeight ? (topWeight.currentValuePosition / insights.currentValue) * 100 : 0;
  const consolidatedSnapshots = useMemo(() => {
    const byCompetence = new Map(snapshots.map((snapshot) => [snapshot.monthKey, snapshot]));
    manualHistory.forEach((entry) => {
      if (typeof entry.dividends !== "number") return;
      const current = byCompetence.get(entry.competence);
      byCompetence.set(entry.competence, {
        monthKey: entry.competence,
        label: monthLabelFromKey(entry.competence),
        totalValue: current?.totalValue ?? 0,
        estimatedMonthlyIncome: entry.dividends,
        announcedMonthlyIncome: entry.dividends,
        walletCount: current?.walletCount ?? items.length,
        topWeightTicker: current?.topWeightTicker,
        topIncomeTicker: current?.topIncomeTicker,
        createdAt: current?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });
    return [...byCompetence.values()].sort((left, right) => left.monthKey.localeCompare(right.monthKey));
  }, [snapshots, manualHistory, items.length]);
  const historicalDividendStats = useMemo(
    () => buildHistoricalDividendStats(consolidatedSnapshots),
    [consolidatedSnapshots],
  );

  function addItem() {
    const code = ticker.trim().toUpperCase();
    const totalQuotas = Number(quotas.replace(",", "."));
    if (!code || !Number.isFinite(totalQuotas) || totalQuotas <= 0) {
      setMessage("Informe um ticker e uma quantidade de cotas válida.");
      return;
    }
    let existed = false;
    setItems((current) => {
      const existing = current.find((item) => item.ticker === code);
      existed = Boolean(existing);
      if (existing) return current.map((item) => item.ticker === code ? { ...item, quotas: totalQuotas } : item);
      return [...current, { ticker: code, quotas: totalQuotas }].sort((a, b) => a.ticker.localeCompare(b.ticker));
    });
    setTicker("");
    setQuotas("");
    setMessage(existed ? `${code} atualizado para ${totalQuotas} cotas.` : `${code} adicionado à carteira.`);
  }

  function updateQuotas(code: string) {
    const totalQuotas = Number(String(editingQuotas[code] || "").replace(",", "."));
    if (!Number.isFinite(totalQuotas) || totalQuotas <= 0) {
      setMessage("Informe uma quantidade de cotas válida para salvar.");
      return;
    }
    setItems((current) => current.map((item) => item.ticker === code ? { ...item, quotas: totalQuotas } : item));
    setMessage(`${code} atualizado para ${totalQuotas} cotas.`);
  }

  function removeItem(code: string) {
    setItems((current) => current.filter((item) => item.ticker !== code));
    setEditingQuotas((current) => {
      const next = { ...current };
      delete next[code];
      return next;
    });
    setMessage(`${code} removido da carteira.`);
  }

  function exportCsv() {
    const csv = buildCsv(loaded);
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "minha-carteira-fiis.csv";
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Carteira exportada em CSV.");
  }

  return (
    <main className="mx-auto w-full max-w-6xl overflow-x-hidden px-4 py-8">
      <AppToast message={message} variant={toastVariant(message)} onClose={() => setMessage("")} />
      <PageHeader
        title="Minha Carteira"
        subtitle="Acompanhe sua carteira de FIIs, renda mensal, próximos pagamentos e evolução patrimonial."
        action={<Link href="/calendario-dividendos-fiis" className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">Calendário público</Link>}
      />

      <WalletEmailVerifiedSync />
      <PortfolioNotificationPreferences />
      <DailyWalletPanel insights={insights} firstPayment={firstPayment} />
      <WalletRiskReportCard walletCount={items.length} />
      <AttentionSection insights={insights} />
      <VisualHistorySection snapshots={consolidatedSnapshots} />
      <PortfolioCharts assetWeights={insights.assetWeights} incomeByFii={insights.incomeByFii} segmentWeights={insights.segmentWeights} />
      <SimpleMonthlySummary insights={insights} historicalStats={historicalDividendStats} topWeight={topWeight} topWeightPercent={topWeightPercent} />
      <WalletEditorSection ticker={ticker} setTicker={setTicker} quotas={quotas} setQuotas={setQuotas} quotasInputRef={quotasInputRef} addItem={addItem} exportCsv={exportCsv} canExport={loaded.length > 0} />
      <WalletTable items={items} insights={insights} loading={loading} editingQuotas={editingQuotas} setEditingQuotas={setEditingQuotas} upcomingPayments={upcomingPayments} updateQuotas={updateQuotas} removeItem={removeItem} />
      <UpcomingPaymentsSection payments={displayedUpcomingPayments} shouldScroll={shouldScrollUpcomingPayments} />
      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <RankingCard title="Maior renda estimada" items={insights.topIncome.map((item) => ({ ticker: item.ticker, value: formatCurrency(item.estimatedIncome) }))} />
        <RankingCard title="Maior peso financeiro" items={insights.topWeight.map((item) => ({ ticker: item.ticker, value: formatCurrency(item.currentValuePosition) }))} />
        <RankingCard title="Distribuição por segmento" items={insights.segmentBreakdown} />
      </section>
    </main>
  );
}

function DailyWalletPanel({ insights, firstPayment }: { insights: WalletInsights; firstPayment?: Payment }) {
  const strongestMoves = insights.enriched.filter((item) => Math.abs(item.dailyVariation) >= 0.005).sort((a, b) => Math.abs(b.dailyVariation) - Math.abs(a.dailyVariation)).slice(0, 3);

  return (
    <section className="overflow-hidden rounded-3xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
      <div className="flex min-w-0 flex-col justify-between gap-3 md:flex-row md:items-end">
        <div className="min-w-0">
          <p className="inline-flex rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-200">Hoje na sua carteira</p>
          <h2 className="mt-3 text-2xl font-black text-white">Painel diário dos seus FIIs</h2>
          <p className="mt-2 text-sm leading-6 text-gray-300">Resumo rápido para saber valor, renda, pagamentos e pendências.</p>
        </div>
        {strongestMoves.length > 0 && (
          <div className="min-w-0 rounded-2xl bg-gray-800 p-3 ring-1 ring-white/10">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Maiores movimentos hoje</p>
            <div className="mt-2 flex min-w-0 flex-wrap gap-2">
              {strongestMoves.map((item) => <DailyVariationBadge key={item.ticker} value={item.dailyVariation} labelPrefix={item.ticker} />)}
            </div>
          </div>
        )}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <DarkMetric label="Carteira hoje" value={formatCurrency(insights.currentValue)} detail={`${insights.enriched.length} FII(s) cadastrados`} tone="indigo" />
        <DarkMetric label="Renda prevista" value={formatCurrency(insights.monthlyIncome)} detail="Baseada no último rendimento disponível" tone="green" />
        <DarkMetric label="Renda anunciada" value={formatCurrency(insights.announcedIncome)} detail={`Para ${MONTHS_PTBR[insights.currentMonth]}`} tone="indigo" />
        <DarkMetric label="Próximo pagamento" value={firstPayment ? formatCurrency(firstPayment.amount) : "-"} detail={firstPayment ? `${firstPayment.ticker} em ${firstPayment.date}` : "Nenhum pagamento futuro"} tone="green" />
        <DarkMetric label="Pendências" value={String(insights.waiting.length)} detail={insights.waiting.length ? "FIIs aguardando comunicado" : "Tudo certo no mês"} tone={insights.waiting.length ? "yellow" : "indigo"} />
      </div>
    </section>
  );
}

function AttentionSection({ insights }: { insights: WalletInsights }) {
  const hasWaiting = insights.waiting.length > 0;
  return (
    <section className={`mt-6 rounded-2xl p-5 shadow-sm ring-1 ${hasWaiting ? "bg-yellow-50 text-yellow-950 ring-yellow-200" : "bg-white text-slate-800 ring-slate-200"}`}>
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold"><AlertTriangle size={20} className={hasWaiting ? "text-yellow-600" : "text-indigo-600"} /> Atenção da carteira</h2>
          <p className={`mt-2 text-sm font-medium leading-6 ${hasWaiting ? "text-yellow-800" : "text-slate-600"}`}>
            {hasWaiting ? `${insights.waiting.length} FII(s) ainda não têm rendimento de ${MONTHS_PTBR[insights.currentMonth]} na base. Estimativa pendente: ${formatCurrency(insights.pendingIncome)}.` : `Tudo certo: todos os FIIs carregados já têm rendimento de ${MONTHS_PTBR[insights.currentMonth]} na base.`}
          </p>
          {hasWaiting && <p className="mt-2 text-sm font-extrabold text-yellow-900">{insights.waiting.map((item) => item.ticker).join(", ")}</p>}
        </div>
        {hasWaiting && <p className="rounded-lg bg-yellow-100 px-4 py-2 text-sm font-bold text-yellow-900">A atualização é automática após a publicação do comunicado oficial.</p>}
      </div>
    </section>
  );
}

function SimpleMonthlySummary({ insights, historicalStats, topWeight, topWeightPercent }: { insights: WalletInsights; historicalStats: HistoricalDividendStats; topWeight?: EnrichedFii; topWeightPercent: number }) {
  const history = insights.dividendHistory;
  return (
    <section className="mt-6 rounded-2xl bg-white p-5 text-slate-800 shadow-sm ring-1 ring-slate-200">
      <div>
        <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-700"><BarChart3 size={14} /> Resumo</p>
        <h2 className="mt-3 text-xl font-black text-slate-900">Leitura rápida dos números</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Meses informados manualmente substituem a estimativa calculada com as cotas atuais.</p>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <LightMetric label={`Maior mês de ${historicalStats.currentYear}`} value={historicalStats.currentYearBest ? `${getSnapshotMonthLabel(historicalStats.currentYearBest)}: ${formatCurrency(historicalStats.currentYearBest.estimatedMonthlyIncome)}` : "-"} />
        <LightMetric label={`Menor mês de ${historicalStats.currentYear}`} value={historicalStats.currentYearWorst ? `${getSnapshotMonthLabel(historicalStats.currentYearWorst)}: ${formatCurrency(historicalStats.currentYearWorst.estimatedMonthlyIncome)}` : "-"} />
        <LightMetric label={`Total em ${historicalStats.currentYear}`} value={formatCurrency(historicalStats.currentYearTotal)} />
        <LightMetric label={`Média mensal em ${historicalStats.currentYear}`} value={formatCurrency(historicalStats.currentYearAverage)} />
        <LightMetric label="Maior mês do histórico" value={historicalStats.allTimeBest ? `${historicalStats.allTimeBest.label}: ${formatCurrency(historicalStats.allTimeBest.estimatedMonthlyIncome)}` : "-"} />
        <LightMetric label="Menor mês do histórico" value={historicalStats.allTimeWorst ? `${historicalStats.allTimeWorst.label}: ${formatCurrency(historicalStats.allTimeWorst.estimatedMonthlyIncome)}` : "-"} />
        <LightMetric label="Maior ano de dividendos" value={historicalStats.bestYear ? `${historicalStats.bestYear.year}: ${formatCurrency(historicalStats.bestYear.total)}` : "-"} />
        <LightMetric label="Maior pagador estimado" value={history.topPayer ? `${history.topPayer.ticker}: ${formatCurrency(history.topPayer.value)}` : "-"} />
        <LightMetric label="Maior peso financeiro" value={topWeight ? `${topWeight.ticker}: ${formatPercentValue(topWeightPercent)}` : "-"} />
      </div>
    </section>
  );
}

function VisualHistorySection({ snapshots }: { snapshots: WalletSnapshot[] }) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const years = getHistoryYears();
  const yearSnapshots = snapshots.filter((item) => getSnapshotYear(item) === selectedYear).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  const patrimonySnapshots = yearSnapshots.filter((item) => item.totalValue > 0);
  const dividendSnapshots = yearSnapshots.filter((item) => item.estimatedMonthlyIncome > 0);

  return (
    <section className="mt-6 min-w-0 overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex min-w-0 flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-700"><LineChart size={14} /> Evolução</p>
          <h2 className="mt-3 text-xl font-black text-slate-900">Patrimônio e dividendos por ano</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Dividendos manuais usam o valor efetivamente recebido. O patrimônio permanece restrito aos snapshots automáticos.</p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          {years.map((year) => {
            const hasData = snapshots.some((item) => getSnapshotYear(item) === year && (item.totalValue > 0 || item.estimatedMonthlyIncome > 0));
            return <button key={year} type="button" onClick={() => setSelectedYear(year)} className={`rounded-full px-3 py-1.5 text-xs font-extrabold ring-1 ${selectedYear === year ? "bg-indigo-600 text-white ring-indigo-600" : hasData ? "bg-white text-slate-700 ring-slate-300 hover:bg-indigo-50" : "bg-slate-50 text-slate-600 ring-slate-300 hover:bg-slate-100"}`}>{year}</button>;
          })}
        </div>
      </div>

      <div className="mt-5 grid min-w-0 gap-6 lg:grid-cols-2">
        <HistoryChartCard title={`Patrimônio estimado em ${selectedYear}`} subtitle="Valor total da carteira nos meses com snapshot automático.">
          <HistoryLineChart snapshots={patrimonySnapshots} getValue={(item) => item.totalValue} emptyText={`Nenhum patrimônio registrado em ${selectedYear} ainda.`} />
        </HistoryChartCard>
        <HistoryChartCard title={`Dividendos pagos em ${selectedYear}`} subtitle="Valor efetivamente informado por mês; na ausência, usa a estimativa disponível.">
          <HistoryLineChart snapshots={dividendSnapshots} getValue={(item) => item.estimatedMonthlyIncome} emptyText={`Nenhum pagamento registrado em ${selectedYear} ainda.`} />
        </HistoryChartCard>
      </div>
    </section>
  );
}

function PortfolioCharts({ assetWeights, incomeByFii, segmentWeights }: { assetWeights: ChartItem[]; incomeByFii: ChartItem[]; segmentWeights: ChartItem[] }) {
  return (
    <section className="mt-6 min-w-0 overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-700"><PieChart size={14} /> Composição</p>
      <h2 className="mt-3 text-xl font-black text-slate-900">Como a carteira está distribuída</h2>
      <div className="mt-5 grid min-w-0 gap-6 lg:grid-cols-3">
        <ChartCard title="Peso por ativo" subtitle="Valor financeiro estimado por FII."><BarList items={assetWeights} /></ChartCard>
        <ChartCard title="Renda por FII" subtitle="Renda mensal estimada por ativo."><BarList items={incomeByFii} /></ChartCard>
        <ChartCard title="Peso por segmento" subtitle="Distribuição financeira estimada."><BarList items={segmentWeights} /></ChartCard>
      </div>
    </section>
  );
}

function WalletEditorSection({ ticker, setTicker, quotas, setQuotas, quotasInputRef, addItem, exportCsv, canExport }: {
  ticker: string;
  setTicker: (value: string) => void;
  quotas: string;
  setQuotas: (value: string) => void;
  quotasInputRef: React.RefObject<HTMLInputElement | null>;
  addItem: () => void;
  exportCsv: () => void;
  canExport: boolean;
}) {
  return (
    <section className="mt-6 rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
      <h2 className="mb-4 text-xl font-extrabold text-white">Adicionar ou atualizar FII</h2>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
        <input aria-label="Ticker do fundo" autoComplete="off" value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); quotasInputRef.current?.focus(); } }} placeholder="Ticker, ex: ABCD11" className="rounded-lg border border-gray-700 bg-gray-800 p-3 text-white outline-none placeholder:text-gray-400 focus:border-indigo-400" />
        <input aria-label="Quantidade de cotas" ref={quotasInputRef} value={quotas} onChange={(event) => setQuotas(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addItem(); }} placeholder="Quantidade de cotas" inputMode="decimal" className="rounded-lg border border-gray-700 bg-gray-800 p-3 text-white outline-none placeholder:text-gray-400 focus:border-indigo-400" />
        <button type="button" onClick={addItem} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-700"><Plus size={18} /> Adicionar</button>
        <button type="button" onClick={exportCsv} disabled={!canExport} className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-800 px-5 py-3 font-bold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500"><Download size={18} /> Exportar CSV</button>
      </div>
    </section>
  );
}

function WalletTable({ items, insights, loading, editingQuotas, setEditingQuotas, upcomingPayments, updateQuotas, removeItem }: {
  items: WalletItem[];
  insights: WalletInsights;
  loading: boolean;
  editingQuotas: Record<string, string>;
  setEditingQuotas: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  upcomingPayments: Payment[];
  updateQuotas: (code: string) => void;
  removeItem: (code: string) => void;
}) {
  return (
    <section className="mt-6 rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-white">FIIs na carteira</h2>
        {loading && <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-300"><Loader2 className="animate-spin" size={16} /> Atualizando...</span>}
      </div>
      {!items.length ? (
        <p className="rounded-xl border border-dashed border-gray-700 p-6 text-center text-sm font-medium text-gray-300">Sua carteira ainda está vazia. Comece adicionando um ticker e a quantidade de cotas.</p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {insights.enriched.map((item) => {
              const nextPayment = upcomingPayments.find((payment) => payment.ticker === item.ticker);
              const draftQuotas = editingQuotas[item.ticker] ?? String(item.quotas);
              const changed = Number(String(draftQuotas).replace(",", ".")) !== item.quotas;
              return <WalletMobileCard key={`mobile-${item.ticker}`} item={item} nextPayment={nextPayment} draftQuotas={draftQuotas} changed={changed} onQuotaChange={(value) => setEditingQuotas((current) => ({ ...current, [item.ticker]: value }))} onSave={() => updateQuotas(item.ticker)} onRemove={() => removeItem(item.ticker)} />;
            })}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[940px] text-left text-sm">
              <thead className="text-gray-300"><tr className="border-b border-gray-800"><th className="py-3 font-bold">FII</th><th className="font-bold">Cotas</th><th className="font-bold">Preço</th><th className="font-bold">Último rendimento</th><th className="font-bold">Anunciado no mês</th><th className="font-bold">Renda estimada</th><th className="font-bold">Próximo pagamento</th><th></th></tr></thead>
              <tbody>
                {insights.enriched.map((item) => {
                  const nextPayment = upcomingPayments.find((payment) => payment.ticker === item.ticker);
                  const draftQuotas = editingQuotas[item.ticker] ?? String(item.quotas);
                  const changed = Number(String(draftQuotas).replace(",", ".")) !== item.quotas;
                  return (
                    <tr key={item.ticker} className="border-b border-gray-800 text-gray-100">
                      <td className="py-3 font-bold"><div className="flex items-center gap-2"><FiiTickerLink ticker={item.ticker} /><DailyVariationBadge value={item.dailyVariation} /></div></td>
                      <td><div className="flex items-center gap-2"><input aria-label={`Quantidade de cotas de ${item.ticker}`} value={draftQuotas} onChange={(event) => setEditingQuotas((current) => ({ ...current, [item.ticker]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") updateQuotas(item.ticker); }} inputMode="decimal" className="w-24 rounded-lg border border-gray-700 bg-gray-950 p-2 text-white outline-none focus:border-indigo-400" /><button type="button" onClick={() => updateQuotas(item.ticker)} disabled={!changed} className={`rounded-lg p-2 ${changed ? "text-green-300 hover:bg-green-950/40" : "cursor-not-allowed text-gray-600"}`} title="Salvar cotas"><Save size={17} /></button></div></td>
                      <td className="font-medium text-gray-200">{item.data?.price || "-"}</td>
                      <td className="font-medium text-gray-200">{item.lastDividend ? `${MONTHS_PTBR[item.lastDividend.month] || item.lastDividend.month}: ${item.lastDividend.info.earnings}` : item.error || "-"}</td>
                      <td className="font-medium text-gray-200">{item.currentDividend ? item.currentDividend.info.earnings : "Aguardando"}</td>
                      <td className="font-bold text-green-300">{formatCurrency(item.estimatedIncome)}</td>
                      <td className="font-medium text-gray-200">{formatPaymentSummary(nextPayment)}</td>
                      <td className="text-right"><button type="button" onClick={() => removeItem(item.ticker)} className="rounded-lg p-2 text-red-300 hover:bg-red-950/40" title={`Remover ${item.ticker}`}><Trash2 size={18} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function UpcomingPaymentsSection({ payments, shouldScroll }: { payments: Payment[]; shouldScroll: boolean }) {
  return (
    <section className="mt-6 rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-extrabold text-white"><CalendarDays className="text-green-300" /> Próximos pagamentos</h2>
      {!payments.length ? <p className="text-sm font-medium text-gray-300">Ainda não há pagamentos futuros identificados para os FIIs da sua carteira.</p> : <ul className={`${shouldScroll ? "max-h-[520px] overflow-y-auto pr-2" : ""} space-y-3`}>{payments.map((payment) => <li key={`${payment.ticker}-${payment.date}-${payment.month}`} className="flex flex-col justify-between gap-1 rounded-xl bg-gray-800 p-4 md:flex-row md:items-center"><div><FiiTickerLink ticker={payment.ticker} /><span className="ml-2 text-sm font-medium text-gray-300">Pagamento em {payment.date}</span></div><strong className="text-green-300">{formatCurrency(payment.amount)}</strong></li>)}</ul>}
    </section>
  );
}

function DarkMetric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "green" | "indigo" | "yellow" }) {
  const valueClass = tone === "green" ? "text-green-300" : tone === "yellow" ? "text-yellow-300" : "text-indigo-300";
  return <div className="rounded-2xl bg-gray-800 p-4 ring-1 ring-white/10"><p className="text-xs font-extrabold uppercase tracking-wide text-gray-400">{label}</p><strong className={`mt-2 block text-2xl ${valueClass}`}>{value}</strong><p className="mt-2 text-xs font-medium leading-5 text-gray-300">{detail}</p></div>;
}

function LightMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-sm font-black text-slate-900">{value}</p></div>;
}

function HistoryChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <article className="min-w-0 overflow-hidden rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><h3 className="text-base font-black text-slate-900">{title}</h3><p className="mt-1 text-xs font-medium leading-5 text-slate-500">{subtitle}</p><div className="mt-4 min-w-0">{children}</div></article>;
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <article className="min-w-0 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><h3 className="text-base font-black text-slate-900">{title}</h3><p className="mt-1 text-xs font-medium leading-5 text-slate-500">{subtitle}</p><div className="mt-4">{children}</div></article>;
}

function BarList({ items, emptyText = "Sem dados suficientes para exibir." }: { items: ChartItem[]; emptyText?: string }) {
  const filtered = items.filter((item) => item.value > 0);
  const max = Math.max(...filtered.map((item) => item.value), 1);
  if (!filtered.length) return <p className="rounded-xl bg-white p-4 text-sm font-bold text-slate-500 ring-1 ring-slate-200">{emptyText}</p>;
  return <div className="space-y-3">{filtered.map((item) => <div key={item.label}><div className="mb-1 flex items-center justify-between gap-3 text-xs font-bold"><span className="truncate text-slate-700">{item.label}</span><span className="shrink-0 text-slate-500">{item.detail || formatCurrency(item.value)}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max((item.value / max) * 100, 3)}%` }} /></div></div>)}</div>;
}

function HistoryLineChart({ snapshots, getValue, emptyText }: { snapshots: WalletSnapshot[]; getValue: (item: WalletSnapshot) => number; emptyText: string }) {
  const points = snapshots.map(getValue).filter((value) => value > 0);
  if (!snapshots.length || !points.length) return <div className="rounded-2xl bg-white p-4 text-sm leading-6 text-slate-600 ring-1 ring-slate-200">{emptyText}</div>;
  const min = Math.min(...points, 0);
  const max = Math.max(...points, 1);
  const range = max - min || 1;
  const width = Math.max(360, snapshots.length * 72);
  const coords = snapshots.map((item, index) => {
    const x = snapshots.length === 1 ? width / 2 : (index / (snapshots.length - 1)) * (width - 48) + 24;
    const y = 124 - ((getValue(item) - min) / range) * 86 + 24;
    return `${x},${y}`;
  }).join(" ");
  return (
    <div role="region" aria-label="Gráfico histórico com rolagem horizontal" tabIndex={0} className="max-w-full overflow-x-auto focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
      <svg viewBox={`0 0 ${width} 180`} className="h-56 min-w-full rounded-2xl bg-white ring-1 ring-slate-200" style={{ width }}>
        {snapshots.length > 1 && <polyline points={coords} fill="none" stroke="currentColor" strokeWidth="4" className="text-indigo-600" strokeLinecap="round" strokeLinejoin="round" />}
        {snapshots.map((item, index) => {
          const x = snapshots.length === 1 ? width / 2 : (index / (snapshots.length - 1)) * (width - 48) + 24;
          const y = 124 - ((getValue(item) - min) / range) * 86 + 24;
          const labelBelow = index % 2 === 1 || y < 44;
          const labelY = labelBelow ? y + 18 : y - 26;
          return <g key={item.monthKey}><circle cx={x} cy={y} r="4.5" className="fill-indigo-700" /><text x={x} y={labelY} textAnchor="middle" className="fill-slate-600 text-[9px] font-bold">{getSnapshotMonthLabel(item)}</text><text x={x} y={labelY + 11} textAnchor="middle" className="fill-slate-800 text-[9px] font-black">{formatCurrencyCompact(getValue(item))}</text></g>;
        })}
      </svg>
    </div>
  );
}

function FiiTickerLink({ ticker }: { ticker: string }) {
  return <Link href={`/fii/${ticker}`} className="font-bold text-indigo-200 hover:text-indigo-100">{ticker}</Link>;
}

function DailyVariationBadge({ value, labelPrefix }: { value?: number; labelPrefix?: string }) {
  const variation = Number(value || 0);
  if (!Number.isFinite(variation) || Math.abs(variation) < 0.005) return <span className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-2 py-0.5 text-xs font-extrabold text-gray-400 ring-1 ring-gray-700" title="Sem variação no dia"><Minus size={12} /> {labelPrefix ? `${labelPrefix} ` : ""}-</span>;
  const isUp = variation > 0;
  const Icon = isUp ? TrendingUp : TrendingDown;
  const label = `${Math.abs(variation).toFixed(2).replace(".", ",")}% ${isUp ? "alta" : "baixa"}`;
  return <span className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-extrabold ring-1 ${isUp ? "bg-green-950/40 text-green-300 ring-green-900/60" : "bg-red-950/40 text-red-300 ring-red-900/60"}`} title={`Movimento do dia: ${label}`}><Icon size={12} /> <span className="truncate">{labelPrefix ? `${labelPrefix} ` : ""}{label}</span></span>;
}

function WalletMobileCard({ item, nextPayment, draftQuotas, changed, onQuotaChange, onSave, onRemove }: { item: EnrichedFii; nextPayment?: Payment; draftQuotas: string; changed: boolean; onQuotaChange: (value: string) => void; onSave: () => void; onRemove: () => void }) {
  return <article className="rounded-2xl bg-gray-800 p-4 text-gray-100 ring-1 ring-white/10"><div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="flex flex-wrap items-center gap-2 text-xl font-extrabold"><FiiTickerLink ticker={item.ticker} /><DailyVariationBadge value={item.dailyVariation} /></h3><p className="mt-1 text-sm font-medium text-gray-300">{item.quotas} cotas</p></div><button type="button" onClick={onRemove} className="rounded-lg p-2 text-red-300 hover:bg-red-950/40" title={`Remover ${item.ticker}`}><Trash2 size={18} /></button></div><div className="grid gap-3"><InfoRow label="Preço atual" value={item.data?.price || "-"} /><InfoRow label="Último rendimento" value={item.lastDividend ? `${MONTHS_PTBR[item.lastDividend.month] || item.lastDividend.month}: ${item.lastDividend.info.earnings}` : item.error || "-"} /><InfoRow label="Anunciado no mês" value={item.currentDividend ? item.currentDividend.info.earnings : "Aguardando"} /><InfoRow label="Renda estimada" value={formatCurrency(item.estimatedIncome)} highlight="green" /><InfoRow label="Próximo pagamento" value={formatPaymentSummary(nextPayment)} /></div><div className="mt-4 grid grid-cols-[1fr_auto] gap-2"><input aria-label={`Quantidade de cotas de ${item.ticker}`} value={draftQuotas} onChange={(event) => onQuotaChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onSave(); }} inputMode="decimal" className="rounded-lg border border-gray-700 bg-gray-950 p-2 text-white outline-none focus:border-indigo-400" /><button type="button" onClick={onSave} disabled={!changed} className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 font-bold ${changed ? "bg-indigo-600 text-white hover:bg-indigo-700" : "cursor-not-allowed bg-gray-700 text-gray-400"}`}><Save size={16} /> Salvar</button></div></article>;
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: "green" }) {
  return <div className="rounded-xl bg-gray-900 p-3 ring-1 ring-white/5"><p className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</p><p className={`mt-1 text-sm font-bold ${highlight === "green" ? "text-green-300" : "text-gray-100"}`}>{value}</p></div>;
}

function RankingCard({ title, items }: { title: string; items: Array<{ ticker: string; value: string }> }) {
  const isSegmentDistribution = title.includes("Distribuição por segmento");
  return <div className="rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10"><h3 className="mb-3 text-base font-extrabold text-white">{title}</h3>{!items.length ? <p className="text-sm font-medium text-gray-300">Sem dados ainda.</p> : isSegmentDistribution ? <ol className="space-y-4 text-sm">{items.map((item, index) => <li key={`${title}-${item.ticker}`} className="rounded-lg bg-gray-800 px-3 py-3 text-gray-200"><div className="mb-2 flex items-center justify-between gap-3"><span className="font-medium"><strong className="text-gray-400">#{index + 1}</strong> {item.ticker}</span><strong className="text-indigo-200">{item.value}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-gray-700"><div className={`h-full rounded-full bg-indigo-400 ${getBarWidthClass(item.value)}`} /></div></li>)}</ol> : <ol className="space-y-2 text-sm">{items.map((item, index) => <li key={`${title}-${item.ticker}`} className="flex justify-between gap-3 rounded-lg bg-gray-800 px-3 py-2 text-gray-200"><span><strong className="text-gray-400">#{index + 1}</strong> <FiiTickerLink ticker={item.ticker} /></span><strong className="text-indigo-200">{item.value}</strong></li>)}</ol>}</div>;
}
