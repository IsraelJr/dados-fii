'use client';

import { useEffect, useState } from "react";
import { Loader2, Mail, Save } from "lucide-react";

type WalletItem = {
  ticker: string;
  quotas: number;
};

const STORAGE_KEY = "dados-fii-wallet-v1";
const EMAIL_KEY = "dados-fii-wallet-email";
const TOKEN_KEY = "dados-fii-wallet-session";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function readWallet(): WalletItem[] {
  if (typeof window === "undefined") return [];

  try {
    const data = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(data)) return [];

    return data
      .map((item: any) => ({ ticker: String(item?.ticker || "").trim().toUpperCase(), quotas: Number(item?.quotas) }))
      .filter((item) => item.ticker && Number.isFinite(item.quotas) && item.quotas > 0);
  } catch {
    return [];
  }
}

export default function WalletEmailVerifiedSync() {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [token, setToken] = useState("");
  const [wallet, setWallet] = useState<WalletItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setEmail(window.localStorage.getItem(EMAIL_KEY) || "");
    setToken(window.localStorage.getItem(TOKEN_KEY) || "");
    setWallet(readWallet());

    const interval = window.setInterval(() => setWallet(readWallet()), 1500);
    return () => window.clearInterval(interval);
  }, []);

  async function callApi(payload: Record<string, any>, endpoint = "/api/wallet-sync") {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await response.json();

    if (!response.ok || !json?.ok) throw new Error(json?.error || "Erro ao sincronizar carteira.");
    return json;
  }

  async function sendCode() {
    const cleanEmail = email.trim().toLowerCase();

    if (!isEmail(cleanEmail)) {
      setMessage("Informe um e-mail válido.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const json = await callApi({ action: "request-code", email: cleanEmail });
      window.localStorage.setItem(EMAIL_KEY, cleanEmail);
      window.localStorage.removeItem(TOKEN_KEY);
      setEmail(cleanEmail);
      setToken("");
      setMessage(json.message || "Código enviado para seu e-mail.");
    } catch (err: any) {
      setMessage(err.message || "Erro ao enviar código.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmCode() {
    const cleanEmail = email.trim().toLowerCase();

    if (!isEmail(cleanEmail) || !pin.trim()) {
      setMessage("Informe o e-mail e o código recebido.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const json = await callApi({ action: "verify-code", email: cleanEmail, code: pin.trim() });
      window.localStorage.setItem(EMAIL_KEY, cleanEmail);
      window.localStorage.setItem(TOKEN_KEY, json.sessionToken);
      setToken(json.sessionToken);
      setPin("");
      setMessage("E-mail confirmado. Agora você pode salvar ou carregar a carteira.");
    } catch (err: any) {
      setMessage(err.message || "Código inválido.");
    } finally {
      setLoading(false);
    }
  }

  async function sync(action: "save" | "load") {
    const cleanEmail = email.trim().toLowerCase();
    const currentWallet = readWallet();

    if (!isEmail(cleanEmail)) {
      setMessage("Informe um e-mail válido.");
      return;
    }

    if (!token) {
      setMessage("Confirme o código enviado para o e-mail antes de salvar ou carregar.");
      return;
    }

    if (action === "save" && !currentWallet.length) {
      setMessage("Adicione pelo menos um FII antes de salvar sua carteira.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const endpoint = action === "load" ? "/api/wallet-load-legacy" : "/api/wallet-sync";
      const json = await callApi({ action, email: cleanEmail, sessionToken: token, wallet: currentWallet }, endpoint);

      if (action === "load") {
        const loadedWallet = Array.isArray(json.wallet) ? json.wallet : [];
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedWallet));
        setWallet(loadedWallet);
        setMessage(`Carteira carregada com sucesso. ${loadedWallet.length} FII(s) encontrados. Atualizando a tela...`);
        window.setTimeout(() => window.location.reload(), 800);
      } else {
        setWallet(currentWallet);
        setMessage(`Carteira salva com sucesso. Total salvo: ${Number(json.saved || currentWallet.length)} FII(s).`);
      }
    } catch (err: any) {
      setMessage(err.message || "Erro ao sincronizar carteira.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto mb-6 w-full max-w-6xl overflow-hidden rounded-2xl bg-gray-900 p-4 text-gray-100 shadow-lg ring-1 ring-white/10 sm:p-5">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <h2 className="flex min-w-0 items-center gap-2 text-lg font-extrabold text-white sm:text-xl">
            <Mail className="shrink-0 text-indigo-300" size={22} />
            <span className="min-w-0">Salve sua carteira</span>
          </h2>
          <p className="mt-2 text-sm font-medium leading-6 text-gray-300">
            Sua carteira fica salva apenas neste navegador. Confirme seu e-mail para acessar seus FIIs em qualquer celular, computador ou navegador.
          </p>
          <p className="mt-1 text-xs font-medium leading-5 text-gray-400">
            Não enviaremos spam. O e-mail será usado apenas para recuperar e sincronizar sua carteira.
          </p>
        </div>

        <div className="grid min-w-0 w-full max-w-full gap-2 lg:max-w-md">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="seu@email.com"
            className="block w-full min-w-0 max-w-full rounded-lg border border-gray-700 bg-gray-800 p-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-indigo-400 sm:text-base"
          />

          <div className="grid min-w-0 w-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="Código recebido"
              inputMode="numeric"
              className="block w-full min-w-0 max-w-full rounded-lg border border-gray-700 bg-gray-800 p-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-indigo-400 sm:text-base"
            />
            <button
              type="button"
              onClick={confirmCode}
              disabled={loading || !pin.trim()}
              className="inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-lg bg-gray-800 px-4 py-2 text-sm font-bold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400 sm:w-auto sm:text-base"
            >
              Confirmar
            </button>
          </div>

          <div className="grid min-w-0 w-full gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={sendCode}
              disabled={loading}
              className="inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-sm font-bold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400 sm:px-4 sm:text-base"
            >
              {loading ? <Loader2 className="shrink-0 animate-spin" size={16} /> : <Mail className="shrink-0" size={16} />}
              <span className="truncate">Enviar código</span>
            </button>
            <button
              type="button"
              onClick={() => sync("save")}
              disabled={loading || !wallet.length || !token}
              className="inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400 sm:px-4 sm:text-base"
            >
              {loading ? <Loader2 className="shrink-0 animate-spin" size={16} /> : <Save className="shrink-0" size={16} />}
              <span className="truncate">Salvar</span>
            </button>
            <button
              type="button"
              onClick={() => sync("load")}
              disabled={loading || !token}
              className="inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-lg bg-gray-800 px-3 py-2 text-sm font-bold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400 sm:px-4 sm:text-base"
            >
              <span className="truncate">Carregar</span>
            </button>
          </div>

          {message && (
            <p className="min-w-0 max-w-full whitespace-pre-wrap break-words rounded-lg bg-gray-950/60 p-3 text-xs font-medium leading-5 text-yellow-200 sm:text-sm">
              {message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
