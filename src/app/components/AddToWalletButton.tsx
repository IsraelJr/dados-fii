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
        <div className="mt-4 rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
            <div className="mb-3 flex items-center gap-2 text-base font-extrabold text-white">
                <Wallet size={18} className="text-indigo-300" />
                Minha Carteira
            </div>

            <p className="mb-4 text-sm font-medium text-gray-300">
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
                    className="rounded-lg border border-gray-700 bg-gray-800 p-3 text-white outline-none placeholder:text-gray-400 focus:border-indigo-400"
                />

                <button
                    type="button"
                    onClick={addToWallet}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
                >
                    <Plus size={16} /> {isInWallet ? "Atualizar" : "Adicionar"}
                </button>

                <Link
                    href="/carteira"
                    className="inline-flex items-center justify-center rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200 hover:text-slate-900"
                >
                    Ver carteira
                </Link>
            </div>

            {message && <p className="mt-3 text-sm font-medium text-green-300">{message}</p>}
        </div>
    );
}
