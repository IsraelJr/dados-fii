'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";

const STORAGE_KEY = "dados-fii-wallet-v1";
const CALENDAR_CACHE_KEY = "dados-fii-home-calendar-cache-v1";
const MONTHS_PTBR: Record<string, string> = {
    January: "Janeiro",
    February: "Fevereiro",
    March: "Março",
    April: "Abril",
    May: "Maio",
    June: "Junho",
    July: "Julho",
    August: "Agosto",
    September: "Setembro",
    October: "Outubro",
    November: "Novembro",
    December: "Dezembro",
};

type WalletItem = {
    ticker: string;
    quotas?: number;
};

type CalendarItem = {
    ticker: string;
    source: "Carteira" | "Mais pesquisado";
    month: string;
    earnings: string;
    paymentDate: string;
    dateWith?: string;
    quotas?: number;
    estimatedAmount?: number;
    paymentKey: string;
};

type HomeCalendarCache = {
    dateKey: string;
    tickersKey: string;
    events: CalendarItem[];
};

function parseCurrency(value: unknown) {
    if (typeof value === "number") return value;
    return Number(
        String(value || "0")
            .replace("R$", "")
            .replace(/\./g, "")
            .replace(",", ".")
            .trim()
    ) || 0;
}

function formatCurrency(value: number) {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDividend(value: unknown) {
    const parsed = parseCurrency(value);
    if (!parsed) return "-";
    return `R$ ${parsed.toFixed(3).replace(".", ",")}`;
}

function parseDateKey(value: string) {
    const [day, month, year] = String(value || "").split("/").map(Number);
    if (!day || !month || !year) return "9999-12-31";
    return new Date(year, month - 1, day).toISOString().slice(0, 10);
}

function todayKey() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().slice(0, 10);
}

function readWallet(): WalletItem[] {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((item: any) => ({ ticker: String(item.ticker || "").toUpperCase(), quotas: Number(item.quotas) || 0 }))
            .filter((item: WalletItem) => item.ticker);
    } catch {
        return [];
    }
}

function readCache(tickersKey: string): CalendarItem[] | null {
    try {
        const stored = window.localStorage.getItem(CALENDAR_CACHE_KEY);
        if (!stored) return null;
        const parsed = JSON.parse(stored) as HomeCalendarCache;
        if (parsed.dateKey !== todayKey()) return null;
        if (parsed.tickersKey !== tickersKey) return null;
        return Array.isArray(parsed.events) ? parsed.events : null;
    } catch {
        return null;
    }
}

function readLatestCache(): CalendarItem[] {
    if (typeof window === "undefined") return [];

    try {
        const stored = window.localStorage.getItem(CALENDAR_CACHE_KEY);
        if (!stored) return [];

        const parsed = JSON.parse(stored) as HomeCalendarCache;
        if (parsed.dateKey !== todayKey()) return [];

        return Array.isArray(parsed.events) ? parsed.events.slice(0, 3) : [];
    } catch {
        return [];
    }
}

function saveCache(tickersKey: string, events: CalendarItem[]) {
    try {
        const payload: HomeCalendarCache = {
            dateKey: todayKey(),
            tickersKey,
            events: events.slice(0, 3),
        };
        window.localStorage.setItem(CALENDAR_CACHE_KEY, JSON.stringify(payload));
    } catch {
        return;
    }
}

function getCurrentYearData(data: any) {
    const year = new Date().getFullYear();
    return data?.[`earnings${year}`] || data?.[`earnings${year - 1}`] || {};
}

function chooseNextEventByTicker(items: CalendarItem[], orderedTickers: string[]) {
    const byTicker = new Map<string, CalendarItem>();

    items
        .sort((a, b) => a.paymentKey.localeCompare(b.paymentKey) || a.ticker.localeCompare(b.ticker))
        .forEach((item) => {
            if (!byTicker.has(item.ticker)) byTicker.set(item.ticker, item);
        });

    return orderedTickers
        .map((ticker) => byTicker.get(ticker))
        .filter(Boolean)
        .slice(0, 3) as CalendarItem[];
}

function selectHomeTickers(wallet: WalletItem[], topFiis: string[]) {
    const walletTickers = [...wallet]
        .filter((item) => item.ticker)
        .sort((a, b) => (Number(b.quotas) || 0) - (Number(a.quotas) || 0) || a.ticker.localeCompare(b.ticker))
        .map((item) => item.ticker);
    const fallbackTickers = topFiis.filter((ticker) => !walletTickers.includes(ticker));

    return Array.from(new Set([...walletTickers, ...fallbackTickers])).slice(0, 3);
}

function EventCard({ event, featured = false }: { event: CalendarItem; featured?: boolean }) {
    return (
        <Link
            href={`/fii/${event.ticker}`}
            className={`block rounded-2xl bg-gray-800 ring-1 ring-white/5 transition hover:bg-gray-700 ${featured ? "p-5 md:min-h-full" : "p-4"}`}
        >
            <div className="flex items-center justify-between gap-3">
                <strong className={`${featured ? "text-3xl" : "text-xl"} text-indigo-200`}>{event.ticker}</strong>
                <span className={`rounded-full px-2 py-1 text-xs font-bold ${event.source === "Carteira" ? "bg-green-500/20 text-green-200" : "bg-yellow-500/20 text-yellow-100"}`}>
                    {event.source}
                </span>
            </div>
            <p className={`${featured ? "mt-5 text-base" : "mt-3 text-sm"} text-gray-300`}>
                {MONTHS_PTBR[event.month] || event.month}: <strong className="text-green-300">{formatDividend(event.earnings)}</strong>
            </p>
            <p className={`${featured ? "mt-3 text-sm" : "mt-2 text-xs"} text-gray-400`}>
                Pagamento em {event.paymentDate}
            </p>
            {event.estimatedAmount !== undefined && (
                <p className={`${featured ? "mt-5 text-lg" : "mt-3 text-sm"} font-bold text-green-300`}>
                    Renda estimada: {formatCurrency(event.estimatedAmount)}
                </p>
            )}
        </Link>
    );
}

