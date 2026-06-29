'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import PageHeader from "../../components/PageHeader";
import WalletQuickAddButton from "../../components/WalletQuickAddButton";
import FiiAlert from "../../components/FiiAlert";

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

function getYearData(data: any) {
  const year = new Date().getFullYear();
  return {
    year,
    earnings: data?.[`earnings${year}`] || {},
  };
}

function getOrderedDividends(data: any) {
  const { year, earnings } = getYearData(data);
  const items = Object.entries(earnings)
    .sort(([a], [b]) => MONTHS.indexOf(a) - MONTHS.indexOf(b))
    .map(([month, info]: any) => ({ month, info }));

  return { year, items };
}

function getLastDividend(data: any) {
  const { items } = getOrderedDividends(data);
  return items[items.length - 1] || null;
}

function getNextPayment(data: any) {
  const today = new Date();
  const { items } = getOrderedDividends(data);

  return items
    .map(({ month, info }: any) => {
      if (!info?.payment_date) return null;
      const [day, monthNumber, year] = String(info.payment_date).split("/").map(Number);
      if (!day || !monthNumber || !year) return null;

      return {
        month,
        info,
        date: new Date(year, monthNumber - 1, day, 23, 59, 59),
      };
    })
    .filter(Boolean)
    .filter((item: any) => item.date >= today)
    .sort((a: any, b: any) => a.date.getTime() - b.date.getTime())[0] || null;
}

export default function FiiPage() {
  const params = useParams<{ ticker: string }>();
  const ticker = String(params?.ticker || "").toUpperCase();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      if (!ticker) return;

      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/fii?ticker=${ticker}`, { cache: "no-store" });
        const json = await response.json();

        if (!response.ok) {
          setError(json.error || "FII não encontrado.");
          setData(null);
          return;
        }

        setData(json);
      } catch (err: any) {
        setError(err.message || "Erro ao carregar FII.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [ticker]);

  const orderedDividends = useMemo(() => getOrderedDividends(data), [data]);
  const lastDividend = useMemo(() => getLastDividend(data), [data]);
  const nextPayment = useMemo(() => getNextPayment(data), [data]);
  const lastDividendValue = parseCurrency(lastDividend?.info?.earnings);
  const price = parseCurrency(data?.price);
  const monthlyYield = price > 0 && lastDividendValue > 0 ? (lastDividendValue / price) * 100 : 0;
  const segment = data?.segment_new || data?.segment || "Sem segmento";
  const socialReason = data?.socialReason || data?.name || data?.razao_social || "Dados cadastrais não informados.";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title={ticker || "FII"}
        subtitle={data ? `${socialReason}` : "Consulte preço, rendimentos e dados principais do fundo."}
        action={ticker ? (
          <div className="flex items-center gap-2">
            <WalletQuickAddButton ticker={ticker} />
            <FiiAlert fiiCode={ticker} />
          </div>
        ) : null}
      />

      {loading && (
        <p className="flex items-center justify-center gap-2 text-slate-600">
          <Loader2 className="animate-spin" size={20} /> Carregando dados do {ticker}...
        </p>
      )}

      {error && (
        <section className="rounded-2xl bg-red-50 p-5 text-red-700 ring-1 ring-red-100">
          <p className="font-bold">Não foi possível carregar este fundo.</p>
          <p className="mt-1 text-sm">{error}</p>
          <Link href="/" className="mt-4 inline-flex rounded-full bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">
            Voltar para consulta
          </Link>
        </section>
      )}

      {!loading && !error && data && (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-4">
            <MetricCard title="Preço atual" value={data.price || "-"} description="Cotação retornada pela base atual." tone="indigo" />
            <MetricCard title="Último rendimento" value={lastDividend?.info?.earnings || "-"} description={lastDividend ? MONTHS_PTBR[lastDividend.month] || lastDividend.month : "Sem rendimento no ano."} tone="green" />
            <MetricCard title="Yield mensal" value={monthlyYield ? `${monthlyYield.toFixed(2).replace(".", ",")}%` : "-"} description="Último rendimento dividido pelo preço atual." tone="yellow" />
            <MetricCard title="Segmento" value={segment} description="Classificação cadastrada na base." tone="indigo" />
          </section>

          <section className="grid gap-4 md:grid-cols-[1fr_1fr]">
            <InfoCard title="Dados cadastrais">
              <InfoLine label="Ticker" value={ticker} />
              <InfoLine label="Razão social" value={socialReason} />
              <InfoLine label="CNPJ" value={data.cnpj || "Não informado"} />
              <InfoLine label="Segmento" value={segment} />
              <InfoLine label="IFIX" value={data.isIFIX ? "Sim" : "Não informado"} />
            </InfoCard>

            <InfoCard title="Próximo pagamento">
              {nextPayment ? (
                <>
                  <InfoLine label="Mês de referência" value={MONTHS_PTBR[nextPayment.month] || nextPayment.month} />
                  <InfoLine label="Rendimento por cota" value={nextPayment.info?.earnings || "-"} />
                  <InfoLine label="Data-com" value={nextPayment.info?.date_with || "-"} />
                  <InfoLine label="Pagamento" value={nextPayment.info?.payment_date || "-"} />
                </>
              ) : (
                <p className="text-sm font-medium text-gray-300">Nenhum pagamento futuro identificado na base para este FII.</p>
              )}
            </InfoCard>
          </section>

          <section className="rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
            <div className="mb-4 flex flex-col justify-between gap-2 md:flex-row md:items-center">
              <div>
                <h2 className="text-xl font-extrabold text-white">Histórico de rendimentos</h2>
                <p className="mt-1 text-sm font-medium text-gray-300">Eventos carregados para {orderedDividends.year}.</p>
              </div>
              <Link href={`/?ticker=${ticker}`} className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">
                Consultar na Home
              </Link>
            </div>

            {!orderedDividends.items.length ? (
              <p className="text-sm font-medium text-gray-300">Ainda não há rendimentos cadastrados para o ano atual.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-gray-300">
                    <tr className="border-b border-gray-800">
                      <th className="py-3 font-bold">Mês</th>
                      <th className="font-bold">Rendimento</th>
                      <th className="font-bold">Data-com</th>
                      <th className="font-bold">Pagamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedDividends.items.map(({ month, info }: any) => (
                      <tr key={`${ticker}-${month}`} className="border-b border-gray-800 text-gray-100">
                        <td className="py-3 font-bold text-indigo-200">{MONTHS_PTBR[month] || month}</td>
                        <td className="font-bold text-green-300">{info?.earnings || "-"}</td>
                        <td className="font-medium text-gray-200">{info?.date_with || "-"}</td>
                        <td className="font-medium text-gray-200">{info?.payment_date || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function MetricCard({ title, value, description, tone }: { title: string; value: string; description: string; tone: "green" | "indigo" | "yellow" }) {
  const toneClass = {
    green: "text-green-300",
    indigo: "text-indigo-300",
    yellow: "text-yellow-300",
  }[tone];

  return (
    <div className="rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
      <p className="text-base font-extrabold text-white">{title}</p>
      <strong className={`mt-2 block break-words text-3xl ${toneClass}`}>{value}</strong>
      <p className="mt-2 text-sm font-medium text-gray-300">{description}</p>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
      <h2 className="text-xl font-extrabold text-white">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-800 p-3 ring-1 ring-white/5">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-gray-100">{value}</p>
    </div>
  );
}
