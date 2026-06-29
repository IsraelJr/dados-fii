'use client';

import { useState } from "react";
import { RefreshCw } from "lucide-react";

interface Props {
    ticker: string;
}

export default function UpdateDividendButton({ ticker }: Props) {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [disabled, setDisabled] = useState(false);

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

            const data = await res.json();

            if (!res.ok) {
                setDisabled(res.status === 429);
                setMessage(data.error || "Não foi possível solicitar a atualização.");
                return;
            }

            setDisabled(true);
            setMessage("Atualização solicitada com sucesso. Consulte o FII novamente em instantes.");
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
                {loading ? "Atualizando..." : disabled ? "Solicitação enviada hoje" : "Atualizar dividendos"}
            </button>
            {message && <p className="mt-3 text-xs text-yellow-50">{message}</p>}
        </div>
    );
}
