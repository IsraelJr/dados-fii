'use client';

import { useState } from "react";
import { Loader2, Mail, Save } from "lucide-react";

type WalletItem = {
  ticker: string;
  quotas: number;
};

type Props = {
  items: WalletItem[];
  onLoadWallet: (items: WalletItem[]) => void;
};

const WALLET_EMAIL_KEY = "dados-fii-wallet-email";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function WalletEmailSync({ items, onLoadWallet }: Props) {
  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(WALLET_EMAIL_KEY) || "";
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function syncWallet(action: "save" | "load") {
    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      setMessage("Informe um e-mail válido.");
      return;
    }

    if (action === "save" && !items.length) {
      setMessage("Adicione pelo menos um FII antes de salvar sua carteira.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/wallet-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, email: normalizedEmail, wallet: items }),
      });
      const json = await response.json();

      if (!response.ok || !json?.ok) throw new Error(json?.error || "Erro ao sincronizar carteira.");

      window.localStorage.setItem(WALLET_EMAIL_KEY, normalizedEmail);

      if (action === "load") {
        onLoadWallet(Array.isArray(json.wallet) ? json.wallet : []);
        setMessage(`Carteira carregada com sucesso para ${normalizedEmail}.`);
      } else {
        setMessage(`Carteira salva com sucesso para ${normalizedEmail}.`);
      }
    } catch (err: any) {
      setMessage(err.message || "Erro ao sincronizar carteira.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-6 rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-white">
            <Mail className="text-indigo-300" size={22} /> Salve sua carteira
          </h2>
          <p className="mt-2 text-sm font-medium leading-6 text-gray-300">
            Sua carteira fica salva apenas neste navegador. Cadastre seu e-mail para acessar seus FIIs em qualquer celular, computador ou navegador.
          </p>
          <p className="mt-1 text-xs font-medium text-gray-400">
            Não enviaremos spam. O e-mail será usado apenas para recuperar e sincronizar sua carteira.
          </p>
        </div>

        <div className="grid w-full gap-2 lg:max-w-md">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="seu@email.com"
            className="rounded-lg border border-gray-700 bg-gray-800 p-3 text-white outline-none placeholder:text-gray-500 focus:border-indigo-400"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => syncWallet("save")}
              disabled={loading || !items.length}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Salvar carteira
            </button>
            <button
              type="button"
              onClick={() => syncWallet("load")}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-800 px-4 py-2 font-bold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
            >
              Carregar carteira
            </button>
          </div>
          {message && <p className="text-sm font-medium text-yellow-200">{message}</p>}
        </div>
      </div>
    </section>
  );
}
