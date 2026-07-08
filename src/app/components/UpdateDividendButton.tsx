'use client';

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

interface Props {
    ticker: string;
    onSuccess?: () => void | Promise<void>;
}

const STORAGE_PREFIX = "dados-fii-dividend-update";
const TIME_ZONE = "America/Sao_Paulo";

function todayKey() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${byType.year}-${byType.month}-${byType.day}`;
}

export default function UpdateDividendButton({ ticker, onSuccess }: Props) {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [disabled, setDisabled] = useState(false);
    const storageKey = useMemo(() => `${STORAGE_PREFIX}:${ticker}:${todayKey()}`, [ticker]);

    useEffect(() => {
        try {
            setDisabled(window.localStorage.getItem(storageKey) === "done");
        } catch {
            setDisabled(false);
        }
    }, [storageKey]);

    function markUpdatedToday() {
        try {
            window.localStorage.setItem(storageKey, "done");
        } catch {
            return;
        }
        setDisabled(true);
    }

    const requestUpdate = async () => {
        if (loading || disabled) return;

        setLoading(true);
        setMessage("");

        try {
            const res = await fetch("/api/update-dividends", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ticker }),
            });

            const data = await res.json().catch(() => ({}));

            if (res.status === 429) {
                markUpdatedToday();
                return;
            }

            if (!res.ok) {
                setMessage(data.error || "Não foi possível solicitar a atualização.");
                return;
            }

            markUpdatedToday();
            await onSuccess?.();
        } catch {
            setMessage("Erro ao solicitar atualização. Tente novamente mais tarde.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-100">
            <p className="mb-3">
                O dividendo do mês atual ainda não aparece na base.
            </p>
            <button
                type="button"
                onClick={requestUpdate}
                disabled={loading || disabled}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-bold transition-colors ${loading || disabled
                    ? "cursor-not-allowed bg-gray-600 text-gray-300"
                    : "bg-yellow-500 text-black hover:bg-yellow-400"
                    }`}
            >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                {loading ? "Atualizando..." : disabled ? "Atualização feita hoje" : "Atualizar dividendos"}
            </button>
            {message && <p className="mt-3 text-xs text-yellow-50">{message}</p>}
        </div>
    );
}
