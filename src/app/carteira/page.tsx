'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, Plus, Trash2, Wallet } from "lucide-react";

type WalletItem = {
  ticker: string;
  quotas: number;
};

type LoadedFii = WalletItem & {
  data?: any;
  error?: string;
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

function getUpcomingPayments(items: LoadedFii[]) {
  const today = new Date();
  const payments: Array<{ ticker: string; quotas: number; date: string; amount: number; dividend: number; month: string }> = [];

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

export default function WalletPage() {
  const [ticker, setTicker] = useState("");
  const [quotas, setQuotas] = useState("");
  const [items, setItems] = useState<WalletItem[]>([]);
  const [loaded, setLoaded] = useState<LoadedFii[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

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
  }, [items]);

  useEffect(() => {
    async function loadWallet() {
      if (!items.length) {
        setLoaded([]);
        return;
      }

      setLoading(true);
      setMessage("");

      const result = await Promise.all(items.map(async (item) => {
        try {
          const response = await fetch(`/api/fii?ticker=${item.ticker}`);
          const data = await response.json();

          if (!response.ok) {
            return { ...item, error: data.error || "FII não encontrado" };
          }

          return { ...item, data };
        } catch {
          return { ...item, error: "Erro ao buscar dados" };
        }
      }));

      setLoaded(result);
      setLoading(false);
    }

    loadWallet();
  }, [items]);

  const summary = useMemo(() => {
    return loaded.reduce((acc, item) => {
      const lastDividend = getLastDividend(item.data);
      const dividend = parseCurrency(lastDividend?.info?.earnings);
      const price = parseCurrency(item.data?.price);

      acc.monthlyIncome += dividend * item.quotas;
      acc.currentValue += price * item.quotas;
      return acc;
    }, { monthlyIncome: 0, currentValue: 0 });
  }, [loaded]);

  const upcomingPayments = useMemo(() => getUpcomingPayments(loaded), [loaded]);

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

  function removeItem(code: string) {
    setItems((current) => current.filter((item) => item.ticker !== code));
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-gray-100">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/" className="text-sm text-indigo-300 hover:text-indigo-100">← Voltar para consulta</Link>
          <h1 className="mt-3 flex items-center gap-2 text-3xl font-bold">
            <Wallet className="text-indigo-300" /> Minha Carteira FIIs
          </h1>
          <p className="mt-2 text-gray-400">
            Salva neste navegador. Adicione seus FIIs e veja renda estimada e próximos pagamentos.
          </p>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-gray-900 p-5 shadow-lg">
          <p className="text-sm text-gray-400">Renda mensal estimada</p>
          <strong className="mt-2 block text-3xl text-green-300">{formatCurrency(summary.monthlyIncome)}</strong>
          <p className="mt-2 text-xs text-gray-500">Baseada no último rendimento disponível de cada FII.</p>
        </div>

        <div className="rounded-2xl bg-gray-900 p-5 shadow-lg">
          <p className="text-sm text-gray-400">Valor aproximado da carteira</p>
          <strong className="mt-2 block text-3xl text-indigo-300">{formatCurrency(summary.currentValue)}</strong>
          <p className="mt-2 text-xs text-gray-500">Calculado pelo preço atual retornado pela consulta.</p>
        </div>

        <div className="rounded-2xl bg-gray-900 p-5 shadow-lg">
          <p className="text-sm text-gray-400">Yield mensal estimado</p>
          <strong className="mt-2 block text-3xl text-yellow-300">
            {summary.currentValue > 0 ? `${((summary.monthlyIncome / summary.currentValue) * 100).toFixed(2).replace(".", ",")}%` : "0,00%"}
          </strong>
          <p className="mt-2 text-xs text-gray-500">Indicador aproximado, não é recomendação.</p>
        </div>
      </section>

      <section className="mt-6 rounded-2xl bg-gray-900 p-5 shadow-lg">
        <h2 className="mb-4 text-xl font-bold">Adicionar FII</h2>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            value={ticker}
            onChange={(event) => setTicker(event.target.value.toUpperCase())}
            onKeyDown={(event) => { if (event.key === "Enter") addItem(); }}
            placeholder="Ticker, ex: TGAR11"
            className="rounded-lg border border-gray-700 bg-gray-800 p-3 text-white outline-none focus:border-indigo-400"
          />
          <input
            value={quotas}
            onChange={(event) => setQuotas(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") addItem(); }}
            placeholder="Quantidade de cotas"
            inputMode="decimal"
            className="rounded-lg border border-gray-700 bg-gray-800 p-3 text-white outline-none focus:border-indigo-400"
          />
          <button onClick={addItem} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-700">
            <Plus size={18} /> Adicionar
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-yellow-200">{message}</p>}
      </section>

      <section className="mt-6 rounded-2xl bg-gray-900 p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">FIIs na carteira</h2>
          {loading && <span className="inline-flex items-center gap-2 text-sm text-gray-400"><Loader2 className="animate-spin" size={16} /> Atualizando...</span>}
        </div>

        {!items.length ? (
          <p className="rounded-xl border border-dashed border-gray-700 p-6 text-center text-gray-400">
            Sua carteira ainda está vazia. Comece adicionando um ticker e a quantidade de cotas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-gray-400">
                <tr className="border-b border-gray-800">
                  <th className="py-3">FII</th>
                  <th>Cotas</th>
                  <th>Preço</th>
                  <th>Último rendimento</th>
                  <th>Renda estimada</th>
                  <th>Próximo pagamento</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loaded.map((item) => {
                  const lastDividend = getLastDividend(item.data);
                  const dividend = parseCurrency(lastDividend?.info?.earnings);
                  const nextPayment = upcomingPayments.find((payment) => payment.ticker === item.ticker);

                  return (
                    <tr key={item.ticker} className="border-b border-gray-800 text-gray-100">
                      <td className="py-3 font-bold text-indigo-200">{item.ticker}</td>
                      <td>{item.quotas}</td>
                      <td>{item.data?.price || "-"}</td>
                      <td>{lastDividend ? `${MONTHS_PTBR[lastDividend.month] || lastDividend.month}: ${lastDividend.info.earnings}` : item.error || "-"}</td>
                      <td className="font-bold text-green-300">{formatCurrency(dividend * item.quotas)}</td>
                      <td>{nextPayment ? `${nextPayment.date} · ${formatCurrency(nextPayment.amount)}` : "Sem pagamento futuro na base"}</td>
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
        )}
      </section>

      <section className="mt-6 rounded-2xl bg-gray-900 p-5 shadow-lg">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
          <CalendarDays className="text-green-300" /> Próximos pagamentos
        </h2>

        {!upcomingPayments.length ? (
          <p className="text-gray-400">Ainda não há pagamentos futuros identificados para os FIIs da sua carteira.</p>
        ) : (
          <ul className="space-y-3">
            {upcomingPayments.slice(0, 12).map((payment) => (
              <li key={`${payment.ticker}-${payment.date}-${payment.month}`} className="flex flex-col justify-between gap-1 rounded-xl bg-gray-800 p-4 md:flex-row md:items-center">
                <div>
                  <strong className="text-indigo-200">{payment.ticker}</strong>
                  <span className="ml-2 text-gray-400">{MONTHS_PTBR[payment.month] || payment.month} · pagamento em {payment.date}</span>
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
