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
    const [atStart, setAtStart] = useState(true);
    const [atEnd, setAtEnd] = useState(false);

    useEffect(() => {
        async function loadData() {
            try {
                const userRes = await fetch("/api/get-user");
                const userData = await userRes.json();

                if (!userData?.monitored) {
                    setFiis([]);
                    return;
                }

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

        // 🔄 Atualiza sempre que novos FIIs forem adicionados
        const handleUpdate = () => loadData();
        window.addEventListener("fiis-updated", handleUpdate);
        return () => window.removeEventListener("fiis-updated", handleUpdate);
    }, []);

    const handleScroll = (direction: "left" | "right") => {
        if (!scrollRef.current) return;

        const container = scrollRef.current;
        const cardWidth = 210 + 16; // largura + gap
        const maxScroll = container.scrollWidth - container.clientWidth;

        if (direction === "left") {
            const newScroll = Math.max(container.scrollLeft - cardWidth, 0);
            container.scrollTo({ left: newScroll, behavior: "smooth" });
        } else {
            const newScroll = Math.min(container.scrollLeft + cardWidth, maxScroll);
            container.scrollTo({ left: newScroll, behavior: "smooth" });
        }
    };

    // Define largura dinâmica do container
    const getContainerWidth = () => {
        if (fiis.length === 1) return "sm:max-w-[210px]";
        if (fiis.length === 2) return "sm:max-w-[420px]";
        return "sm:max-w-[525px]";
    };

    useEffect(() => {
        const container = scrollRef.current;
        if (!container) return;

        const handleCheck = () => {
            setAtStart(container.scrollLeft <= 0);
            setAtEnd(container.scrollLeft + container.clientWidth >= container.scrollWidth);
        };

        handleCheck();
        container.addEventListener("scroll", handleCheck);
        return () => container.removeEventListener("scroll", handleCheck);
    }, [fiis]);

    return (
        <aside className={`relative w-full mx-auto ${getContainerWidth()}`}>
            <h2 className="text-lg font-bold mb-4 text-white text-center">
                📊 FIIs Monitorados
            </h2>

            {fiis.length === 0 ? (
                <p className="text-center text-gray-400">Nenhum FII sendo monitorado</p>
            ) : (
                <div className="relative">
                    {/* Botão Esquerda (desktop apenas) */}
                    {fiis.length > 2 && (
                        <button
                            onClick={() => handleScroll("left")}
                            disabled={atStart}
                            className={`hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-gray-800 ${atStart ? "opacity-40 cursor-not-allowed" : ""
                                }`}
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                    )}

                    {/* Carrossel */}
                    <div
                        ref={scrollRef}
                        className="flex overflow-x-auto space-x-4 px-10 snap-x snap-mandatory scrollbar-hide"
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
                                        <span style={{ color: "red" }}>▼</span> {fii.percentDown}% /{" "}
                                        <span style={{ color: "green" }}>▲</span> {fii.percentUp}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Botão Direita (desktop apenas) */}
                    {fiis.length > 2 && (
                        <button
                            onClick={() => handleScroll("right")}
                            disabled={atEnd}
                            className={`hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-gray-800 ${atEnd ? "opacity-40 cursor-not-allowed" : ""
                                }`}
                        >
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    )}
                </div>
            )}
        </aside>
    );
}
