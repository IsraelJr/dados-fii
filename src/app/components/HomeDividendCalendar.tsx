'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, Wallet } from "lucide-react";

const STORAGE_KEY = "dados-fii-wallet-v1";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
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

function getCurrentYearData(data: any) {
    const year = new Date().getFullYear();
    return data?.[`earnings${year}`] || data?.[`earnings${year - 1}`] || {};
}

export default function HomeDividendCalendar() {
    const [wallet, setWallet] = useState<WalletItem[]>([]);
    const [topFiis, setTopFiis] = useState<string[]>([]);
    const [events, setEvents] = useState<CalendarItem[]>([]);
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

    const tickers = useMemo(() => {
        const walletTickers = wallet.map((item) => item.ticker);
        return Array.from(new Set([...walletTickers, ...topFiis])).slice(0, 12);
    }, [wallet, topFiis]);

    useEffect(() => {
        async function loadEvents() {
            if (!tickers.length) {
                setEvents([]);
                return;
            }

            setLoading(true);
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

            items.sort((a, b) => a.paymentKey.localeCompare(b.paymentKey) || a.ticker.localeCompare(b.ticker));
            setEvents(items.slice(0, 6));
            setLoading(false);
        }

        loadEvents();
    }, [tickers, wallet]);

    if (!wallet.length && !topFiis.length && !loading) return null;

    return (
        <div className="mx-auto mt-6 max-w-4xl rounded-2xl border border-indigo-500/20 bg-gray-900 p-5 text-left text-gray-100 shadow-lg">
            <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-bold">
                        <CalendarDays className="text-green-300" /> Seu calendário de dividendos
                    </h2>
                    <p className="mt-1 text-sm text-gray-400">
                        Próximos pagamentos dos FIIs da sua carteira e dos 3 mais pesquisados por você.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link href="/carteira" className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">
                        <Wallet size={16} /> Minha carteira
                    </Link>
                    <Link href="/calendario-dividendos-fiis" className="rounded-full bg-gray-800 px-4 py-2 text-sm font-bold text-indigo-100 hover:bg-gray-700">
                        Calendário completo
                    </Link>
                </div>
            </div>

            {loading ? (
                <p className="flex items-center justify-center gap-2 rounded-xl bg-gray-800 p-4 text-sm text-gray-400">
                    <Loader2 className="animate-spin" size={18} /> Buscando próximos pagamentos...
                </p>
            ) : !events.length ? (
                <div className="rounded-xl bg-gray-800 p-4 text-sm text-gray-400">
                    <p>Nenhum pagamento futuro encontrado para esses FIIs no momento.</p>
                    <p className="mt-1">Adicione FIIs à carteira para personalizar este bloco.</p>
                </div>
            ) : (
                <div className="grid gap-3 md:grid-cols-2">
                    {events.map((event) => (
                        <div key={`${event.ticker}-${event.paymentDate}-${event.month}`} className="rounded-xl bg-gray-800 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <strong className="text-indigo-200">{event.ticker}</strong>
                                <span className={`rounded-full px-2 py-1 text-xs font-bold ${event.source === "Carteira" ? "bg-green-500/20 text-green-200" : "bg-yellow-500/20 text-yellow-100"}`}>
                                    {event.source}
                                </span>
                            </div>
                            <p className="mt-2 text-sm text-gray-300">
                                {MONTHS_PTBR[event.month] || event.month}: <strong className="text-green-300">{event.earnings}</strong>
                            </p>
                            <p className="mt-1 text-xs text-gray-400">
                                Data-com {event.dateWith || "-"} · Pagamento {event.paymentDate}
                            </p>
                            {event.estimatedAmount !== undefined && (
                                <p className="mt-2 text-sm font-bold text-green-300">
                                    Previsto na sua carteira: {formatCurrency(event.estimatedAmount)}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
