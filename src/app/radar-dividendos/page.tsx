'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Radar } from "lucide-react";
import WalletQuickAddButton from "../components/WalletQuickAddButton";
import FiiAlert from "../components/FiiAlert";

type CalendarEvent = {
  ticker: string;
  socialReason: string;
  segment: string;
  paymentDate: string;
  dateWith: string;
  earnings: string;
};

function RadarTable({ title, events, emptyText }: { title: string; events: CalendarEvent[]; emptyText: string }) {
  return (
    <section className="rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-bold"><Radar className="text-green-300" /> {title}</h2>
      {!events.length ? (
        <p className="text-gray-400">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-gray-400">
              <tr className="border-b border-gray-800">
                <th className="py-3">FII</th>
                <th>Rendimento</th>
                <th>Data-com</th>
                <th>Pagamento</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={`${title}-${event.ticker}-${event.paymentDate}`} className="border-b border-gray-800">
                  <td className="py-4">
                    <Link href={`/?ticker=${event.ticker}`} className="font-bold text-indigo-200 hover:text-indigo-100">{event.ticker}</Link>
                    {event.socialReason && <p className="mt-1 max-w-[220px] truncate text-xs text-gray-500">{event.socialReason}</p>}
                  </td>
                  <td className="font-bold text-green-300">{event.earnings}</td>
                  <td>{event.dateWith || "-"}</td>
                  <td>{event.paymentDate || "-"}</td>
                  <td>
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
      )}
    </section>
  );
}

export default function DividendRadarPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/dividend-calendar?limit=1200");
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Erro ao carregar radar.");
        setData(json);
      } catch (err: any) {
        setError(err.message || "Erro ao carregar radar.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const announced = useMemo(() => {
    const search = query.trim().toUpperCase();
    const events = data?.currentMonth || [];
    if (!search) return events;
    return events.filter((event: CalendarEvent) => event.ticker.includes(search) || event.socialReason?.toUpperCase().includes(search) || event.segment?.toUpperCase().includes(search));
  }, [data, query]);

  const nextEvents = useMemo(() => [...(data?.nextEvents || [])].slice(0, 20), [data]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/" className="text-sm font-bold text-indigo-700 hover:text-indigo-900">← Voltar para consulta</Link>
      <h1 className="mt-4 text-3xl font-extrabold text-slate-800">Radar de Dividendos</h1>
      <p className="mt-2 text-slate-600">Acompanhe FIIs que já anunciaram rendimento no mês e os próximos pagamentos da base Dados FII.</p>

      <div className="mt-6 rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg">
        <label className="mb-2 block text-sm font-bold text-gray-300">Filtrar por ticker, nome ou segmento</label>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ex: TGAR11, papel, logística..."
          className="w-full rounded-lg border border-gray-700 bg-gray-950 p-3 text-white outline-none focus:border-indigo-400"
        />
      </div>

      {loading && <p className="mt-8 flex items-center justify-center gap-2 text-slate-600"><Loader2 className="animate-spin" size={20} /> Carregando radar...</p>}
      {error && <p className="mt-6 rounded-xl bg-red-100 p-4 text-red-700">{error}</p>}

      {!loading && !error && (
        <div className="mt-6 space-y-6">
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg">
              <p className="text-sm text-gray-400">Anunciados no mês</p>
              <strong className="mt-2 block text-3xl text-green-300">{announced.length}</strong>
            </div>
            <div className="rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg">
              <p className="text-sm text-gray-400">Próximos pagamentos</p>
              <strong className="mt-2 block text-3xl text-indigo-300">{data?.nextEvents?.length || 0}</strong>
            </div>
            <div className="rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg">
              <p className="text-sm text-gray-400">Eventos na base</p>
              <strong className="mt-2 block text-3xl text-yellow-300">{data?.total || 0}</strong>
            </div>
          </section>

          <RadarTable title="Já anunciaram este mês" events={announced.slice(0, 30)} emptyText="Nenhum comunicado encontrado." />
          <RadarTable title="Próximos pagamentos no radar" events={nextEvents} emptyText="Nenhum pagamento futuro encontrado." />
        </div>
      )}
    </main>
  );
}
