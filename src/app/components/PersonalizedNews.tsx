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
    sources?: Source[];
    loading: boolean;
}

const buildGoogleSearchUrl = (ticker: string) => {
    const query = `${ticker} FII site oficial administradora gestor relatório gerencial fatos relevantes dividendos`;
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
};

export default function PersonalizedNews() {
    const [news, setNews] = useState<FiiNews[]>([]);
    const [loadingFII, setLoadingFII] = useState(false);
    const [error, setError] = useState("");

    const prepareSearchLink = async (ticker: string) => {
        setNews((prev) => [
            { ticker, sources: [], loading: true },
            ...prev.filter((f) => f.ticker !== ticker),
        ]);

        const googleUrl = buildGoogleSearchUrl(ticker);

        setNews((prev) =>
            prev.map((fii) =>
                fii.ticker === ticker
                    ? {
                        ...fii,
                        sources: [
                            {
                                url: googleUrl,
                                metadata: {
                                    source: `Buscar site oficial e administradora de ${ticker}`,
                                    favicon: "https://www.google.com/favicon.ico",
                                },
                            },
                        ],
                        loading: false,
                    }
                    : fii
            )
        );
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
                setNews(topFiis.map((ticker) => ({ ticker, sources: [], loading: true })));

                await Promise.all(topFiis.map(prepareSearchLink));
            } catch (err: any) {
                console.error(err);
                setError("Não foi possível carregar os FIIs mais consultados.");
            } finally {
                setLoadingFII(false);
            }
        };

        loadTopFiis();
    }, []);

    if (loadingFII)
        return (
            <p className="flex items-center justify-center text-gray-500 italic mt-4">
                <Loader2 className="animate-spin mr-2" size={20} /> Carregando FIIs mais consultados enquanto você pesquisa...
            </p>
        );
    if (error) return <p className="text-red-500">{error}</p>;

    return (
        <div className="mt-12">
            <h2 className="text-xl font-bold mb-4">📰 Resumo das notícias dos FIIs mais buscados por você</h2>
            {news.length === 0 && <p className="text-gray-500">Nenhuma pesquisa registrada ainda.</p>}
            <br />
            <div className="grid md:grid-cols-3 gap-6">
                {news.map(({ ticker, sources, loading }) => (
                    <div key={ticker} className="bg-white rounded-2xl shadow-md p-5 text-left">
                        <div className="flex items-center gap-2 mb-3">
                            <Newspaper className="text-indigo-600" />
                            <h3 className="text-lg font-semibold text-gray-400">{ticker}</h3>
                        </div>

                        {loading ? (
                            <p className="flex items-center gap-2 text-gray-600 italic">
                                <Loader2 className="animate-spin" size={16} /> Preparando pesquisa...
                            </p>
                        ) : (
                            sources && sources.length > 0 && (
                                <a
                                    href={sources[0].url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 hover:underline"
                                >
                                    {sources[0].metadata?.favicon && (
                                        <img
                                            src={sources[0].metadata.favicon}
                                            alt="Google"
                                            className="h-5 w-5"
                                        />
                                    )}
                                    <span>{sources[0].metadata?.source || `Pesquisar ${ticker} no Google`}</span>
                                    <LinkIcon size={14} />
                                </a>
                            )
                        )}
                    </div>
                ))}
            </div>
            <br /><br />
        </div>
    );
}
