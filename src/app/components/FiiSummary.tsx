'use client';

import Link from "next/link";
import {
    CalendarDays,
    CheckCircle,
    XCircle,
    DollarSign,
    Building2,
    BarChart3,
    Hash,
    TrendingUp,
    HelpCircle,
} from "lucide-react";
import { SimulationCard } from "./SimulationCard";
import FiiAlert from "./FiiAlert";
import UpdateDividendButton from "./UpdateDividendButton";
import AddToWalletButton from "./AddToWalletButton";

interface Props {
    data: any;
    getCurrentYearDividends: (yearData: any) => [string, any][];
    monthsPTBR: Record<string, string>;
    lastDividend: number | null;
    onDividendUpdate?: () => void | Promise<void>;
}

const monthsOrder = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

function GlossaryLink({ href }: { href: string }) {
    return (
        <Link
            href={href}
            className="inline-flex shrink-0 items-center text-indigo-300 hover:text-indigo-100"
            title="Entenda este termo no glossário"
        >
            <HelpCircle size={14} aria-label="Glossário" />
        </Link>
    );
}

function SummaryCard({ icon, label, value, glossaryHref }: { icon: React.ReactNode; label: string; value: React.ReactNode; glossaryHref?: string }) {
    return (
        <div className="min-w-0 overflow-hidden rounded-xl bg-gray-800 p-4">
            <div className="flex min-w-0 items-start gap-3">
                <span className="mt-1 shrink-0">{icon}</span>
                <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="text-xs font-extrabold uppercase tracking-wide text-gray-400">{label}</p>
                    <div className="mt-1 flex min-w-0 items-start gap-1 text-lg font-bold leading-snug text-white md:text-2xl">
                        <span className="min-w-0 max-w-full break-words [overflow-wrap:anywhere]">{value}</span>
                        {glossaryHref && <GlossaryLink href={glossaryHref} />}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function FiiSummary({
    data,
    getCurrentYearDividends,
    monthsPTBR,
    lastDividend,
    onDividendUpdate,
}: Props) {
    const currentYear = new Date().getFullYear();
    const currentMonthKey = monthsOrder[new Date().getMonth()];
    const currentYearData = data?.[`earnings${currentYear}`] || {};
    const isCurrentMonthMissing = !currentYearData?.[currentMonthKey];

    const earningsYearData =
        data?.[`earnings${currentYear}`] ||
        data?.[`earnings${currentYear - 1}`] ||
        {};

    const dividends = getCurrentYearDividends(earningsYearData);

    return (
        <div className="mt-8 mx-auto w-full max-w-3xl overflow-hidden rounded-2xl bg-gray-900 p-4 text-gray-100 shadow-lg md:p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="min-w-0 overflow-hidden rounded-xl bg-gray-800 p-4 md:col-span-2 lg:col-span-3">
                    <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="flex min-w-0 items-start gap-2">
                            <Building2 className="mt-1 shrink-0 text-pink-400" />
                            <span className="min-w-0 break-words text-sm leading-6 [overflow-wrap:anywhere] md:text-base">
                                <strong>Razão Social:</strong> {data.socialReason || "Não informado"}
                            </span>
                        </div>
                        <div className="shrink-0">
                            <FiiAlert fiiCode={data.code} />
                        </div>
                    </div>
                </div>

                <SummaryCard
                    icon={<BarChart3 className="text-blue-400" />}
                    label="Ticker"
                    value={(
                        <Link href={`/fii/${data.code}`} className="font-bold text-indigo-200 hover:text-indigo-100">
                            {data.code}
                        </Link>
                    )}
                />

                <SummaryCard
                    icon={data.active ? <CheckCircle className="text-green-400" /> : <XCircle className="text-red-400" />}
                    label="Ativo"
                    value={data.active ? "Sim" : "Não"}
                />

                <SummaryCard
                    icon={data.isIFIX ? <CheckCircle className="text-green-400" /> : <XCircle className="text-red-400" />}
                    label="IFIX"
                    value={data.isIFIX ? "Sim" : "Não"}
                    glossaryHref="/glossario#ifix"
                />

                <SummaryCard
                    icon={<DollarSign className="text-green-400" />}
                    label="Preço"
                    value={data.price || "N/A"}
                    glossaryHref="/glossario#preco-cota"
                />

                <SummaryCard
                    icon={<Hash className="text-orange-400" />}
                    label="Total de cotas"
                    value={data.numberShares?.toLocaleString("pt-BR") || "N/A"}
                    glossaryHref="/glossario#cotas"
                />

                <SummaryCard
                    icon={<Building2 className="text-purple-400" />}
                    label="Segmento"
                    value={data.segment_new || data.segment || "N/A"}
                    glossaryHref="/glossario#segmentos"
                />
            </div>

            {data?.code && <AddToWalletButton ticker={data.code} />}

            <h3 className="mt-6 mb-2 flex items-center gap-2 text-xl font-bold">
                💰 Dividendos ({earningsYearData === data?.[`earnings${currentYear}`]
                    ? currentYear
                    : currentYear - 1}){" "}
                <GlossaryLink href="/glossario#dividendos-dy" />
            </h3>

            <div className="rounded-xl bg-gray-800 p-4">
                {dividends.length === 0 ? (
                    <p className="text-center text-gray-400">
                        Sem dados de dividendos para exibir.
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {dividends.map(([month, info]: any) => {
                            const monthPT = monthsPTBR[month] || month;
                            const value = parseFloat(
                                info.earnings.replace("R$ ", "").replace(",", ".")
                            );

                            return (
                                <li key={month} className="flex items-start gap-2 rounded-lg bg-gray-900/40 p-3">
                                    <CalendarDays className="mt-1 shrink-0 text-indigo-400" />
                                    <span className="min-w-0 break-words text-sm leading-6 [overflow-wrap:anywhere] md:text-base">
                                        <strong>{monthPT}:</strong>{" "}
                                        R$ {value.toFixed(3)} | Pago em {info.payment_date}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {isCurrentMonthMissing && data?.code && (
                    <UpdateDividendButton ticker={data.code} onSuccess={onDividendUpdate} />
                )}
            </div>

            <h3 className="mt-6 mb-2 text-xl font-bold">
                <TrendingUp size={24} className="mr-2 inline-block text-indigo-400" />
                Planejamento Financeiro
            </h3>

            <SimulationCard
                lastDividend={lastDividend}
                price={parseFloat(data.price.replace("R$ ", "").replace(",", "."))}
                basicSalary={Number(process.env.NEXT_PUBLIC_BASIC_SALARY)}
            />
        </div>
    );
}
