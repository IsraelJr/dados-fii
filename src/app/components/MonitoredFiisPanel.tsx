// components/MonitoredFiisPanel.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface MonitoredFii {
    fiiCode: string;
    percentDown: number;
    percentUp: number;
}

interface FiiData {
    code: string;
    price: string;
    variation: number;
}

export default function MonitoredFiisPanel() {
    const [fiis, setFiis] = useState<(MonitoredFii & FiiData)[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function loadData() {
            try {
                const userRes = await fetch("/api/get-user");
                const userData = await userRes.json();

                if (!userData?.monitored) return;

                const monitored: MonitoredFii[] = userData.monitored;
                const listToFetch = userData.isPremium ? monitored : [monitored[0]];

                const fiiData = await Promise.all(
                    listToFetch.map(async (item) => {
                        const res = await fetch(`/api/fii?ticker=${item.fiiCode}`);
                        const data = await res.json();

                        return {
                            ...item,
                            code: data.code,
                            price: data.price,
                            variation: parseFloat((data.variation || "0").replace("%", "")),
                        };
                    })
                );

                setFiis(fiiData);
            } catch (err) {
                console.error("Erro ao carregar FIIs monitorados:", err);
            }
        }

        loadData();
    }, []);

    const scroll = (direction: "left" | "right") => {
        if (scrollRef.current) {
            const scrollAmount = 210; // largura base do card
            scrollRef.current.scrollBy({
                left: direction === "left" ? -scrollAmount : scrollAmount,
                behavior: "smooth",
            });
        }
    };

    // Define a largura do container de acordo com a quantidade de FIIs
    const getContainerWidth = () => {
        if (fiis.length === 1) return "max-w-[210px]";
        if (fiis.length === 2) return "max-w-[420px]";
        return "max-w-[525px]"; // 2.5 cards para 3 ou mais
    };

    return (
        <aside className={`relative w-full mx-auto ${getContainerWidth()}`}>
            <h2 className="text-lg font-bold mb-4 text-white text-center">
                📊 FIIs Monitorados
            </h2>

            {fiis.length === 0 ? (
                <p className="text-center text-gray-400">
                    Nenhum FII sendo monitorado
                </p>
            ) : (
                <div className="relative">
                    {/* Botão Esquerda */}
                    {fiis.length > 2 && (
                        <button
                            onClick={() => scroll("left")}
                            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-gray-800 p-2 rounded-full shadow-md hover:bg-gray-700"
                        >
                            <ChevronLeft className="w-5 h-5 text-white" />
                        </button>
                    )}

                    {/* Carrossel */}
                    <div
                        ref={scrollRef}
                        className={`flex ${fiis.length > 2 ? "overflow-hidden space-x-4 px-10" : "justify-center space-x-4"
                            }`}
                    >
                        {fiis.map((fii) => (
                            <div
                                key={fii.code}
                                className="flex-none w-[210px] snap-center bg-gray-900 text-white p-4 rounded-2xl shadow-lg"
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold">{fii.code}</span>
                                    <span className="text-sm text-gray-400">{fii.price}</span>
                                </div>
                                <div className="flex justify-between mt-2">
                                    <span
                                        className={`text-sm font-medium ${fii.variation >= 0 ? "text-green-500" : "text-red-500"
                                            }`}
                                    >
                                        {fii.variation.toFixed(2)}%
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        🔻 {fii.percentDown}% / 🔺 {fii.percentUp}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Botão Direita */}
                    {fiis.length > 2 && (
                        <button
                            onClick={() => scroll("right")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-gray-800 p-2 rounded-full shadow-md hover:bg-gray-700"
                        >
                            <ChevronRight className="w-5 h-5 text-white" />
                        </button>
                    )}
                </div>
            )}
        </aside>
    );
}
