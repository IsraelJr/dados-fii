"use client";

import { useEffect } from "react";

const SNAPSHOT_KEY = "dados-fii-wallet-monthly-snapshots-v1";

const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type Snapshot = {
  monthKey: string;
  estimatedMonthlyIncome?: number;
  estimatedDividendIncome?: number;
};

type MonthPoint = {
  monthKey: string;
  income: number;
};

function textOf(element: Element | null) {
  return element?.textContent?.replace(/\s+/g, " ").trim() || "";
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatMonthYear(monthKey: string) {
  const [year, month] = monthKey.split("-");
  const monthIndex = Number(month) - 1;
  return `${MONTHS_PT[monthIndex] || month}/${year}`;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function readSnapshots(): MonthPoint[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SNAPSHOT_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item: Snapshot) => ({
        monthKey: String(item?.monthKey || ""),
        income: Number(item?.estimatedMonthlyIncome ?? item?.estimatedDividendIncome ?? 0),
      }))
      .filter((item: MonthPoint) => /^\d{4}-\d{2}$/.test(item.monthKey) && Number.isFinite(item.income) && item.income > 0)
      .sort((a: MonthPoint, b: MonthPoint) => a.monthKey.localeCompare(b.monthKey));
  } catch {
    return [];
  }
}

function findSummarySection() {
  return Array.from(document.querySelectorAll("main section")).find((section) => textOf(section).includes("Leitura rápida dos números"));
}

function makeCard(label: string, month: string, value: string, emphasis = false) {
  const card = document.createElement("div");
  card.className = "min-w-0 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 sm:p-4";

  const labelElement = document.createElement("p");
  labelElement.className = "text-[11px] font-extrabold uppercase tracking-wide text-slate-500 sm:text-xs";
  labelElement.textContent = label;

  const monthElement = document.createElement("p");
  monthElement.className = "mt-2 text-sm font-black text-slate-900 sm:text-base";
  monthElement.textContent = month;

  const valueElement = document.createElement("p");
  valueElement.className = emphasis
    ? "mt-1 text-sm font-extrabold text-indigo-700 sm:text-base"
    : "mt-1 text-sm font-extrabold text-slate-800 sm:text-base";
  valueElement.textContent = value;

  card.appendChild(labelElement);
  card.appendChild(monthElement);
  card.appendChild(valueElement);
  return card;
}

function getBestDividendYear(points: MonthPoint[]) {
  const byYear = new Map<string, number>();
  points.forEach((item) => {
    const year = item.monthKey.slice(0, 4);
    byYear.set(year, (byYear.get(year) || 0) + item.income);
  });
  return Array.from(byYear.entries())
    .map(([year, income]) => ({ year, income }))
    .sort((a, b) => b.income - a.income)[0] || null;
}

function replaceWalletCopies() {
  Array.from(document.querySelectorAll("td, p, span")).forEach((element) => {
    const text = textOf(element);
    if (text === "Sem pagamento futuro na base") {
      element.textContent = "Aguardando comunicado";
    }
    if (/^Total \d{4} até \d{2}\/\d{2}$/i.test(text)) {
      element.textContent = "Total do ano";
    }
  });
}

function applyHistoricalSummary() {
  const section = findSummarySection();
  if (!section) return false;

  const snapshots = readSnapshots();
  if (!snapshots.length) return false;

  const currentYear = new Date().getFullYear();
  const currentLimit = currentMonthKey();
  const currentYearPoints = snapshots.filter((item) => Number(item.monthKey.slice(0, 4)) === currentYear && item.monthKey <= currentLimit);

  const currentBest = [...currentYearPoints].sort((a, b) => b.income - a.income)[0] || null;
  const currentWorst = [...currentYearPoints].sort((a, b) => a.income - b.income)[0] || null;
  const historicalBest = [...snapshots].sort((a, b) => b.income - a.income)[0] || null;
  const historicalWorst = [...snapshots].sort((a, b) => a.income - b.income)[0] || null;
  const bestYear = getBestDividendYear(snapshots);
  const currentTotal = currentYearPoints.reduce((sum, item) => sum + item.income, 0);
  const currentAverage = currentYearPoints.length ? currentTotal / currentYearPoints.length : 0;

  const oldGrid = Array.from(section.querySelectorAll("div")).find((element) => {
    const text = textOf(element);
    return text.includes("Maior mês estimado") && text.includes("Menor mês estimado");
  });
  if (!oldGrid) return false;

  const oldCards = Array.from(oldGrid.children);
  const topPayerCard = oldCards.find((card) => textOf(card).includes("Maior pagador"));
  const topWeightCard = oldCards.find((card) => textOf(card).includes("Maior peso financeiro"));
  const topPayerValue = textOf(topPayerCard?.querySelector("p:last-child") || null) || "-";
  const topWeightValue = textOf(topWeightCard?.querySelector("p:last-child") || null) || "-";

  const container = document.createElement("div");
  container.id = "wallet-historical-summary";
  container.className = "mt-5";

  const extremesGrid = document.createElement("div");
  extremesGrid.className = "grid grid-cols-2 gap-3";
  extremesGrid.appendChild(makeCard(`Maior mês (${currentYear})`, currentBest ? formatMonthYear(currentBest.monthKey) : "-", currentBest ? formatCurrency(currentBest.income) : "-", true));
  extremesGrid.appendChild(makeCard(`Menor mês (${currentYear})`, currentWorst ? formatMonthYear(currentWorst.monthKey) : "-", currentWorst ? formatCurrency(currentWorst.income) : "-", true));
  extremesGrid.appendChild(makeCard("Maior da história", historicalBest ? formatMonthYear(historicalBest.monthKey) : "-", historicalBest ? formatCurrency(historicalBest.income) : "-", true));
  extremesGrid.appendChild(makeCard("Menor da história", historicalWorst ? formatMonthYear(historicalWorst.monthKey) : "-", historicalWorst ? formatCurrency(historicalWorst.income) : "-", true));

  const supportingGrid = document.createElement("div");
  supportingGrid.className = "mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5";
  supportingGrid.appendChild(makeCard("Maior ano de dividendos", bestYear ? bestYear.year : "-", bestYear ? formatCurrency(bestYear.income) : "-"));
  supportingGrid.appendChild(makeCard("Total do ano", String(currentYear), currentYearPoints.length ? formatCurrency(currentTotal) : "-"));
  supportingGrid.appendChild(makeCard(`Média mensal em ${currentYear}`, "", currentYearPoints.length ? formatCurrency(currentAverage) : "-"));
  supportingGrid.appendChild(makeCard("Maior pagador estimado hoje", "", topPayerValue));
  supportingGrid.appendChild(makeCard("Maior peso financeiro hoje", "", topWeightValue));

  container.appendChild(extremesGrid);
  container.appendChild(supportingGrid);

  const existing = document.getElementById("wallet-historical-summary");
  if (existing) existing.remove();
  oldGrid.replaceWith(container);

  const description = Array.from(section.querySelectorAll("p")).find((item) => textOf(item).includes("Resumo numérico e educativo"));
  if (description) {
    description.textContent = "Dividendos consolidados pelo histórico mensal da carteira, considerando apenas os meses já encerrados.";
  }

  return true;
}

export default function WalletHistoricalSummaryEnhancer() {
  useEffect(() => {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      replaceWalletCopies();
      const applied = applyHistoricalSummary();
      if (applied || attempts > 30) window.clearInterval(timer);
    }, 500);

    return () => window.clearInterval(timer);
  }, []);

  return null;
}
