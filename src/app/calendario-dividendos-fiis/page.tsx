'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Loader2, Search } from "lucide-react";
import WalletQuickAddButton from "../components/WalletQuickAddButton";
import FiiAlert from "../components/FiiAlert";
import PageHeader from "../components/PageHeader";

type CalendarEvent = {
  ticker: string;
  socialReason: string;
  segment: string;
  month: string;
  paymentDate: string;
  paymentDateKey: string;
  dateWith: string;
  earnings: string;
};

type CalendarWindows = {
  today?: string;
  currentWeekStart?: string;
  currentWeekEnd?: string;
  weekPaymentStart?: string;
  weekPaymentEnd?: string;
  paidRecentlyStart?: string;
  paidRecentlyEnd?: string;
  weekStart?: string;
  weekEnd?: string;
};

const INITIAL_VISIBLE_ITEMS = 10;
const ITEMS_STEP = 10;

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

function formatDividend(value: unknown) {
  const parsed = parseCurrency(value);
  if (!parsed) return "-";
  return `R$ ${parsed.toFixed(3).replace(".", ",")}`;
}

function formatDateKey(value?: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function describeWeekPayments(windows?: CalendarWindows) {
  const todayKey = windows?.today || windows?.weekPaymentStart || windows?.weekStart;
  const startKey = windows?.weekPaymentStart || windows?.weekStart;
  const endKey = windows?.weekPaymentEnd || windows?.weekEnd;
  const currentWeekStart = formatDateKey(windows?.currentWeekStart);
  const currentWeekEnd = formatDateKey(windows?.currentWeekEnd || endKey);
  const start = formatDateKey(startKey);
  const end = formatDateKey(endKey);

  if (!start || !end) return "Pagamentos ainda previstos para a semana atual.";

  if (startKey === endKey) {
    if (startKey === todayKey) return `Pagamentos previstos para hoje (${start}).`;
    return `Pagamentos previstos para ${start}.`;
  }

  if (currentWeekStart && currentWeekEnd) {
    return `Pagamentos ainda previstos até domingo (${start} a ${end}). Semana atual: ${currentWeekStart} a ${currentWeekEnd}.`;
  }

  return `Pagamentos ainda previstos até domingo (${start} a ${end}).`;
}

function describePaidRecently(windows?: CalendarWindows) {
  const start = formatDateKey(windows?.paidRecentlyStart);
  const end = formatDateKey(windows?.paidRecentlyEnd);

  if (!start || !end) return "Pagamentos realizados nos últimos 7 dias anteriores a hoje.";
  if (start === end) return `Pagamentos realizados em ${start}.`;
  return `Pagamentos realizados de ${start} a ${end}.`;
}

function EventList({
  title,
  description,
  events,
  emptyText,
  visibleCount,
  onShowMore,
  onShowLess,
}: {
  title: string;
  description?: string;
  events: CalendarEvent[];
  emptyText: string;
  visibleCount?: number;
  onShowMore?: () => void;
  onShowLess?: () => void;
}) {
  const shouldLimit = typeof visibleCount === "number";
  const visibleEvents = shouldLimit ? events.slice(0, visibleCount) : events;
  const hiddenCount = Math.max(events.length - visibleEvents.length, 0);
  const canShowLess = shouldLimit && visibleEvents.length > INITIAL_VISIBLE_ITEMS;

  return (
    <section className="rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
      <div className="mb-4 flex flex-col justify-between gap-2 md:flex-row md:items-start">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-white">
            <CalendarDays className="text-green-300" /> {title}
          </h2>
          {description && <p className="mt-1 text-sm font-medium text-gray-300">{description}</p>}
        </div>
        {!!events.length && (
          <span className="text-sm font-medium text-gray-300">
            Mostrando {visibleEvents.length} de {events.length}
          </span>
        )}
      </div>

      {!events.length ? (
        <p className="text-sm font-medium text-gray-300">{emptyText}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-gray-300">
                <tr className="border-b border-gray-800">
                  <th className="py-4 pr-4 font-bold">FII</th>
                  <th className="py-4 pr-4 font-bold">Rendimento</th>
                  <th className="py-4 pr-4 font-bold">Data-com</th>
                  <th className="py-4 pr-4 font-bold">Pagamento</th>
                  <th className="py-4 font-bold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visibleEvents.map((event) => (
                  <tr key={`${event.ticker}-${event.paymentDate}-${event.month}`} className="border-b border-gray-800 text-gray-100">
                    <td className="py-4 pr-4 align-top">
                      <Link href={`/fii/${event.ticker}`} className="font-bold text-indigo-200 hover:text-indigo-100">
                        {event.ticker}
                      </Link>
                      {event.socialReason && <p className="mt-1 max-w-[180px] truncate text-xs font-medium text-gray-300">{event.socialReason}</p>}
                    </td>
                    <td className="py-4 pr-4 align-top font-bold text-green-300">{formatDividend(event.earnings)}</td>
                    <td className="py-4 pr-4 align-top font-medium text-gray-200">{event.dateWith || "-"}</td>
                    <td className="py-4 pr-4 align-top font-medium text-gray-200">{event.paymentDate || "-"}</td>
                    <td className="py-4 align-top">
                      <div className="flex items-center gap-2">
                        <WalletQuickAddButton ticker={event.ticker} />
                        <FiiAlert fiiCode={event.ticker} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {shouldLimit && (hiddenCount > 0 || canShowLess) && (
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={onShowMore}
                  className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
                >
                  <ChevronDown size={16} /> Ver mais {Math.min(ITEMS_STEP, hiddenCount)}
                </button>
              )}

              {canShowLess && (
                <button
                  type="button"
                  onClick={onShowLess}
                  className="inline-flex items-center gap-2 rounded-full bg-gray-800 px-4 py-2 text-sm font-bold text-gray-100 hover:bg-gray-700"
                >
                  <ChevronUp size={16} /> Ver menos
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function DividendCalendarPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [currentMonthVisible, setCurrentMonthVisible] = useState(INITIAL_VISIBLE_ITEMS);
  const [paidRecentlyVisible, setPaidRecentlyVisible] = useState(INITIAL_VISIBLE_ITEMS);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/dividend-calendar?limit=1200");
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Erro ao carregar calendário.");
        setData(json);
      } catch (err: any) {
        setError(err.message || "Erro ao carregar calendário.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    setCurrentMonthVisible(INITIAL_VISIBLE_ITEMS);
    setPaidRecentlyVisible(INITIAL_VISIBLE_ITEMS);
  }, [query]);

  const filterEvents = (events: CalendarEvent[] = []) => {
    const search = query.trim().toUpperCase();
    if (!search) return events;
    return events.filter((event) => event.ticker.includes(search) || event.socialReason?.toUpperCase().includes(search) || event.segment?.toUpperCase().includes(search));
  };

  const weekPayments = useMemo(() => filterEvents(data?.weekPayments || data?.nextEvents || []), [data, query]);
  const currentMonth = useMemo(() => filterEvents(data?.currentMonth || []), [data, query]);
  const paidRecently = useMemo(() => filterEvents(data?.paidRecently || []), [data, query]);
  const weekDescription = describeWeekPayments(data?.windows);
  const paidRecentlyDescription = describePaidRecently(data?.windows);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title="Calendário de Dividendos"
        subtitle="Consulte pagamentos da semana, rendimentos anunciados no mês e pagamentos recentes dos fundos imobiliários da base Dados FII."
        action={(
          <Link href="/carteira" className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">
            Minha carteira
          </Link>
        )}
      />

      <div className="mb-6 rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
        <label className="mb-2 block text-base font-extrabold text-white">Filtrar por ticker, nome ou segmento</label>
        <div className="flex w-full max-w-[22rem] items-center gap-2 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 sm:w-fit">
          <Search size={18} className="shrink-0 text-gray-300" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value.toUpperCase())}
            placeholder="Ex: ABCD11"
            maxLength={15}
            className="w-[15ch] max-w-full bg-transparent text-gray-100 outline-none placeholder:text-gray-400"
          />
        </div>
      </div>

      {loading && (
        <p className="flex items-center justify-center gap-2 text-slate-600">
          <Loader2 className="animate-spin" size={20} /> Carregando calendário...
        </p>
      )}

      {error && <p className="rounded-xl bg-red-100 p-4 text-red-700">{error}</p>}

      {!loading && !error && (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
              <p className="text-base font-extrabold text-white">Eventos na base</p>
              <strong className="mt-2 block text-3xl text-indigo-300">{data?.total || 0}</strong>
              <p className="mt-2 text-sm font-medium text-gray-300">Total de eventos carregados no calendário.</p>
            </div>
            <div className="rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
              <p className="text-base font-extrabold text-white">Pagamentos da semana</p>
              <strong className="mt-2 block text-3xl text-green-300">{data?.weekPayments?.length || data?.nextEvents?.length || 0}</strong>
              <p className="mt-2 text-sm font-medium text-gray-300">Pagamentos ainda previstos dentro da semana atual.</p>
            </div>
            <div className="rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
              <p className="text-base font-extrabold text-white">Anunciados no mês</p>
              <strong className="mt-2 block text-3xl text-yellow-300">{data?.currentMonth?.length || 0}</strong>
              <p className="mt-2 text-sm font-medium text-gray-300">Pagamentos já anunciados para o mês atual.</p>
            </div>
          </section>

          <EventList
            title="Pagamentos da semana"
            description={weekDescription}
            events={weekPayments}
            emptyText="Nenhum pagamento ainda previsto para esta semana."
          />
          <EventList
            title="Anunciados no mês atual"
            description="Visão completa dos pagamentos já anunciados para o mês atual, incluindo os que ainda vão cair e os que já foram pagos."
            events={currentMonth}
            emptyText="Nenhum pagamento anunciado para o mês atual encontrado."
            visibleCount={currentMonthVisible}
            onShowMore={() => setCurrentMonthVisible((current) => current + ITEMS_STEP)}
            onShowLess={() => setCurrentMonthVisible(INITIAL_VISIBLE_ITEMS)}
          />
          <EventList
            title="Pagos nos últimos 7 dias"
            description={paidRecentlyDescription}
            events={paidRecently}
            emptyText="Nenhum pagamento identificado nos últimos 7 dias anteriores a hoje."
            visibleCount={paidRecentlyVisible}
            onShowMore={() => setPaidRecentlyVisible((current) => current + ITEMS_STEP)}
            onShowLess={() => setPaidRecentlyVisible(INITIAL_VISIBLE_ITEMS)}
          />
        </div>
      )}
    </main>
  );
}
