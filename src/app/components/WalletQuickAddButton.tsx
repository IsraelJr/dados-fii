'use client';

import { useEffect, useState } from "react";
import { Plus, Wallet } from "lucide-react";

const STORAGE_KEY = "dados-fii-wallet-v1";

type WalletItem = {
    ticker: string;
    quotas: number;
};

function readWallet(): WalletItem[] {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export default function WalletQuickAddButton({ ticker }: { ticker: string }) {
    const [open, setOpen] = useState(false);
    const [quotas, setQuotas] = useState("");
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const code = ticker.toUpperCase();
        const current = readWallet().find((item) => item.ticker === code);
        setQuotas(current?.quotas ? String(current.quotas) : "");
        setSaved(Boolean(current));
    }, [ticker]);

    function save() {
        const code = ticker.toUpperCase();
        const totalQuotas = Number(quotas.replace(",", "."));
        if (!Number.isFinite(totalQuotas) || totalQuotas <= 0) return;

        const wallet = readWallet();
        const updated = wallet.some((item) => item.ticker === code)
            ? wallet.map((item) => item.ticker === code ? { ...item, quotas: totalQuotas } : item)
            : [...wallet, { ticker: code, quotas: totalQuotas }];

        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.sort((a, b) => a.ticker.localeCompare(b.ticker))));
        setSaved(true);
        setOpen(false);
    }

    return (
        <div className="relative inline-block">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold shadow-sm ${saved ? "bg-emerald-700 text-emerald-50 ring-1 ring-emerald-300 hover:bg-emerald-600" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}
            >
                {saved ? <Wallet size={14} /> : <Plus size={14} />}
                {saved ? "Na carteira" : "Carteira"}
            </button>

            {open && (
                <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-gray-700 bg-gray-950 p-3 text-left shadow-xl">
                    <p className="mb-2 text-xs font-bold text-gray-200">Adicionar {ticker.toUpperCase()}</p>
                    <input
                        value={quotas}
                        onChange={(event) => setQuotas(event.target.value)}
                        onKeyDown={(event) => { if (event.key === "Enter") save(); }}
                        placeholder="Quantidade de cotas"
                        inputMode="decimal"
                        className="mb-2 w-full rounded-lg border border-gray-700 bg-gray-900 p-2 text-sm text-white outline-none focus:border-indigo-400"
                    />
                    <button
                        type="button"
                        onClick={save}
                        className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                    >
                        Salvar na carteira
                    </button>
                </div>
            )}
        </div>
    );
}
