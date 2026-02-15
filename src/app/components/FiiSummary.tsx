// 'use client';

// import { CalendarDays, CheckCircle, XCircle, DollarSign, Building2, BarChart3, Hash, TrendingUp } from "lucide-react";
// import { SimulationCard } from "./SimulationCard";
// import FiiAlert from "./FiiAlert";

// interface Props {
//     data: any;
//     getCurrentYearDividends: (yearData: any) => [string, any][];
//     monthsPTBR: Record<string, string>;
//     lastDividend: number | null;
// }

// export default function FiiSummary({ data, getCurrentYearDividends, monthsPTBR, lastDividend }: Props) {
//     const userCookie = "67e480e3-456b-4d81-83d5-9470587a652d"; // TODO: obter dinamicamente, ex: do cookie ou auth

//     return (
//         <div className="mt-8 mx-auto max-w-3xl p-6 rounded-2xl bg-gray-900 text-gray-100 shadow-lg">
//             {/* FII Details */}
//             <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
//                 <div className="bg-gray-800 p-4 rounded-xl flex items-center justify-between gap-2 col-span-2 md:col-span-3">
//                     <div className="flex items-center gap-2">
//                         <Building2 className="text-pink-400" />
//                         <span><strong>Razão Social:</strong> {data.socialReason}</span>
//                     </div>
//                     {/* Sino com popover */}
//                     <FiiAlert fiiCode={data.code} />
//                 </div>
//                 <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2">
//                     <BarChart3 className="text-blue-400" />
//                     <span><strong>Ticker:</strong> {data.code}</span>
//                 </div>
//                 <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2">
//                     {data.active ? <CheckCircle className="text-green-400" /> : <XCircle className="text-red-400" />}
//                     <span><strong>Ativo:</strong> {data.active ? "Sim" : "Não"}</span>
//                 </div>
//                 <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2">
//                     {data.isIFIX ? <CheckCircle className="text-green-400" /> : <XCircle className="text-red-400" />}
//                     <span><strong>IFIX:</strong> {data.isIFIX ? "Sim" : "Não"}</span>
//                 </div>
//                 <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2">
//                     <DollarSign className="text-green-400" />
//                     <span><strong>Preço:</strong> {data.price || "N/A"}</span>
//                 </div>
//                 <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2">
//                     <Hash className="text-orange-400" />
//                     <span><strong>Total de Quotas:</strong> {data.numberShares?.toLocaleString("pt-BR") || "N/A"}</span>
//                 </div>
//                 <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2">
//                     <Building2 className="text-purple-400" />
//                     <span><strong>Segmento:</strong> {data.segment_new}</span>
//                 </div>
//             </div>

//             {/* Dividendos */}
//             <h3 className="text-xl font-bold mt-6 mb-2">
//                 💰 Dividendos ({new Date().getFullYear()})
//             </h3>
//             <div className="bg-gray-800 rounded-xl p-4">
//                 {(!data.earnings2025 || getCurrentYearDividends(data.earnings2025).length === 0) ? (
//                     <p className="bg-gray-800 p-4 rounded-xl text-center text-gray-400">Sem dados para exibir.</p>
//                 ) : (
//                     <ul className="space-y-2">
//                         {getCurrentYearDividends(data.earnings2025).map(([month, info]: any) => {
//                             const monthPT = monthsPTBR[month] || month;
//                             const value = parseFloat(info.earnings.replace("R$ ", "").replace(",", "."));
//                             return (
//                                 <li key={month} className="flex items-center gap-2">
//                                     <CalendarDays className="text-indigo-400" />
//                                     <span>
//                                         <strong>{monthPT}:</strong> R$ {value.toFixed(3)} | Pago em {info.payment_date}
//                                     </span>
//                                 </li>
//                             );
//                         })}
//                     </ul>
//                 )}
//             </div>

//             {/* Simulações */}
//             <h3 className="text-xl font-bold mt-6 mb-2">
//                 <TrendingUp size={24} className="text-indigo-400 inline-block mr-2" />
//                 Planejamento Financeiro
//             </h3>

//             <SimulationCard
//                 lastDividend={lastDividend}
//                 price={parseFloat(data.price.replace("R$ ", "").replace(",", "."))}
//                 basicSalary={Number(process.env.NEXT_PUBLIC_BASIC_SALARY)}
//             />
//         </div>
//     );
// }
'use client';

import {
    CalendarDays,
    CheckCircle,
    XCircle,
    DollarSign,
    Building2,
    BarChart3,
    Hash,
    TrendingUp
} from "lucide-react";
import { SimulationCard } from "./SimulationCard";
import FiiAlert from "./FiiAlert";

interface Props {
    data: any;
    getCurrentYearDividends: (yearData: any) => [string, any][];
    monthsPTBR: Record<string, string>;
    lastDividend: number | null;
}

export default function FiiSummary({
    data,
    getCurrentYearDividends,
    monthsPTBR,
    lastDividend
}: Props) {

    const currentYear = new Date().getFullYear();

    // 🔹 tenta pegar o ano atual, senão pega o último ano disponível
    const earningsYearData =
        data?.[`earnings${currentYear}`] ||
        data?.[`earnings${currentYear - 1}`] ||
        {};

    const dividends = getCurrentYearDividends(earningsYearData);

    return (
        <div className="mt-8 mx-auto max-w-3xl p-6 rounded-2xl bg-gray-900 text-gray-100 shadow-lg">

            {/* FII Details */}
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
                    <span><strong>Ticker:</strong> {data.code}</span>
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
                    <span><strong>IFIX:</strong> {data.isIFIX ? "Sim" : "Não"}</span>
                </div>

                <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2">
                    <DollarSign className="text-green-400" />
                    <span><strong>Preço:</strong> {data.price || "N/A"}</span>
                </div>

                <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2">
                    <Hash className="text-orange-400" />
                    <span>
                        <strong>Total de Quotas:</strong>{" "}
                        {data.numberShares?.toLocaleString("pt-BR") || "N/A"}
                    </span>
                </div>

                <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2">
                    <Building2 className="text-purple-400" />
                    <span><strong>Segmento:</strong> {data.segment_new}</span>
                </div>
            </div>

            {/* Dividendos */}
            <h3 className="text-xl font-bold mt-6 mb-2">
                💰 Dividendos ({earningsYearData === data?.[`earnings${currentYear}`]
                    ? currentYear
                    : currentYear - 1})
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
            </div>

            {/* Simulações */}
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
