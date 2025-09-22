'use client';

import { useEffect, useState } from "react";
import { Loader2, Link as LinkIcon, Newspaper } from "lucide-react";

interface Source {
    url: string;
    metadata?: {
        source?: string;
        favicon?: string;
    };
}

interface FiiNews {
    ticker: string;
    summary: string;
    sources?: Source[];
    loading: boolean;
}

export default function PersonalizedNews() {
    const [news, setNews] = useState<FiiNews[]>([]);
    const [loadingFII, setLoadingFII] = useState(false);
    const [error, setError] = useState("");

    const isProduction = process.env.NODE_ENV === "production";

    const fetchSummary = async (ticker: string) => {
        setNews((prev) => [
            { ticker, summary: "", sources: [], loading: true },
            ...prev.filter((f) => f.ticker !== ticker),
        ]);

        if (!isProduction) {
            // Em ambientes que não sejam produção, exibe mensagem de teste
            setNews((prev) =>
                prev.map((fii) =>
                    fii.ticker === ticker
                        ? { ...fii, summary: "Sem consulta à API nesse ambiente", sources: [], loading: false }
                        : fii
                )
            );
            return;
        }

        try {
            const res = await fetch("/api/fii-summary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ticker }),
            });
            const json = await res.json();
            setNews((prev) =>
                prev.map((fii) =>
                    fii.ticker === ticker
                        ? { ...fii, summary: json.summary || "Sem resumo disponível", sources: json.sources || [], loading: false }
                        : fii
                )
            );
        } catch {
            setNews((prev) =>
                prev.map((fii) =>
                    fii.ticker === ticker
                        ? { ...fii, summary: "Erro ao buscar resumo", sources: [], loading: false }
                        : fii
                )
            );
        }
    };

    useEffect(() => {
        const loadTopFiis = async () => {
            setError("");

            try {
                const cookieRes = await fetch("/api/check-cookie");
                const cookieData = await cookieRes.json();
                if (!cookieData.hasCookie) {
                    setNews([]);
                    return;
                }

                const res = await fetch("/api/user-top-fiis");
                if (!res.ok) throw new Error(`Erro ao buscar FIIs mais buscados: ${res.status}`);
                const data = await res.json();
                const topFiis: string[] = data.topFiis || [];
                if (topFiis.length === 0) {
                    setNews([]);
                    return;
                }

                setLoadingFII(true);
                setNews(topFiis.map((ticker) => ({ ticker, summary: "", sources: [], loading: true })));

                await Promise.all(topFiis.map(fetchSummary));
            } catch (err: any) {
                console.error(err);
                setError("Não foi possível carregar as notícias personalizadas.");
            } finally {
                setLoadingFII(false);
            }
        };

        loadTopFiis();
    }, []);

    if (loadingFII)
        return (
            <p className="flex items-center justify-center text-gray-500 italic mt-4">
                <Loader2 className="animate-spin mr-2" size={20} /> Carregando notícias personalizadas enquanto você pesquisa um FII...
            </p>
        );
    if (error) return <p className="text-red-500">{error}</p>;

    return (
        <div className="mt-12">
            <h2 className="text-xl font-bold mb-4">📰 Resumo das notícias dos FIIs mais buscados por você</h2>
            {news.length === 0 && <p className="text-gray-500">Nenhuma pesquisa registrada ainda.</p>}
            <br />
            <div className="grid md:grid-cols-3 gap-6">
                {news.map(({ ticker, summary, sources, loading }) => (
                    <div key={ticker} className="bg-white rounded-2xl shadow-md p-5 text-left">
                        <div className="flex items-center gap-2 mb-3">
                            <Newspaper className="text-indigo-600" />
                            <h3 className="text-lg font-semibold text-gray-400">{ticker}</h3>
                        </div>

                        {loading ? (
                            <p className="flex items-center gap-2 text-gray-600 italic">
                                <Loader2 className="animate-spin" size={16} /> Carregando resumo...
                            </p>
                        ) : (
                            <>
                                <p className="text-gray-800">{summary}</p>

                                {sources && sources.length > 0 && (
                                    <div className="mt-3">
                                        <h4 className="font-semibold text-sm text-gray-600 mb-1">Fontes:</h4>
                                        <ul className="list-disc list-inside space-y-1">
                                            {sources
                                                .filter((src) => typeof src.url === "string" && src.url.startsWith("http"))
                                                .map((src, idx) => (
                                                    <li key={idx}>
                                                        <a
                                                            href={src.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-indigo-600 text-sm flex items-center gap-1 hover:underline"
                                                        >
                                                            {src.metadata?.favicon && (
                                                                <img
                                                                    src={src.metadata.favicon}
                                                                    alt={src.metadata.source || ""}
                                                                    className="w-5 h-5"
                                                                />
                                                            )}
                                                            <span>{src.metadata?.source || src.url}</span>
                                                            <LinkIcon size={14} />
                                                        </a>
                                                    </li>
                                                ))}
                                        </ul>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                ))}
            </div>
            <br /><br />
        </div>
    );
}
