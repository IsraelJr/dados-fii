'use client';

import { useEffect, useMemo, useState } from "react";
import { Bot, FileText, Loader2, Link as LinkIcon } from "lucide-react";

type FiiNews = {
    ticker: string;
    title: string;
    summary: string;
    attentionPoints: string[];
    searchUrl: string;
    reportTitle?: string;
    reportUrl?: string;
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
                            reportTitle: String(insight.reportTitle || ""),
                            reportUrl: String(insight.reportUrl || ""),
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

    const reports = useMemo(
        () => news.filter((item) => item.reportUrl && /^https?:\/\//i.test(item.reportUrl)),
        [news]
    );

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

            {!!news.length && (
                <section className="min-w-0 overflow-hidden rounded-2xl bg-white p-5 text-left shadow-md ring-1 ring-slate-100">
                    <div className="space-y-5">
                        {news.map(({ ticker, title, summary, attentionPoints, searchUrl, loading }) => (
                            <article key={ticker} className="min-w-0 border-b border-slate-100 pb-5 last:border-b-0 last:pb-0">
                                <h3 className="text-base font-extrabold text-gray-800">{ticker}</h3>

                                {loading ? (
                                    <p className="mt-2 flex items-center gap-2 text-gray-600 italic">
                                        <Loader2 className="animate-spin" size={16} /> Preparando resumo...
                                    </p>
                                ) : mode === "fallback" || !summary ? (
                                    <p className="mt-2 text-sm leading-6 text-gray-600">
                                        Não foi possível montar um resumo confiável agora. Consulte comunicados, relatório gerencial e fontes oficiais do fundo.
                                    </p>
                                ) : (
                                    <>
                                        {title && <p className="mt-1 break-words text-sm font-bold text-gray-800">{title}</p>}
                                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-600">{summary}</p>

                                        {!!attentionPoints.length && (
                                            <p className="mt-2 break-words text-sm leading-6 text-gray-600">
                                                {attentionPoints.join(" ")}
                                            </p>
                                        )}
                                    </>
                                )}

                                {mode === "fallback" && (
                                    <a
                                        href={searchUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-4 inline-flex max-w-full items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 hover:underline"
                                    >
                                        <span className="min-w-0 break-words">Pesquisar fontes oficiais</span> <LinkIcon className="shrink-0" size={14} />
                                    </a>
                                )}
                            </article>
                        ))}
                    </div>
                </section>
            )}

            {!!reports.length && (
                <section className="mt-4 grid min-w-0 gap-3 md:grid-cols-3">
                    {reports.map((item) => (
                        <a
                            key={`${item.ticker}-${item.reportUrl}`}
                            href={item.reportUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-0 overflow-hidden rounded-2xl bg-white p-4 text-left shadow-md ring-1 ring-slate-100 hover:bg-indigo-50"
                        >
                            <div className="flex items-center gap-2 text-indigo-700">
                                <FileText className="shrink-0" size={18} />
                                <strong className="truncate text-sm">{item.ticker}</strong>
                            </div>
                            <p className="mt-2 break-words text-sm font-bold text-gray-800">
                                {item.reportTitle || `Relatório gerencial de ${item.ticker}`}
                            </p>
                            <p className="mt-1 text-xs font-medium text-gray-500">Abrir relatório gerencial</p>
                        </a>
                    ))}
                </section>
            )}

            <br /><br />
        </div>
    );
}
