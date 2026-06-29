'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Loader2, Search } from "lucide-react";

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

const INITIAL_VISIBLE_ITEMS = 10;
const ITEMS_STEP = 10;

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

function EventList({
  title,
  events,
  emptyText,
  visibleCount,
  onShowMore,
  onShowLess,
}: {
  title: string;
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
    <section className="rounded-2xl bg-gray-900 p-5 shadow-lg">
      <div className="mb-4 flex flex-col justify-between gap-2 md:flex-row md:items-center">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <CalendarDays className="text-green-300" /> {title}
        </h2>
        {!!events.length && (
          <span className="text-sm text-gray-400">
            Mostrando {visibleEvents.length} de {events.length}
          </span>
        )}
      </div>

      {!events.length ? (
        <p className="text-gray-400">{emptyText}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-gray-400">
                <tr className="border-b border-gray-800">
                  <th className="py-3">FII</th>
                  <th>Rendimento</th>
                  <th>Data-com</th>
                  <th>Pagamento</th>
                  <th>Mês</th>
                  <th>Segmento</th>
                </tr>
              </thead>
              <tbody>
                {visibleEvents.map((event) => (
                  <tr key={`${event.ticker}-${event.paymentDate}-${event.month}`} className="border-b border-gray-800 text-gray-100">
                    <td className="py-3">
                      <Link href={`/?ticker=${event.ticker}`} className="font-bold text-indigo-200 hover:text-indigo-100">
                        {event.ticker}
                      </Link>
                      {event.socialReason && <p className="max-w-xs truncate text-xs text-gray-500">{event.socialReason}</p>}
                    </td>
                    <td className="font-bold text-green-300">{event.earnings || "-"}</td>
                    <td>{event.dateWith || "-"}</td>
                    <td>{event.paymentDate || "-"}</td>
                    <td>{MONTHS_PTBR[event.month] || event.month}</td>
                    <td>{event.segment || "-"}</td>
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

  const nextEvents = useMemo(() => filterEvents(data?.nextEvents || []), [data, query]);
  const currentMonth = useMemo(() => filterEvents(data?.currentMonth || []), [data, query]);
  const paidRecently = useMemo(() => filterEvents(data?.paidRecently || []), [data, query]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-gray-100">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/" className="text-sm text-indigo-300 hover:text-indigo-100">← Voltar para consulta</Link>
          <h1 className="mt-3 text-3xl font-bold">Calendário de Dividendos de FIIs</h1>
          <p className="mt-2 max-w-3xl text-gray-400">
            Consulte próximos pagamentos, data-com e rendimentos anunciados pelos fundos imobiliários da base Dados FII.
          </p>
        </div>
        <Link href="/carteira" className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">
          Minha carteira
        </Link>
      </div>

      <div className="mb-6 rounded-2xl bg-gray-900 p-5 shadow-lg">
        <label className="mb-2 block text-sm font-bold text-gray-300">Filtrar por ticker, nome ou segmento</label>
        <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2">
          <Search size={18} className="text-gray-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ex: TGAR11, logística, papel..."
            className="w-full bg-transparent text-white outline-none"
          />
        </div>
      </div>

      {loading && (
        <p className="flex items-center justify-center gap-2 text-gray-400">
          <Loader2 className="animate-spin" size={20} /> Carregando calendário...
        </p>
      )}

      {error && <p className="rounded-xl bg-red-950/40 p-4 text-red-200">{error}</p>}

      {!loading && !error && (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-gray-900 p-5 shadow-lg">
              <p className="text-sm text-gray-400">Eventos na base</p>
              <strong className="mt-2 block text-3xl text-indigo-300">{data?.total || 0}</strong>
            </div>
            <div className="rounded-2xl bg-gray-900 p-5 shadow-lg">
              <p className="text-sm text-gray-400">Próximos pagamentos</p>
              <strong className="mt-2 block text-3xl text-green-300">{data?.nextEvents?.length || 0}</strong>
            </div>
            <div className="rounded-2xl bg-gray-900 p-5 shadow-lg">
              <p className="text-sm text-gray-400">Anunciados no mês</p>
              <strong className="mt-2 block text-3xl text-yellow-300">{data?.currentMonth?.length || 0}</strong>
            </div>
          </section>

          <EventList title="Próximos pagamentos" events={nextEvents} emptyText="Nenhum pagamento futuro encontrado." />
          <EventList
            title="Anunciados no mês atual"
            events={currentMonth}
            emptyText="Nenhum comunicado do mês atual encontrado."
            visibleCount={currentMonthVisible}
            onShowMore={() => setCurrentMonthVisible((current) => current + ITEMS_STEP)}
            onShowLess={() => setCurrentMonthVisible(INITIAL_VISIBLE_ITEMS)}
          />
          <EventList
            title="Pagos recentemente"
            events={paidRecently}
            emptyText="Nenhum pagamento recente encontrado."
            visibleCount={paidRecentlyVisible}
            onShowMore={() => setPaidRecentlyVisible((current) => current + ITEMS_STEP)}
            onShowLess={() => setPaidRecentlyVisible(INITIAL_VISIBLE_ITEMS)}
          />
        </div>
      )}
    </main>
  );
}
