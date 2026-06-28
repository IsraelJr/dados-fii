'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart3, BookOpen, Loader2, Newspaper } from "lucide-react";

interface FiiInsight {
    ticker: string;
}

export default function PersonalizedNews() {
    const [fiis, setFiis] = useState<FiiInsight[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadTopFiis = async () => {
            setError("");
            setLoading(true);

            try {
                const cookieRes = await fetch("/api/check-cookie");
                const cookieData = await cookieRes.json();

                if (!cookieData.hasCookie) {
                    setFiis([]);
                    return;
                }

                const res = await fetch("/api/user-top-fiis");
                if (!res.ok) throw new Error(`Erro ao buscar FIIs mais consultados: ${res.status}`);

                const data = await res.json();
                const topFiis: string[] = data.topFiis || [];
                setFiis(topFiis.map((ticker) => ({ ticker })));
            } catch (err) {
                console.error(err);
                setError("Não foi possível carregar seus FIIs mais consultados.");
            } finally {
                setLoading(false);
            }
        };

        loadTopFiis();
    }, []);

    if (loading) {
        return (
            <p className="mt-4 flex items-center justify-center text-gray-500 italic">
                <Loader2 className="mr-2 animate-spin" size={20} /> Carregando FIIs mais consultados...
            </p>
        );
    }

    if (error) return <p className="text-red-500">{error}</p>;

    return (
        <section className="mt-12">
            <div className="mb-4 text-center">
                <h2 className="text-xl font-bold">📌 FIIs mais consultados por você</h2>
                <p className="mt-2 text-sm text-gray-500">
                    Esta área não usa IA. Ela mostra seus tickers mais pesquisados e direciona para conceitos úteis de análise.
                </p>
            </div>

            {fiis.length === 0 ? (
                <p className="text-gray-500">Nenhuma pesquisa registrada ainda.</p>
            ) : (
                <div className="grid gap-6 md:grid-cols-3">
                    {fiis.map(({ ticker }) => (
                        <article key={ticker} className="rounded-2xl bg-white p-5 text-left shadow-md">
                            <div className="mb-3 flex items-center gap-2">
                                <Newspaper className="text-indigo-600" />
                                <h3 className="text-lg font-semibold text-gray-700">{ticker}</h3>
                            </div>

                            <p className="text-sm text-gray-700">
                                Antes de decidir aumentar posição, compare preço, dividendos, segmento, liquidez, participação no IFIX e riscos específicos do tipo de fundo.
                            </p>

                            <div className="mt-4 space-y-2 text-sm">
                                <Link
                                    href="/glossario#dividendos-dy"
                                    className="flex items-center gap-2 text-indigo-600 hover:underline"
                                >
                                    <BarChart3 size={16} /> Entender dividendos e DY
                                </Link>
                                <Link
                                    href="/glossario#segmentos"
                                    className="flex items-center gap-2 text-indigo-600 hover:underline"
                                >
                                    <BookOpen size={16} /> Ver riscos por segmento
                                </Link>
                                <Link
                                    href="/glossario#ifix"
                                    className="flex items-center gap-2 text-indigo-600 hover:underline"
                                >
                                    <BookOpen size={16} /> Entender IFIX e liquidez
                                </Link>
                            </div>

                            <div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-500">
                                Recurso premium futuro: resumo automático com IA, notícias recentes e alertas personalizados.
                            </div>
                        </article>
                    ))}
                </div>
            )}

            <div className="mt-6 text-center text-sm text-gray-500">
                <Link href="/glossario" className="font-medium text-indigo-600 hover:underline">
                    Abrir glossário completo de FIIs
                </Link>
            </div>
        </section>
    );
}
