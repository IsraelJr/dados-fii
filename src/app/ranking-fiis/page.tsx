'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Trophy } from "lucide-react";
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

function parseCurrency(value: unknown) {
  return Number(String(value || "0").replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
}

function RankingTable({ title, events }: { title: string; events: CalendarEvent[] }) {
  return (
    <section className="rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-bold"><Trophy className="text-yellow-300" /> {title}</h2>
      {!events.length ? (
        <p className="text-gray-400">Sem dados para exibir.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-gray-400">
              <tr className="border-b border-gray-800">
                <th className="py-3">#</th>
                <th>FII</th>
                <th>Rendimento</th>
                <th>Data-com</th>
                <th>Pagamento</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event, index) => (
                <tr key={`${title}-${event.ticker}-${event.paymentDate}`} className="border-b border-gray-800">
                  <td className="py-4 font-bold text-gray-500">{index + 1}</td>
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

export default function RankingFiisPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/dividend-calendar?limit=1200");
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Erro ao carregar rankings.");
        setData(json);
      } catch (err: any) {
        setError(err.message || "Erro ao carregar rankings.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const topCurrentMonth = useMemo(() => {
    return [...(data?.currentMonth || [])]
      .sort((a: CalendarEvent, b: CalendarEvent) => parseCurrency(b.earnings) - parseCurrency(a.earnings))
      .slice(0, 15);
  }, [data]);

  const nextPayments = useMemo(() => [...(data?.nextEvents || [])].slice(0, 15), [data]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/" className="text-sm font-bold text-indigo-700 hover:text-indigo-900">← Voltar para consulta</Link>
      <h1 className="mt-4 text-3xl font-extrabold text-slate-800">Ranking de FIIs</h1>
      <p className="mt-2 text-slate-600">Rankings simples com base nos rendimentos e próximos pagamentos disponíveis no Dados FII.</p>

      {loading && <p className="mt-8 flex items-center justify-center gap-2 text-slate-600"><Loader2 className="animate-spin" size={20} /> Carregando rankings...</p>}
      {error && <p className="mt-6 rounded-xl bg-red-100 p-4 text-red-700">{error}</p>}

      {!loading && !error && (
        <div className="mt-6 space-y-6">
          <RankingTable title="Maiores rendimentos anunciados no mês" events={topCurrentMonth} />
          <RankingTable title="Próximos pagamentos" events={nextPayments} />
        </div>
      )}
    </main>
  );
}
