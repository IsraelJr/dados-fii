'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Wallet } from "lucide-react";

const STORAGE_KEY = "dados-fii-wallet-v1";

type WalletItem = {
    ticker: string;
    quotas: number;
};

interface Props {
    ticker: string;
}

function readWallet(): WalletItem[] {
    if (typeof window === "undefined") return [];

    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveWallet(items: WalletItem[]) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export default function AddToWalletButton({ ticker }: Props) {
    const [quotas, setQuotas] = useState("");
    const [message, setMessage] = useState("");
    const [isInWallet, setIsInWallet] = useState(false);

    useEffect(() => {
        const code = ticker.trim().toUpperCase();
        const wallet = readWallet();
        const current = wallet.find((item) => item.ticker === code);

        setIsInWallet(Boolean(current));
        setQuotas(current?.quotas ? String(current.quotas) : "");
    }, [ticker]);

    function addToWallet() {
        const code = ticker.trim().toUpperCase();
        const totalQuotas = Number(quotas.replace(",", "."));

        if (!code || !Number.isFinite(totalQuotas) || totalQuotas <= 0) {
            setMessage("Informe a quantidade de cotas para adicionar à carteira.");
            return;
        }

        const wallet = readWallet();
        const updated = wallet.some((item) => item.ticker === code)
            ? wallet.map((item) => item.ticker === code ? { ...item, quotas: totalQuotas } : item)
            : [...wallet, { ticker: code, quotas: totalQuotas }];

        saveWallet(updated.sort((a, b) => a.ticker.localeCompare(b.ticker)));
        setIsInWallet(true);
        setMessage(`${code} salvo na sua carteira.`);
    }

    return (
        <div className="mt-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-sm text-indigo-50">
            <div className="mb-3 flex items-center gap-2 font-bold">
                <Wallet size={18} className="text-indigo-300" />
                Minha Carteira
            </div>

            <p className="mb-3 text-indigo-100/90">
                {isInWallet
                    ? `${ticker} já está na sua carteira. Atualize a quantidade de cotas, se necessário.`
                    : `Adicione ${ticker} à sua carteira para acompanhar renda estimada e próximos pagamentos.`}
            </p>

            <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                <input
                    value={quotas}
                    onChange={(event) => setQuotas(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") addToWallet(); }}
                    placeholder="Quantidade de cotas"
                    inputMode="decimal"
                    className="rounded-lg border border-indigo-400/30 bg-gray-900 p-2 text-white outline-none focus:border-indigo-300"
                />

                <button
                    type="button"
                    onClick={addToWallet}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700"
                >
                    <Plus size={16} /> {isInWallet ? "Atualizar" : "Adicionar"}
                </button>

                <Link
                    href="/carteira"
                    className="inline-flex items-center justify-center rounded-lg bg-gray-800 px-4 py-2 font-bold text-indigo-100 hover:bg-gray-700"
                >
                    Ver carteira
                </Link>
            </div>

            {message && <p className="mt-3 text-xs text-indigo-100">{message}</p>}
        </div>
    );
}
