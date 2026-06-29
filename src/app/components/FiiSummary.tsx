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
            className="inline-flex items-center text-indigo-300 hover:text-indigo-100"
            title="Entenda este termo no glossário"
        >
            <HelpCircle size={14} aria-label="Glossário" />
        </Link>
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
        <div className="mt-8 mx-auto max-w-3xl p-6 rounded-2xl bg-gray-900 text-gray-100 shadow-lg">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-gray-800 p-4 rounded-xl flex items-center justify-between gap-2 col-span-2 md:col-span-3">
                    <div className="flex items-center gap-2">
                        <Building2 className="text-pink-400" />
                        <span><strong>Razão Social:</strong> {data.socialReason}</span>
                    </div>
                    <FiiAlert fiiCode={data.code} />
                </div>

                <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2">
                    <BarChart3 className="text-blue-400" />
                    <span>
                        <strong>Ticker:</strong>{" "}
                        <Link href={`/fii/${data.code}`} className="font-bold text-indigo-200 hover:text-indigo-100">
                            {data.code}
                        </Link>
                    </span>
                </div>

                <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2">
                    {data.active
                        ? <CheckCircle className="text-green-400" />
                        : <XCircle className="text-red-400" />}
                    <span><strong>Ativo:</strong> {data.active ? "Sim" : "Não"}</span>
                </div>

                <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2">
                    {data.isIFIX
                        ? <CheckCircle className="text-green-400" />
                        : <XCircle className="text-red-400" />}
                    <span className="flex items-center gap-1">
                        <strong>IFIX:</strong> {data.isIFIX ? "Sim" : "Não"}
                        <GlossaryLink href="/glossario#ifix" />
                    </span>
                </div>

                <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2">
                    <DollarSign className="text-green-400" />
                    <span className="flex items-center gap-1">
                        <strong>Preço:</strong> {data.price || "N/A"}
                        <GlossaryLink href="/glossario#preco-cota" />
                    </span>
                </div>

                <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2">
                    <Hash className="text-orange-400" />
                    <span className="flex items-center gap-1">
                        <strong>Total de Quotas:</strong>{" "}
                        {data.numberShares?.toLocaleString("pt-BR") || "N/A"}
                        <GlossaryLink href="/glossario#cotas" />
                    </span>
                </div>

                <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2">
                    <Building2 className="text-purple-400" />
                    <span className="flex items-center gap-1">
                        <strong>Segmento:</strong> {data.segment_new}
                        <GlossaryLink href="/glossario#segmentos" />
                    </span>
                </div>
            </div>

            {data?.code && <AddToWalletButton ticker={data.code} />}

            <h3 className="text-xl font-bold mt-6 mb-2">
                💰 Dividendos ({earningsYearData === data?.[`earnings${currentYear}`]
                    ? currentYear
                    : currentYear - 1}){" "}
                <GlossaryLink href="/glossario#dividendos-dy" />
            </h3>

            <div className="bg-gray-800 rounded-xl p-4">
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
                                <li key={month} className="flex items-center gap-2">
                                    <CalendarDays className="text-indigo-400" />
                                    <span>
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

            <h3 className="text-xl font-bold mt-6 mb-2">
                <TrendingUp size={24} className="text-indigo-400 inline-block mr-2" />
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
