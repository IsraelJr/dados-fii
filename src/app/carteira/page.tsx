'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Download, Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import PageHeader from "../components/PageHeader";

type WalletItem = {
  ticker: string;
  quotas: number;
};

type LoadedFii = WalletItem & {
  data?: any;
  error?: string;
};

type Payment = {
  ticker: string;
  quotas: number;
  date: string;
  dateWith?: string;
  amount: number;
  dividend: number;
  month: string;
};

const STORAGE_KEY = "dados-fii-wallet-v1";
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

function parseCurrency(value: unknown) {
  if (typeof value === "number") return value;
  return Number(
    String(value || "0")
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()
  ) || 0;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getCurrentMonthName() {
  return MONTHS[new Date().getMonth()];
}

function getCurrentYearData(data: any) {
  const year = new Date().getFullYear();
  return data?.[`earnings${year}`] || data?.[`earnings${year - 1}`] || {};
}

function getLastDividend(data: any) {
  const yearData = getCurrentYearData(data);
  const months = Object.keys(yearData).sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));
  const lastMonth = months[months.length - 1];
  if (!lastMonth) return null;
  return { month: lastMonth, info: yearData[lastMonth] };
}

function getCurrentMonthDividend(data: any) {
  const month = getCurrentMonthName();
  const yearData = getCurrentYearData(data);
  return yearData?.[month] ? { month, info: yearData[month] } : null;
}

function getSegmentName(data: any) {
  return data?.segment_new || data?.segment || "Sem segmento";
}

function percentToNumber(value: string) {
  return Number(String(value || "0").replace("%", "").replace(",", ".")) || 0;
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
    const yearData = getCurrentYearData(item.data);

    Object.entries(yearData).forEach(([month, info]: any) => {
      if (!info?.payment_date) return;
      const [day, monthNumber, year] = String(info.payment_date).split("/").map(Number);
      if (!day || !monthNumber || !year) return;

      const paymentDate = new Date(year, monthNumber - 1, day, 23, 59, 59);
      if (paymentDate < today) return;

      const dividend = parseCurrency(info.earnings);
      payments.push({
        ticker: item.ticker,
        quotas: item.quotas,
        date: info.payment_date,
        dateWith: info.date_with,
        amount: dividend * item.quotas,
        dividend,
        month,
      });
    });
  });

  return payments.sort((a, b) => {
    const [dayA, monthA, yearA] = a.date.split("/").map(Number);
    const [dayB, monthB, yearB] = b.date.split("/").map(Number);
    return new Date(yearA, monthA - 1, dayA).getTime() - new Date(yearB, monthB - 1, dayB).getTime();
  });
}

