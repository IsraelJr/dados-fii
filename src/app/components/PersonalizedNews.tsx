'use client';

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
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

type NewsMode = "openai" | "perplexity" | "fallback" | "empty" | "cache";
type CachedFiiNews = FiiNews & { cachedAt: number; expiresAt: number };

const LOCAL_NEWS_CACHE_KEY = "dados-fii-ai-summary-cache-v1";
const WALLET_STORAGE_KEY = "dados-fii-wallet-v1";
const LOCAL_NEWS_CACHE_TTL_DAYS = 5;
const LOCAL_NEWS_CACHE_TTL_MS = LOCAL_NEWS_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

function normalizeTicker(value: unknown) {
    return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function readWalletTickers() {
    if (typeof window === "undefined") return [];
    try {
        const parsed = JSON.parse(window.localStorage.getItem(WALLET_STORAGE_KEY) || "[]");
        if (!Array.isArray(parsed)) return [];
        return Array.from(new Set(parsed.map((item) => normalizeTicker(item?.ticker)).filter(Boolean)));
    } catch {
        return [];
    }
}

const buildGoogleSearchUrl = (ticker: string) => {
    const query = `${ticker} FII site oficial administradora gestor relatório gerencial fatos relevantes dividendos`;
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

function cacheKeyForTickers(tickers: string[]) {
    return tickers.map(normalizeTicker).filter(Boolean).sort().join("|");
}

function readLocalNewsCache(tickers: string[]) {
    if (typeof window === "undefined" || !tickers.length) return null;
    try {
        const stored = window.localStorage.getItem(LOCAL_NEWS_CACHE_KEY);
        if (!stored) return null;
        const parsed = JSON.parse(stored) as { byGroup?: Record<string, CachedFiiNews[]>; byTicker?: Record<string, CachedFiiNews> };
        const now = Date.now();
        const groupKey = cacheKeyForTickers(tickers);
        const groupCache = parsed?.byGroup?.[groupKey];
        if (Array.isArray(groupCache) && groupCache.length === tickers.length && groupCache.every((item) => item.expiresAt > now)) {
            return groupCache.map((item) => ({ ...item, loading: false }));
        }

        const byTicker = parsed?.byTicker || {};
        const cached = tickers
            .map((ticker) => byTicker[ticker])
            .filter((item): item is CachedFiiNews => Boolean(item?.summary && item.expiresAt > now))
            .map((item) => ({ ...item, loading: false }));
        return cached.length === tickers.length ? cached : null;
    } catch {
        return null;
    }
}

function saveLocalNewsCache(insights: FiiNews[], ttlDays?: number) {
    if (typeof window === "undefined") return;
    try {
        const stored = window.localStorage.getItem(LOCAL_NEWS_CACHE_KEY);
        const parsed = stored ? JSON.parse(stored) : {};
        const byTicker: Record<string, CachedFiiNews> = parsed?.byTicker || {};
        const byGroup: Record<string, CachedFiiNews[]> = parsed?.byGroup || {};
        const now = Date.now();
        const ttlMs = Number(ttlDays) > 0 ? Number(ttlDays) * 24 * 60 * 60 * 1000 : LOCAL_NEWS_CACHE_TTL_MS;

        Object.entries(byTicker).forEach(([ticker, item]) => {
            if (!item?.expiresAt || item.expiresAt <= now) delete byTicker[ticker];
        });
        Object.entries(byGroup).forEach(([key, items]) => {
            if (!Array.isArray(items) || items.some((item) => !item?.expiresAt || item.expiresAt <= now)) delete byGroup[key];
        });

        const cachedInsights = insights
            .filter((item) => item.summary)
            .map((item) => ({ ...item, loading: false, cachedAt: now, expiresAt: now + ttlMs }));

        cachedInsights.forEach((item) => { byTicker[item.ticker] = item; });
        if (cachedInsights.length) byGroup[cacheKeyForTickers(cachedInsights.map((item) => item.ticker))] = cachedInsights;
        window.localStorage.setItem(LOCAL_NEWS_CACHE_KEY, JSON.stringify({ byTicker, byGroup }));
    } catch {
        return;
    }
}

function friendlySourceName(url: string, index: number, fallbackLabel?: string) {
    const cleanFallback = String(fallbackLabel || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/^\[|\]$/g, "").trim();
    try {
        const hostname = new URL(url).hostname.replace(/^www\./i, "");
        const knownNames: Record<string, string> = {
            "b3.com.br": "B3",
            "fundsexplorer.com.br": "Funds Explorer",
            "fiis.com.br": "FIIs.com.br",
            "statusinvest.com.br": "Status Invest",
            "clubefii.com.br": "Clube FII",
            "investidor10.com.br": "Investidor10",
            "suno.com.br": "Suno",
            "infomoney.com.br": "InfoMoney",
            "valor.globo.com": "Valor Econômico",
            "meusdividendos.com": "Meus Dividendos",
            "meusdividendos.com.br": "Meus Dividendos",
        };
        const known = Object.entries(knownNames).find(([domain]) => hostname.endsWith(domain));
        if (known?.[1]) return known[1];
        if (cleanFallback && cleanFallback.length <= 40 && !/^[()\[\]]+$/.test(cleanFallback)) return cleanFallback;
        return hostname ? `Ver fonte: ${hostname}` : `Ver fonte ${index + 1}`;
    } catch {
        return cleanFallback && cleanFallback.length <= 40 ? cleanFallback : `Ver fonte ${index + 1}`;
    }
}

function normalizeTextUrl(rawUrl: string) {
    return rawUrl.replace(/[\]),.;:]+$/g, "");
}

