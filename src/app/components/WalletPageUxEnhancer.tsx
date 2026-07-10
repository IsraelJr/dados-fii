"use client";

import { useEffect } from "react";

const LAST_VISIT_KEY = "dados-fii-wallet-last-visit-v1";

type WalletVisitState = Record<string, string>;

function textOf(element: Element | null) {
  return element?.textContent?.replace(/\s+/g, " ").trim() || "";
}

function readDailyMetric(section: Element, label: string) {
  const cards = Array.from(section.querySelectorAll("div"));
  const card = cards.find((item) => textOf(item).startsWith(label));
  const value = textOf(card?.querySelector("strong") || null);
  return value || "-";
}

function findDailyPanel() {
  return Array.from(document.querySelectorAll("main section")).find((section) => {
    const text = textOf(section);
    return text.includes("Hoje na sua carteira") && text.includes("Painel diário dos seus FIIs");
  });
}

function buildCurrentState(section: Element): WalletVisitState {
  return {
    "Carteira hoje": readDailyMetric(section, "Carteira hoje"),
    "Renda prevista": readDailyMetric(section, "Renda prevista"),
    "Renda anunciada": readDailyMetric(section, "Renda anunciada"),
    "Pendências": readDailyMetric(section, "Pendências"),
  };
}

function insertVisitMessage(section: Element, current: WalletVisitState, previous: WalletVisitState | null) {
  const existing = document.getElementById("wallet-last-visit-change");
  if (existing) existing.remove();
  if (!previous) return;

  const changes = Object.entries(current)
    .filter(([key, value]) => previous[key] && previous[key] !== value)
    .map(([key, value]) => `${key}: ${previous[key]} → ${value}`);

  const box = document.createElement("div");
  box.id = "wallet-last-visit-change";
  box.className = "mt-4 rounded-2xl bg-gray-800/70 p-3 text-xs font-bold leading-5 text-gray-300 ring-1 ring-white/10";

  if (!changes.length) {
    box.textContent = "Desde sua última visita, não identificamos mudanças relevantes na carteira.";
  } else {
    const title = document.createElement("p");
    title.className = "mb-1 text-xs font-extrabold uppercase tracking-wide text-gray-400";
    title.textContent = "Desde sua última visita";
    const detail = document.createElement("p");
    detail.textContent = changes.slice(0, 3).join(" · ");
    box.appendChild(title);
    box.appendChild(detail);
  }

  const metricGrid = Array.from(section.querySelectorAll("div")).find((item) => textOf(item).includes("Carteira hoje") && textOf(item).includes("Renda prevista"));
  section.insertBefore(box, metricGrid || null);
}

export default function WalletPageUxEnhancer() {
  useEffect(() => {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const section = findDailyPanel();
      if (!section) {
        if (attempts > 20) window.clearInterval(timer);
        return;
      }

      const current = buildCurrentState(section);
      const hasRealData = Object.values(current).some((value) => value !== "-" && value !== "R$ 0,00" && value !== "0");
      if (!hasRealData && attempts <= 20) return;

      let previous: WalletVisitState | null = null;
      try {
        const stored = window.localStorage.getItem(LAST_VISIT_KEY);
        previous = stored ? JSON.parse(stored) : null;
      } catch {
        previous = null;
      }

      insertVisitMessage(section, current, previous);

      window.setTimeout(() => {
        try {
          window.localStorage.setItem(LAST_VISIT_KEY, JSON.stringify(current));
        } catch {
          return;
        }
      }, 1000);

      window.clearInterval(timer);
    }, 500);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <style jsx global>{`
      @media (max-width: 640px) {
        main section.rounded-3xl.bg-gray-900 {
          padding: 1rem !important;
        }

        main section.rounded-3xl.bg-gray-900 h2 {
          font-size: 1.25rem !important;
          line-height: 1.25 !important;
        }

        main section.rounded-3xl.bg-gray-900 strong {
          font-size: 1.2rem !important;
        }

        main svg.h-56 {
          height: 9rem !important;
        }

        main section.rounded-2xl.bg-gray-900 div[class*="md:hidden"] article > div.grid.gap-3 {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 0.5rem !important;
        }

        main section.rounded-2xl.bg-gray-900 div[class*="md:hidden"] article > div.grid.gap-3 > div {
          min-width: 0 !important;
          padding: 0.7rem !important;
        }

        main section.rounded-2xl.bg-gray-900 div[class*="md:hidden"] article > div.grid.gap-3 > div:nth-child(5) {
          grid-column: 1 / -1 !important;
        }

        main section.rounded-2xl.bg-gray-900 div[class*="md:hidden"] article > div.grid.gap-3 p:first-child {
          font-size: 0.66rem !important;
          line-height: 1rem !important;
        }

        main section.rounded-2xl.bg-gray-900 div[class*="md:hidden"] article > div.grid.gap-3 p:last-child {
          font-size: 0.8rem !important;
          line-height: 1.15rem !important;
          overflow-wrap: anywhere !important;
        }
      }
    `}</style>
  );
}