function buildCsv(items: LoadedFii[]) {
  const header = ["Ticker", "Cotas", "Preco", "Ultimo rendimento", "Mes ultimo rendimento", "Renda estimada", "Rendimento mes atual", "Renda anunciada mes atual"];
  const rows = items.map((item) => {
    const lastDividend = getLastDividend(item.data);
    const currentDividend = getCurrentMonthDividend(item.data);
    const lastValue = parseCurrency(lastDividend?.info?.earnings);
    const currentValue = parseCurrency(currentDividend?.info?.earnings);

    return [
      item.ticker,
      String(item.quotas),
      item.data?.price || "",
      lastDividend?.info?.earnings || "",
      MONTHS_PTBR[lastDividend?.month || ""] || lastDividend?.month || "",
      formatCurrency(lastValue * item.quotas),
      currentDividend?.info?.earnings || "",
      formatCurrency(currentValue * item.quotas),
    ];
  });

  return [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
}

export default function WalletPage() {
  const [ticker, setTicker] = useState("");
  const [quotas, setQuotas] = useState("");
  const [items, setItems] = useState<WalletItem[]>([]);
  const [loaded, setLoaded] = useState<LoadedFii[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [editingQuotas, setEditingQuotas] = useState<Record<string, string>>({});
  const [updatingMissing, setUpdatingMissing] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) setItems(parsed);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    setEditingQuotas((current) => {
      const next: Record<string, string> = {};
      items.forEach((item) => {
        next[item.ticker] = current[item.ticker] ?? String(item.quotas);
      });
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
      setMessage("");

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

        const result = items.map((item) => {
          const data = json.items?.[item.ticker];
          if (!data) return { ...item, error: json.errors?.[item.ticker] || "FII não encontrado" };
          return { ...item, data };
        });

        setLoaded(result);
      } catch {
        setLoaded(items.map((item) => ({ ...item, error: "Erro ao buscar dados" })));
      } finally {
        setLoading(false);
      }
    }

    loadWallet();
  }, [items]);

  const insights = useMemo(() => {
    const currentMonth = getCurrentMonthName();
    const enriched = loaded.map((item) => {
      const lastDividend = getLastDividend(item.data);
      const currentDividend = getCurrentMonthDividend(item.data);
      const lastValue = parseCurrency(lastDividend?.info?.earnings);
      const currentValue = parseCurrency(currentDividend?.info?.earnings);
      const price = parseCurrency(item.data?.price);
      const estimatedIncome = lastValue * item.quotas;
      const announcedIncome = currentValue * item.quotas;
      const currentValuePosition = price * item.quotas;
      const segment = getSegmentName(item.data);

      return {
        ...item,
        lastDividend,
        currentDividend,
        estimatedIncome,
        announcedIncome,
        currentValuePosition,
        segment,
        waitingAnnouncement: Boolean(item.data) && !currentDividend,
      };
    });

    const monthlyIncome = enriched.reduce((acc, item) => acc + item.estimatedIncome, 0);
    const announcedIncome = enriched.reduce((acc, item) => acc + item.announcedIncome, 0);
    const currentValue = enriched.reduce((acc, item) => acc + item.currentValuePosition, 0);
    const waiting = enriched.filter((item) => item.waitingAnnouncement);
    const segmentTotals = enriched.reduce((acc: Record<string, number>, item) => {
      acc[item.segment] = (acc[item.segment] || 0) + item.quotas;
      return acc;
    }, {});
    const segmentBase = Object.values(segmentTotals).reduce((acc, value) => acc + value, 0);
    const segmentBreakdown = Object.entries(segmentTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([segment, value]) => ({ ticker: segment, value: `${segmentBase > 0 ? ((value / segmentBase) * 100).toFixed(1).replace(".", ",") : "0,0"}%` }));
    const mainSegment = segmentBreakdown[0];

    return {
      currentMonth,
      enriched,
      monthlyIncome,
      announcedIncome,
      currentValue,
      pendingIncome: Math.max(monthlyIncome - announcedIncome, 0),
      waiting,
      topIncome: [...enriched].sort((a, b) => b.estimatedIncome - a.estimatedIncome).slice(0, 3),
      topWeight: [...enriched].sort((a, b) => b.currentValuePosition - a.currentValuePosition).slice(0, 3),
      segmentBreakdown,
      mainSegment,
    };
  }, [loaded]);

  const upcomingPayments = useMemo(() => getUpcomingPayments(loaded), [loaded]);
  const displayedUpcomingPayments = upcomingPayments.slice(0, 12);
  const shouldScrollUpcomingPayments = displayedUpcomingPayments.length > 4;
  const firstPayment = upcomingPayments[0];
  const topIncome = insights.topIncome[0];

  function addItem() {
    const code = ticker.trim().toUpperCase();
    const totalQuotas = Number(quotas.replace(",", "."));

    if (!code || !Number.isFinite(totalQuotas) || totalQuotas <= 0) {
      setMessage("Informe um ticker e uma quantidade de cotas válida.");
      return;
    }

    setItems((current) => {
      const existing = current.find((item) => item.ticker === code);
      if (existing) {
        return current.map((item) => item.ticker === code ? { ...item, quotas: totalQuotas } : item);
      }

      return [...current, { ticker: code, quotas: totalQuotas }].sort((a, b) => a.ticker.localeCompare(b.ticker));
    });

    setTicker("");
    setQuotas("");
    setMessage("");
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
  }

  async function updateMissingDividends() {
    if (!insights.waiting.length) return;
    setUpdatingMissing(true);
    setMessage("");

    let updated = 0;
    let failed = 0;

    for (const item of insights.waiting) {
      try {
        const response = await fetch("/api/update-dividends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker: item.ticker }),
        });

        if (response.ok) updated += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
    }

    const tickers = items.map((item) => item.ticker);
    setItems(tickers.map((code) => ({ ticker: code, quotas: items.find((item) => item.ticker === code)?.quotas || 0 })));
    setUpdatingMissing(false);
    setMessage(`Atualização concluída. Sucesso: ${updated}. Falhas ou limite diário: ${failed}.`);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title="Minha Carteira"
        subtitle="Salva neste navegador. Adicione seus FIIs e veja renda estimada e próximos pagamentos."
        action={(
          <Link href="/calendario-dividendos-fiis" className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">
            Calendário público
          </Link>
        )}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-gray-900 p-5 shadow-lg ring-1 ring-white/10">
          <p className="text-base font-extrabold text-white">Renda mensal estimada</p>
          <strong className="mt-2 block text-3xl text-green-300">{formatCurrency(insights.monthlyIncome)}</strong>
          <p className="mt-2 text-sm font-medium text-gray-300">Baseada no último rendimento disponível.</p>
        </div>

        <div className="rounded-2xl bg-gray-900 p-5 shadow-lg ring-1 ring-white/10">
          <p className="text-base font-extrabold text-white">Valor aproximado da carteira</p>
          <strong className="mt-2 block text-3xl text-indigo-300">{formatCurrency(insights.currentValue)}</strong>
          <p className="mt-2 text-sm font-medium text-gray-300">Calculado pelo preço atual retornado pela consulta.</p>
        </div>

        <div className="rounded-2xl bg-gray-900 p-5 shadow-lg ring-1 ring-white/10">
          <p className="text-base font-extrabold text-white">Segmento principal por cotas</p>
          <strong className="mt-2 block text-3xl text-yellow-300">{insights.mainSegment?.value || "-"}</strong>
          <p className="mt-2 text-sm font-medium text-gray-300">{insights.mainSegment?.ticker || "Adicione FIIs para calcular."}</p>
        </div>
      </section>

      <section className="mt-6 rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
        <h2 className="text-xl font-extrabold text-white">Resumo da carteira</h2>
        {!items.length ? (
          <p className="mt-3 text-sm font-medium text-gray-300">Adicione FIIs para gerar um resumo automático da carteira.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <SummaryItem
              label="Concentração por cotas"
              value={insights.mainSegment ? `${insights.mainSegment.ticker} concentra ${insights.mainSegment.value} das cotas cadastradas.` : "Sem segmento calculado."}
            />
            <SummaryItem
              label="Maior fonte de renda estimada"
              value={topIncome ? `${topIncome.ticker} lidera com ${formatCurrency(topIncome.estimatedIncome)} por mês estimado.` : "Sem renda estimada ainda."}
            />
            <SummaryItem
              label="Comunicados do mês"
              value={insights.waiting.length ? `${insights.waiting.length} FII(s) ainda aguardam comunicado de ${MONTHS_PTBR[insights.currentMonth]}.` : `Todos os FIIs carregados já têm comunicado de ${MONTHS_PTBR[insights.currentMonth]}.`}
            />
            <SummaryItem
              label="Próximo pagamento"
              value={firstPayment ? `${firstPayment.ticker} em ${firstPayment.date}, estimado em ${formatCurrency(firstPayment.amount)}.` : "Nenhum pagamento futuro identificado na base."}
            />
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-white">
              <AlertTriangle size={20} className="text-yellow-300" /> Aguardando comunicado
            </h2>
            <p className="mt-2 text-sm font-medium text-gray-300">
              {insights.waiting.length
                ? `${insights.waiting.length} FII(s) da carteira ainda não têm rendimento de ${MONTHS_PTBR[insights.currentMonth]} na base. Estimativa pendente: ${formatCurrency(insights.pendingIncome)}.`
                : `Todos os FIIs carregados já têm rendimento de ${MONTHS_PTBR[insights.currentMonth]} na base.`}
            </p>
            {insights.waiting.length > 0 && (
              <p className="mt-2 text-sm font-medium text-gray-200">
                {insights.waiting.map((item) => item.ticker).join(", ")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={updateMissingDividends}
            disabled={!insights.waiting.length || updatingMissing}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
          >
            <RefreshCw size={16} className={updatingMissing ? "animate-spin" : ""} /> Atualizar pendentes
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
        <h2 className="mb-4 text-xl font-extrabold text-white">Adicionar FII</h2>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
          <input
            value={ticker}
            onChange={(event) => setTicker(event.target.value.toUpperCase())}
            onKeyDown={(event) => { if (event.key === "Enter") addItem(); }}
            placeholder="Ticker, ex: ABCD11"
            className="rounded-lg border border-gray-700 bg-gray-800 p-3 text-white outline-none placeholder:text-gray-400 focus:border-indigo-400"
          />
          <input
            value={quotas}
            onChange={(event) => setQuotas(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") addItem(); }}
            placeholder="Quantidade de cotas"
            inputMode="decimal"
            className="rounded-lg border border-gray-700 bg-gray-800 p-3 text-white outline-none placeholder:text-gray-400 focus:border-indigo-400"
          />
          <button onClick={addItem} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-700">
            <Plus size={18} /> Adicionar
          </button>
          <button onClick={exportCsv} disabled={!loaded.length} className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-800 px-5 py-3 font-bold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500">
            <Download size={18} /> Exportar CSV
          </button>
        </div>
        {message && <p className="mt-3 text-sm font-medium text-yellow-200">{message}</p>}
      </section>

      <section className="mt-6 rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-white">FIIs na carteira</h2>
          {loading && <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-300"><Loader2 className="animate-spin" size={16} /> Atualizando...</span>}
        </div>

        {!items.length ? (
          <p className="rounded-xl border border-dashed border-gray-700 p-6 text-center text-sm font-medium text-gray-300">
            Sua carteira ainda está vazia. Comece adicionando um ticker e a quantidade de cotas.
          </p>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {insights.enriched.map((item) => {
                const nextPayment = upcomingPayments.find((payment) => payment.ticker === item.ticker);
                const draftQuotas = editingQuotas[item.ticker] ?? String(item.quotas);
                const changed = Number(String(draftQuotas).replace(",", ".")) !== item.quotas;

                return (
                  <WalletMobileCard
                    key={`mobile-${item.ticker}`}
                    item={item}
                    nextPayment={nextPayment}
                    draftQuotas={draftQuotas}
                    changed={changed}
                    onQuotaChange={(value) => setEditingQuotas((current) => ({ ...current, [item.ticker]: value }))}
                    onSave={() => updateQuotas(item.ticker)}
                    onRemove={() => removeItem(item.ticker)}
                  />
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[940px] text-left text-sm">
                <thead className="text-gray-300">
                  <tr className="border-b border-gray-800">
                    <th className="py-3 font-bold">FII</th>
                    <th className="font-bold">Cotas</th>
                    <th className="font-bold">Preço</th>
                    <th className="font-bold">Último rendimento</th>
                    <th className="font-bold">Anunciado no mês</th>
                    <th className="font-bold">Renda estimada</th>
                    <th className="font-bold">Próximo pagamento</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {insights.enriched.map((item) => {
                    const nextPayment = upcomingPayments.find((payment) => payment.ticker === item.ticker);
                    const draftQuotas = editingQuotas[item.ticker] ?? String(item.quotas);
                    const changed = Number(String(draftQuotas).replace(",", ".")) !== item.quotas;

                    return (
                      <tr key={item.ticker} className="border-b border-gray-800 text-gray-100">
                        <td className="py-3 font-bold">
                          <FiiTickerLink ticker={item.ticker} />
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <input
                              value={draftQuotas}
                              onChange={(event) => setEditingQuotas((current) => ({ ...current, [item.ticker]: event.target.value }))}
                              onKeyDown={(event) => { if (event.key === "Enter") updateQuotas(item.ticker); }}
                              inputMode="decimal"
                              className="w-24 rounded-lg border border-gray-700 bg-gray-950 p-2 text-white outline-none focus:border-indigo-400"
                            />
                            <button
                              onClick={() => updateQuotas(item.ticker)}
                              disabled={!changed}
                              className={`rounded-lg p-2 ${changed ? "text-green-300 hover:bg-green-950/40" : "cursor-not-allowed text-gray-600"}`}
                              title="Salvar cotas"
                            >
                              <Save size={17} />
                            </button>
                          </div>
                        </td>
                        <td className="font-medium text-gray-200">{item.data?.price || "-"}</td>
                        <td className="font-medium text-gray-200">{item.lastDividend ? `${MONTHS_PTBR[item.lastDividend.month] || item.lastDividend.month}: ${item.lastDividend.info.earnings}` : item.error || "-"}</td>
                        <td className="font-medium text-gray-200">{item.currentDividend ? item.currentDividend.info.earnings : "Aguardando"}</td>
                        <td className="font-bold text-green-300">{formatCurrency(item.estimatedIncome)}</td>
                        <td className="font-medium text-gray-200">
                          {nextPayment
                            ? `${nextPayment.date} · ${formatCurrency(nextPayment.amount)}${nextPayment.dateWith ? ` · Data-com ${nextPayment.dateWith}` : ""}`
                            : "Sem pagamento futuro na base"}
                        </td>
                        <td className="text-right">
                          <button onClick={() => removeItem(item.ticker)} className="rounded-lg p-2 text-red-300 hover:bg-red-950/40" title="Remover">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <RankingCard title="Maior renda estimada" items={insights.topIncome.map((item) => ({ ticker: item.ticker, value: formatCurrency(item.estimatedIncome) }))} />
        <RankingCard title="Maior peso financeiro" items={insights.topWeight.map((item) => ({ ticker: item.ticker, value: formatCurrency(item.currentValuePosition) }))} />
        <RankingCard title="Distribuição por segmento (cotas)" items={insights.segmentBreakdown} />
      </section>

      <section className="mt-6 rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-extrabold text-white">
          <CalendarDays className="text-green-300" /> Próximos pagamentos
        </h2>

        {!displayedUpcomingPayments.length ? (
          <p className="text-sm font-medium text-gray-300">Ainda não há pagamentos futuros identificados para os FIIs da sua carteira.</p>
        ) : (
          <ul className={`${shouldScrollUpcomingPayments ? "max-h-[520px] overflow-y-auto pr-2" : ""} space-y-3`}>
            {displayedUpcomingPayments.map((payment) => (
              <li key={`${payment.ticker}-${payment.date}-${payment.month}`} className="flex flex-col justify-between gap-1 rounded-xl bg-gray-800 p-4 md:flex-row md:items-center">
                <div>
                  <FiiTickerLink ticker={payment.ticker} />
                  <span className="ml-2 text-sm font-medium text-gray-300">
                    {MONTHS_PTBR[payment.month] || payment.month} · Data-com {payment.dateWith || "-"} · Pagamento em {payment.date}
                  </span>
                </div>
                <strong className="text-green-300">{formatCurrency(payment.amount)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-800 p-4 ring-1 ring-white/5">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-2 text-sm font-bold text-gray-100">{value}</p>
    </div>
  );
}

function FiiTickerLink({ ticker }: { ticker: string }) {
  return (
    <Link href={`/fii/${ticker}`} className="font-bold text-indigo-200 hover:text-indigo-100">
      {ticker}
    </Link>
  );
}

function WalletMobileCard({
  item,
  nextPayment,
  draftQuotas,
  changed,
  onQuotaChange,
  onSave,
  onRemove,
}: {
  item: any;
  nextPayment?: Payment;
  draftQuotas: string;
  changed: boolean;
  onQuotaChange: (value: string) => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  return (
    <article className="rounded-2xl bg-gray-800 p-4 text-gray-100 ring-1 ring-white/10">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-extrabold">
            <FiiTickerLink ticker={item.ticker} />
          </h3>
          <p className="mt-1 text-sm font-medium text-gray-300">{item.quotas} cotas</p>
        </div>
        <button onClick={onRemove} className="rounded-lg p-2 text-red-300 hover:bg-red-950/40" title="Remover">
          <Trash2 size={18} />
        </button>
      </div>

      <div className="grid gap-3">
        <InfoRow label="Preço atual" value={item.data?.price || "-"} />
        <InfoRow label="Último rendimento" value={item.lastDividend ? `${MONTHS_PTBR[item.lastDividend.month] || item.lastDividend.month}: ${item.lastDividend.info.earnings}` : item.error || "-"} />
        <InfoRow label="Anunciado no mês" value={item.currentDividend ? item.currentDividend.info.earnings : "Aguardando"} />
        <InfoRow label="Renda estimada" value={formatCurrency(item.estimatedIncome)} highlight="green" />
        <InfoRow
          label="Próximo pagamento"
          value={nextPayment ? `${nextPayment.date} · ${formatCurrency(nextPayment.amount)}${nextPayment.dateWith ? ` · Data-com ${nextPayment.dateWith}` : ""}` : "Sem pagamento futuro na base"}
        />
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <input
          value={draftQuotas}
          onChange={(event) => onQuotaChange(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") onSave(); }}
          inputMode="decimal"
          className="rounded-lg border border-gray-700 bg-gray-950 p-2 text-white outline-none focus:border-indigo-400"
        />
        <button
          onClick={onSave}
          disabled={!changed}
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 font-bold ${changed ? "bg-indigo-600 text-white hover:bg-indigo-700" : "cursor-not-allowed bg-gray-700 text-gray-400"}`}
        >
          <Save size={16} /> Salvar
        </button>
      </div>
    </article>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: "green" }) {
  return (
    <div className="rounded-xl bg-gray-900 p-3 ring-1 ring-white/5">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-sm font-bold ${highlight === "green" ? "text-green-300" : "text-gray-100"}`}>{value}</p>
    </div>
  );
}

function RankingCard({ title, items }: { title: string; items: Array<{ ticker: string; value: string }> }) {
  const isSegmentDistribution = title.includes("Distribuição por segmento");

  return (
    <div className="rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
      <h3 className="mb-3 text-base font-extrabold text-white">{title}</h3>
      {!items.length ? (
        <p className="text-sm font-medium text-gray-300">Sem dados ainda.</p>
      ) : isSegmentDistribution ? (
        <ol className="space-y-4 text-sm">
          {items.map((item, index) => (
            <li key={`${title}-${item.ticker}`} className="rounded-lg bg-gray-800 px-3 py-3 text-gray-200">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-medium"><strong className="text-gray-400">#{index + 1}</strong> {item.ticker}</span>
                <strong className="text-indigo-200">{item.value}</strong>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-gray-700">
                <div className={`h-full rounded-full bg-indigo-400 ${getBarWidthClass(item.value)}`} />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <ol className="space-y-2 text-sm">
          {items.map((item, index) => (
            <li key={`${title}-${item.ticker}`} className="flex justify-between gap-3 rounded-lg bg-gray-800 px-3 py-2 text-gray-200">
              <span><strong className="text-gray-400">#{index + 1}</strong> <FiiTickerLink ticker={item.ticker} /></span>
              <strong className="text-indigo-200">{item.value}</strong>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