function renderTextWithFriendlyLinks(text: string) {
    const markdownOrUrlRegex = /(\(?\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)\)?|https?:\/\/[^\s]+)/gi;
    const nodes: ReactNode[] = [];
    let lastIndex = 0;
    let linkIndex = 0;

    for (const match of text.matchAll(markdownOrUrlRegex)) {
        const fullMatch = match[0];
        const start = match.index || 0;
        const labelFromMarkdown = match[2];
        const rawUrl = match[3] || fullMatch;
        if (start > lastIndex) nodes.push(text.slice(lastIndex, start));
        const url = normalizeTextUrl(rawUrl);
        const trailing = rawUrl.slice(url.length);
        const label = friendlySourceName(url, linkIndex++, labelFromMarkdown);
        nodes.push(
            <span key={`${url}-${start}`}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-900">
                    {label}
                </a>
                {trailing}
            </span>
        );
        lastIndex = start + fullMatch.length;
    }

    if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
    return nodes;
}

export default function PersonalizedNews() {
    const [news, setNews] = useState<FiiNews[]>([]);
    const [loadingFII, setLoadingFII] = useState(false);
    const [error, setError] = useState("");
    const [mode, setMode] = useState<NewsMode>("empty");
    const [walletTickers, setWalletTickers] = useState<string[]>([]);

    useEffect(() => {
        const loadTopFiis = async () => {
            setError("");
            const wallet = readWalletTickers();
            setWalletTickers(wallet);

            try {
                const cookieRes = await fetch("/api/check-cookie");
                const cookieData = await cookieRes.json();
                if (!cookieData.hasCookie) {
                    setNews([]);
                    setMode("empty");
                    return;
                }

                const params = new URLSearchParams({ limit: "3" });
                if (wallet.length) params.set("exclude", wallet.join(","));
                const res = await fetch(`/api/user-top-fiis?${params.toString()}`);
                if (!res.ok) throw new Error(`Erro ao buscar FIIs mais buscados: ${res.status}`);
                const data = await res.json();
                const topFiis: string[] = (data.topFiis || []).map(normalizeTicker).filter(Boolean).slice(0, 3);

                if (!topFiis.length) {
                    setNews([]);
                    setMode("empty");
                    return;
                }

                const localCache = readLocalNewsCache(topFiis);
                if (localCache) {
                    setMode("cache");
                    setNews(localCache);
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

                const nextMode: NewsMode = ["perplexity", "openai", "cache"].includes(aiData.mode) ? aiData.mode : "fallback";
                setMode(nextMode);

                const nextNews = topFiis.map((ticker) => {
                    const insight = insights.find((item: any) => normalizeTicker(item?.ticker) === ticker);
                    const fallback = buildFallbackInsight(ticker);
                    if (!insight) return fallback;
                    return {
                        ticker,
                        title: String(insight.title || fallback.title),
                        summary: nextMode === "fallback" ? "" : String(insight.summary || fallback.summary),
                        attentionPoints: nextMode === "fallback" ? [] : Array.isArray(insight.attentionPoints) ? insight.attentionPoints.map((point: unknown) => String(point)).filter(Boolean).slice(0, 3) : [],
                        searchUrl: String(insight.searchUrl || fallback.searchUrl),
                        reportTitle: String(insight.reportTitle || ""),
                        reportUrl: String(insight.reportUrl || ""),
                        loading: false,
                    };
                });

                setNews(nextNews);
                if (nextMode !== "fallback") saveLocalNewsCache(nextNews, aiData?.cache?.ttlDays);
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

    const reports = useMemo(() => news.filter((item) => item.reportUrl && /^https?:\/\//i.test(item.reportUrl)), [news]);

    if (loadingFII) {
        return (
            <p className="mt-4 flex items-center justify-center text-gray-500 italic">
                <Loader2 className="mr-2 animate-spin" size={20} /> Gerando resumo dos FIIs mais pesquisados fora da sua carteira...
            </p>
        );
    }

    return (
        <div className="mt-12 min-w-0">
            <div className="mb-4 flex flex-col items-center gap-2">
                <h2 className="text-center text-xl font-bold">📰 FIIs pesquisados por você fora da carteira</h2>
                <p className="max-w-2xl text-center text-sm text-gray-500">
                    Mostramos apenas fundos que você pesquisou e que ainda não estão na sua carteira salva neste navegador.
                </p>
                {(mode === "openai" || mode === "perplexity" || mode === "cache") && (
                    <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                        <Bot size={14} /> Resumo gerado por IA
                    </p>
                )}
                {mode === "fallback" && <p className="text-sm text-gray-500">Resumo indisponível no momento. Consulte as fontes oficiais.</p>}
            </div>

            {error && <p className="mb-3 text-sm text-yellow-600">{error}</p>}
            {news.length === 0 && (
                <p className="text-center text-gray-500">
                    {walletTickers.length ? "Nenhum FII pesquisado fora da sua carteira ainda." : "Nenhuma pesquisa registrada ainda."}
                </p>
            )}

            {!!news.length && (
                <section className="min-w-0 overflow-hidden rounded-2xl bg-white p-5 text-left shadow-md ring-1 ring-slate-100">
                    <div className="space-y-5">
                        {news.map(({ ticker, summary, attentionPoints, searchUrl, loading }) => (
                            <article key={ticker} className="min-w-0 border-b border-slate-100 pb-5 last:border-b-0 last:pb-0">
                                <h3 className="text-base font-extrabold text-gray-800">{ticker}</h3>
                                {loading ? (
                                    <p className="mt-2 flex items-center gap-2 text-gray-600 italic"><Loader2 className="animate-spin" size={16} /> Preparando resumo...</p>
                                ) : mode === "fallback" || !summary ? (
                                    <p className="mt-2 text-sm leading-6 text-gray-600">Não foi possível montar um resumo confiável agora. Consulte comunicados, relatório gerencial e fontes oficiais do fundo.</p>
                                ) : (
                                    <>
                                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-600">{renderTextWithFriendlyLinks(summary)}</p>
                                        {!!attentionPoints.length && <p className="mt-2 break-words text-sm leading-6 text-gray-600">{renderTextWithFriendlyLinks(attentionPoints.join(" "))}</p>}
                                    </>
                                )}
                                <a href={searchUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700">
                                    <LinkIcon size={14} /> Pesquisar fontes do {ticker}
                                </a>
                            </article>
                        ))}
                    </div>
                </section>
            )}

            {!!reports.length && (
                <section className="mt-5 rounded-2xl bg-slate-50 p-4 text-left ring-1 ring-slate-200">
                    <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-800"><FileText size={16} /> Relatórios encontrados</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {reports.map((item) => (
                            <a key={`${item.ticker}-${item.reportUrl}`} href={item.reportUrl} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white px-3 py-2 text-xs font-bold text-indigo-700 ring-1 ring-indigo-100 hover:bg-indigo-50">
                                {item.ticker}: {item.reportTitle || "ver relatório"}
                            </a>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
