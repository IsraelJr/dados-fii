'use client';

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

interface FII {
    code: string;
    price: string;
    variation: string; // ex: "-1,23" ou "0,45"
    name?: string;
}

export default function FiiTopPanels() {
    const [fiis, setFiis] = useState<FII[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFiis = async () => {
            try {
                const res = await fetch("/api/fii");
                const data: FII[] = await res.json();
                setFiis(data);
            } catch (err) {
                console.error("Erro ao buscar FIIs:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchFiis();
    }, []);

    if (loading) return <p>Carregando FIIs...</p>;

    // Converter variação para número
    const fiisWithVariation = fiis.map(fii => {
        let value = 0;
        if (fii.variation) {
            value = Number(fii.variation.replace(",", ".").replace("%", ""));
        }
        return { ...fii, variationNum: value };
    });

    const topAltas = [...fiisWithVariation]
        .sort((a, b) => b.variationNum - a.variationNum)
        .slice(0, 3);

    const topBaixas = [...fiisWithVariation]
        .sort((a, b) => a.variationNum - b.variationNum)
        .slice(0, 3);

    return (
        // <div className="bg-gray-900 p-4 rounded-xl max-w-sm mx-auto">
        //     <h3 className="text-center font-bold mb-2">📊 Top FIIs</h3>
        //     <ul className="space-y-1 text-sm">
        //         {topAltas.map(fii => (
        //             <li key={fii.code} className="flex justify-between">
        //                 <span>{fii.code}</span>
        //                 <span className={fii.variationNum >= 0 ? "text-green-400" : "text-red-400"}>
        //                     {fii.variationNum.toFixed(2)}%
        //                 </span>
        //             </li>
        //         ))}
        //     </ul>
        // </div>

        // <div className="flex justify-center gap-2 max-w-xs mx-auto">
        //     {topAltas.concat(topBaixas).map(fii => (
        //         <div
        //             key={fii.code}
        //             className={`p-2 rounded shadow text-xs ${fii.variationNum >= 0 ? "bg-green-800 text-green-200" : "bg-red-800 text-red-200"
        //                 }`}
        //         >
        //             <span className="font-bold">{fii.code}</span>: {fii.variationNum.toFixed(2)}%
        //         </div>
        //     ))}
        // </div>

        // <div className="flex justify-center gap-2">
        //     {topAltas.map(fii => (
        //         <span key={fii.code} className="relative group">
        //             <ArrowUp className="w-4 h-4 text-green-400" />
        //             <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 scale-0 group-hover:scale-100 bg-gray-800 text-white text-xs px-2 py-1 rounded">
        //                 {fii.code}: {fii.variationNum.toFixed(2)}%
        //             </span>
        //         </span>
        //     ))}
        //     {topBaixas.map(fii => (
        //         <span key={fii.code} className="relative group">
        //             <ArrowDown className="w-4 h-4 text-red-400" />
        //             <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 scale-0 group-hover:scale-100 bg-gray-800 text-white text-xs px-2 py-1 rounded">
        //                 {fii.code}: {fii.variationNum.toFixed(2)}%
        //             </span>
        //         </span>
        //     ))}
        // </div>

        <div className="flex flex-wrap justify-center gap-2 max-w-xs mx-auto">
            {topAltas.concat(topBaixas).map((fii, index) => {
                const variation = fii.variationNum ?? 0;
                const code = fii.code ?? "N/A";
                const price = fii.price ?? "N/A";

                return (
                    <div
                        key={`${code}-${index}`}
                        className={`p-2 rounded shadow text-xs cursor-pointer ${variation >= 0 ? "bg-green-800 text-green-200" : "bg-red-800 text-red-200"
                            }`}
                        title={`Preço atual: ${price}`} // Tooltip
                    >
                        <span className="font-bold">{code}</span>: {variation.toFixed(2)}%
                    </div>
                );
            })}
        </div>

    );
}