export default function HomeDividendCalendar() {
    const [wallet, setWallet] = useState<WalletItem[]>([]);
    const [topFiis, setTopFiis] = useState<string[]>([]);
    const [events, setEvents] = useState<CalendarItem[]>(() => readLatestCache());
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setWallet(readWallet());

        async function loadTopFiis() {
            try {
                const response = await fetch("/api/user-top-fiis");
                const data = await response.json();
                if (Array.isArray(data.topFiis)) {
                    setTopFiis(data.topFiis.map((ticker: string) => String(ticker).toUpperCase()).slice(0, 3));
                }
            } catch {
                setTopFiis([]);
            }
        }

        loadTopFiis();
    }, []);

    const tickers = useMemo(() => selectHomeTickers(wallet, topFiis), [wallet, topFiis]);
    const tickersKey = useMemo(() => tickers.join("|"), [tickers]);

    useEffect(() => {
        async function loadEvents() {
            if (!tickers.length) {
                if (!events.length) setEvents([]);
                return;
            }

            const cached = readCache(tickersKey);
            if (cached) {
                setEvents(cached.slice(0, 3));
                setLoading(false);
                return;
            }

            setLoading((current) => events.length ? current : true);
            const items: CalendarItem[] = [];
            const today = todayKey();

            for (const ticker of tickers) {
                try {
                    const response = await fetch(`/api/fii?ticker=${ticker}`);
                    const data = await response.json();
                    if (!response.ok) continue;

                    const yearData = getCurrentYearData(data);
                    const walletItem = wallet.find((item) => item.ticker === ticker);
                    const source = walletItem ? "Carteira" : "Mais pesquisado";

                    Object.entries(yearData).forEach(([month, info]: any) => {
                        if (!info?.payment_date) return;
                        const paymentKey = parseDateKey(info.payment_date);
                        if (paymentKey < today) return;

                        const dividend = parseCurrency(info.earnings);
                        items.push({
                            ticker,
                            source,
                            month,
                            earnings: info.earnings || "",
                            paymentDate: info.payment_date,
                            dateWith: info.date_with,
                            quotas: walletItem?.quotas,
                            estimatedAmount: walletItem?.quotas ? dividend * walletItem.quotas : undefined,
                            paymentKey,
                        });
                    });
                } catch {
                    continue;
                }
            }

            const nextEvents = chooseNextEventByTicker(items, tickers);
            setEvents(nextEvents);
            saveCache(tickersKey, nextEvents);
            setLoading(false);
        }

        loadEvents();
    }, [tickers, tickersKey, wallet, events.length]);

    if (!wallet.length && !topFiis.length && !events.length && !loading) return null;

    const featuredEvent = events[0];
    const sideEvents = events.slice(1, 3);

    return (
        <div className="mx-auto mt-6 max-w-4xl rounded-2xl border border-indigo-500/20 bg-gray-900 p-5 text-left text-gray-100 shadow-lg">
            <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-bold">
                        <CalendarDays className="text-green-300" /> Seu calendário de dividendos
                    </h2>
                    <p className="mt-1 text-sm text-gray-400">
                        Um resumo dos seus FIIs. Veja o restante na carteira.
                    </p>
                </div>
                <div className="flex flex-nowrap justify-start gap-2 md:justify-end">
                    <Link href="/carteira" className="whitespace-nowrap rounded-full bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">
                        Minha carteira
                    </Link>
                    <Link href="/calendario-dividendos-fiis" className="whitespace-nowrap rounded-full bg-gray-800 px-4 py-2 text-sm font-bold text-indigo-100 hover:bg-gray-700">
                        Calendário completo
                    </Link>
                </div>
            </div>

            {loading && !events.length ? (
                <p className="flex items-center justify-center gap-2 rounded-xl bg-gray-800 p-4 text-sm text-gray-400">
                    <Loader2 className="animate-spin" size={18} /> Buscando próximos pagamentos...
                </p>
            ) : !events.length ? (
                <div className="rounded-xl bg-gray-800 p-4 text-sm text-gray-400">
                    <p>Nenhum pagamento futuro encontrado para esses FIIs no momento.</p>
                    <p className="mt-1">Adicione FIIs à carteira para personalizar este bloco.</p>
                </div>
            ) : (
                <div className="grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
                    {featuredEvent && <EventCard event={featuredEvent} featured />}
                    <div className="grid gap-3">
                        {sideEvents.length ? (
                            sideEvents.map((event) => <EventCard key={`${event.ticker}-${event.paymentDate}-${event.month}`} event={event} />)
                        ) : (
                            <Link href="/carteira" className="flex min-h-32 items-center rounded-2xl border border-dashed border-gray-700 p-4 text-sm font-bold text-gray-300 hover:border-indigo-400 hover:text-indigo-200">
                                Adicione mais FIIs à carteira para completar este resumo.
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
