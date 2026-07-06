'use client';

import { useEffect, useState } from "react";
import { Bot, Loader2, Link as LinkIcon, Newspaper } from "lucide-react";

type FiiNews = {
    ticker: string;
    title: string;
    summary: string;
    attentionPoints: string[];
    searchUrl: string;
    loading: boolean;
};

type NewsMode = "openai" | "perplexity" | "fallback" | "empty";

const buildGoogleSearchUrl = (ticker: string) => {
    const query = `${ticker} FII site oficial administradora gestor relatório gerencial fatos relevantes dividendos relatório gerencial`;
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
};

const buildFallbackInsight = (ticker: string): FiiNews => ({
    ticker,
    title: `Pesquisar ${ticker}`,
    summary: "",
    attentionPoints: [],
    searchUrl: buildGoogleSearchUrl(ticker),
    loading: false,
});

export default function PersonalizedNews() {
    const [news, setNews] = useState<FiiNews[]>([]);
    const [loadingFII, setLoadingFII] = useState(false);
    const [error, setError] = useState("");
    const [mode, setMode] = useState<NewsMode>("empty");

    useEffect(() => {
        const loadTopFiis = async () => {
            setError("");

            try {
                const cookieRes = await fetch("/api/check-cookie");
                const cookieData = await cookieRes.json();
                if (!cookieData.hasCookie) {
                    setNews([]);
                    setMode("empty");
                    return;
                }

                const res = await fetch("/api/user-top-fiis");
                if (!res.ok) throw new Error(`Erro ao buscar FIIs mais buscados: ${res.status}`);
                const data = await res.json();
                const topFiis: string[] = (data.topFiis || []).map((ticker: string) => String(ticker).toUpperCase()).slice(0, 3);
                if (topFiis.length === 0) {
                    setNews([]);
                    setMode("empty");
                    return;
                }

                setLoadingFII(true);
                setNews(topFiis.map((ticker) => ({ ...buildFallbackInsight(ticker), loading: true })));

                const aiResponse = await fetch("/api/personalized-fii-news", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tickers: topFiis }),
                });

                if (!aiResponse.ok) throw new Error(`Erro ao gerar resumo: ${aiResponse.status}`);

                const aiData = await aiResponse.json();
                const insights = Array.isArray(aiData.insights) ? aiData.insights : [];

                if (!insights.length) {
                    setMode("fallback");
                    setNews(topFiis.map(buildFallbackInsight));
                    return;
                }

                const nextMode: NewsMode = aiData.mode === "perplexity" || aiData.mode === "openai" ? aiData.mode : "fallback";
                setMode(nextMode);
                setNews(
                    topFiis.map((ticker) => {
                        const insight = insights.find((item: any) => String(item?.ticker || "").toUpperCase() === ticker);
                        const fallback = buildFallbackInsight(ticker);
                        if (!insight) return fallback;

                        return {
                            ticker,
                            title: String(insight.title || fallback.title),
                            summary: nextMode === "fallback" ? "" : String(insight.summary || fallback.summary),
                            attentionPoints: nextMode === "fallback"
                                ? []
                                : Array.isArray(insight.attentionPoints) && insight.attentionPoints.length
                                    ? insight.attentionPoints.map((point: unknown) => String(point)).filter(Boolean).slice(0, 3)
                                    : fallback.attentionPoints,
                            searchUrl: String(insight.searchUrl || fallback.searchUrl),
                            loading: false,
                        };
                    })
                );
            } catch (err: any) {
                console.error(err);
                setMode("fallback");
                setError("Não foi possível gerar o resumo personalizado agora.");
            } finally {
                setLoadingFII(false);
            }
        };

        loadTopFiis();
    }, []);

    if (loadingFII)
        return (
            <p className="flex items-center justify-center text-gray-500 italic mt-4">
                <Loader2 className="animate-spin mr-2" size={20} /> Gerando resumo dos FIIs mais consultados...
            </p>
        );

    return (
        <div className="mt-12 min-w-0">
            <div className="mb-4 flex flex-col items-center gap-2">
                <h2 className="text-center text-xl font-bold">📰 Resumo dos FIIs mais buscados por você</h2>
                {(mode === "openai" || mode === "perplexity") && (
                    <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                        <Bot size={14} /> Resumo gerado por IA
                    </p>
                )}
                {mode === "fallback" && (
                    <p className="text-sm text-gray-500">Resumo indisponível no momento. Consulte as fontes oficiais.</p>
                )}
            </div>

            {error && <p className="mb-3 text-sm text-yellow-600">{error}</p>}
            {news.length === 0 && <p className="text-gray-500">Nenhuma pesquisa registrada ainda.</p>}
            <br />

            <div className="grid min-w-0 gap-6 md:grid-cols-3">
                {news.map(({ ticker, title, summary, attentionPoints, searchUrl, loading }) => (
                    <div key={ticker} className="min-w-0 overflow-hidden rounded-2xl bg-white p-5 text-left shadow-md ring-1 ring-slate-100">
                        <div className="mb-3 flex min-w-0 items-center gap-2">
                            <Newspaper className="shrink-0 text-indigo-600" />
                            <h3 className="min-w-0 truncate text-lg font-semibold text-gray-700">{ticker}</h3>
                        </div>

                        {loading ? (
                            <p className="flex items-center gap-2 text-gray-600 italic">
                                <Loader2 className="animate-spin" size={16} /> Preparando resumo...
                            </p>
                        ) : (
                            <>
                                {title && <p className="min-w-0 break-words text-sm font-bold text-gray-800">{title}</p>}
                                {summary && <p className="mt-2 min-w-0 whitespace-pre-wrap break-words text-sm leading-6 text-gray-600">{summary}</p>}

                                {!!attentionPoints.length && (
                                    <ul className="mt-3 min-w-0 space-y-2 text-sm text-gray-600">
                                        {attentionPoints.map((point) => (
                                            <li key={`${ticker}-${point}`} className="min-w-0 overflow-hidden break-words rounded-lg bg-gray-50 p-2">
                                                {point}
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <a
                                    href={searchUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-4 inline-flex max-w-full items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 hover:underline"
                                >
                                    <span className="min-w-0 break-words">Pesquisar fontes oficiais</span> <LinkIcon className="shrink-0" size={14} />
                                </a>
                            </>
                        )}
                    </div>
                ))}
            </div>
            <br /><br />
        </div>
    );
}
