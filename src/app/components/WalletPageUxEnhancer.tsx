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

function parseMoney(value: string) {
  const cleaned = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3})/g, "")
    .replace(",", ".");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function parseNumber(value: string) {
  const number = Number(value.replace(/[^\d-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function findDailyPanel() {
  return Array.from(document.querySelectorAll("main section")).find((section) => {
    const text = textOf(section);
    return text.includes("Hoje na sua carteira") && text.includes("Painel diário dos seus FIIs");
  });
}

function findAttentionSection() {
  return Array.from(document.querySelectorAll("main section")).find((section) => textOf(section).includes("Atenção da carteira"));
}

function findPaymentsSection() {
  return Array.from(document.querySelectorAll("main section")).find((section) => textOf(section).includes("Próximos pagamentos"));
}

function readPendingTickers() {
  const section = findAttentionSection();
  if (!section) return "";
  const text = textOf(section);
  if (!text.includes("aguardando comunicado") && !text.includes("ainda não têm rendimento")) return "";

  const candidates = Array.from(section.querySelectorAll("p"))
    .map((item) => textOf(item))
    .filter((item) => /[A-Z]{4}\d{2}/.test(item));

  return candidates[candidates.length - 1] || "";
}

function readNextPayment() {
  const section = findPaymentsSection();
  if (!section) return "";
  const firstItem = section.querySelector("li");
  return textOf(firstItem);
}

function buildCurrentState(section: Element): WalletVisitState {
  return {
    "Carteira hoje": readDailyMetric(section, "Carteira hoje"),
    "Renda prevista": readDailyMetric(section, "Renda prevista"),
    "Renda anunciada": readDailyMetric(section, "Renda anunciada"),
    "Pendências": readDailyMetric(section, "Pendências"),
    "Tickers pendentes": readPendingTickers(),
    "Próximo pagamento": readNextPayment(),
  };
}

function buildInsightPhrases(current: WalletVisitState, previous: WalletVisitState | null) {
  const phrases: string[] = [];

  if (previous) {
    const announcedDiff = parseMoney(current["Renda anunciada"]) - parseMoney(previous["Renda anunciada"] || "");
    if (Math.abs(announcedDiff) >= 0.01) {
      phrases.push(`Sua renda anunciada ${announcedDiff > 0 ? "subiu" : "caiu"} ${formatCurrency(Math.abs(announcedDiff))} desde a última visita.`);
    }

    const forecastDiff = parseMoney(current["Renda prevista"]) - parseMoney(previous["Renda prevista"] || "");
    if (Math.abs(forecastDiff) >= 0.01) {
      phrases.push(`Sua renda prevista ${forecastDiff > 0 ? "subiu" : "caiu"} ${formatCurrency(Math.abs(forecastDiff))}.`);
    }

    const valueDiff = parseMoney(current["Carteira hoje"]) - parseMoney(previous["Carteira hoje"] || "");
    if (Math.abs(valueDiff) >= 1) {
      phrases.push(`O valor da carteira ${valueDiff > 0 ? "aumentou" : "reduziu"} ${formatCurrency(Math.abs(valueDiff))}.`);
    }

    const pendingDiff = parseNumber(current["Pendências"]) - parseNumber(previous["Pendências"] || "0");
    if (pendingDiff !== 0) {
      phrases.push(pendingDiff < 0 ? `Você tem ${Math.abs(pendingDiff)} pendência(s) a menos do que na última visita.` : `Você tem ${pendingDiff} nova(s) pendência(s) para acompanhar.`);
    }
  }

  const pendingTickers = current["Tickers pendentes"];
  if (pendingTickers) {
    phrases.push(`${pendingTickers} ainda ${pendingTickers.includes(",") ? "estão" : "está"} pendente(s) neste mês.`);
  }

  const nextPayment = current["Próximo pagamento"];
  if (nextPayment && !nextPayment.includes("Ainda não há")) {
    phrases.push(`Próximo pagamento: ${nextPayment}.`);
  }

  if (!phrases.length) {
    phrases.push("Desde sua última visita, não identificamos mudanças relevantes na carteira.");
  }

  return phrases.slice(0, 3);
}

function insertVisitMessage(section: Element, current: WalletVisitState, previous: WalletVisitState | null) {
  const existing = document.getElementById("wallet-last-visit-change");
  if (existing) existing.remove();

  const phrases = buildInsightPhrases(current, previous);
  const box = document.createElement("div");
  box.id = "wallet-last-visit-change";
  box.className = "mt-4 rounded-2xl bg-gray-800/70 p-3 text-xs font-bold leading-5 text-gray-300 ring-1 ring-white/10";

  const title = document.createElement("p");
  title.className = "mb-1 text-xs font-extrabold uppercase tracking-wide text-gray-400";
  title.textContent = "Desde sua última visita";
  box.appendChild(title);

  const list = document.createElement("ul");
  list.className = "space-y-1";
  phrases.forEach((phrase) => {
    const item = document.createElement("li");
    item.textContent = phrase;
    list.appendChild(item);
  });
  box.appendChild(list);

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

        main section.rounded-2xl.bg-gray-900 div[class*="md:hidden"] article {
          padding: 0.85rem !important;
        }

        main section.rounded-2xl.bg-gray-900 div[class*="md:hidden"] article > div.grid.gap-3 {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 0.5rem !important;
        }

        main section.rounded-2xl.bg-gray-900 div[class*="md:hidden"] article > div.grid.gap-3 > div {
          min-width: 0 !important;
          padding: 0.65rem !important;
        }

        main section.rounded-2xl.bg-gray-900 div[class*="md:hidden"] article > div.grid.gap-3 > div:nth-child(5) {
          grid-column: 1 / -1 !important;
        }

        main section.rounded-2xl.bg-gray-900 div[class*="md:hidden"] article > div.grid.gap-3 p:first-child {
          font-size: 0.64rem !important;
          line-height: 0.95rem !important;
        }

        main section.rounded-2xl.bg-gray-900 div[class*="md:hidden"] article > div.grid.gap-3 p:last-child {
          font-size: 0.78rem !important;
          line-height: 1.1rem !important;
          overflow-wrap: anywhere !important;
        }
      }
    `}</style>
  );
}
