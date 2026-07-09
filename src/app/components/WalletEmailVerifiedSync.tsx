'use client';

import { useEffect, useRef, useState } from "react";
import { Loader2, Mail } from "lucide-react";

type WalletItem = {
  ticker: string;
  quotas: number;
};

type ToastState = {
  title: string;
  description?: string;
};

const STORAGE_KEY = "dados-fii-wallet-v1";
const EMAIL_KEY = "dados-fii-wallet-email";
const TOKEN_KEY = "dados-fii-wallet-session";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 639px)").matches;
}

function readWallet(): WalletItem[] {
  if (typeof window === "undefined") return [];

  try {
    const data = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(data)) return [];

    return data
      .map((item: any) => ({ ticker: String(item?.ticker || "").trim().toUpperCase(), quotas: Number(item?.quotas) }))
      .filter((item) => item.ticker && Number.isFinite(item.quotas) && item.quotas > 0)
      .sort((a, b) => a.ticker.localeCompare(b.ticker));
  } catch {
    return [];
  }
}

function walletSignature(items: WalletItem[]) {
  return JSON.stringify(items.map((item) => ({ ticker: item.ticker, quotas: item.quotas })));
}

function diffTickers(previous: WalletItem[], current: WalletItem[]) {
  const previousSet = new Set(previous.map((item) => item.ticker));
  const currentSet = new Set(current.map((item) => item.ticker));

  return {
    removed: previous.filter((item) => !currentSet.has(item.ticker)).map((item) => item.ticker),
  };
}

export default function WalletEmailVerifiedSync() {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [token, setToken] = useState("");
  const [wallet, setWallet] = useState<WalletItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [toastProgress, setToastProgress] = useState(false);
  const emailRef = useRef("");
  const tokenRef = useRef("");
  const walletRef = useRef<WalletItem[]>([]);
  const lastSavedSignature = useRef("");
  const toastTimerRef = useRef<number | null>(null);
  const autoLoadDoneRef = useRef(false);
  const hasSession = Boolean(token);

  function showToast(nextToast: ToastState) {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);

    setToast(nextToast);
    setToastProgress(false);
    window.setTimeout(() => setToastProgress(true), 30);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    emailRef.current = email;
  }, [email]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    const initialWallet = readWallet();
    const storedEmail = window.localStorage.getItem(EMAIL_KEY) || "";
    const storedToken = window.localStorage.getItem(TOKEN_KEY) || "";
    setEmail(storedEmail);
    setToken(storedToken);
    emailRef.current = storedEmail;
    tokenRef.current = storedToken;
    walletRef.current = initialWallet;
    setWallet(initialWallet);
    lastSavedSignature.current = walletSignature(initialWallet);

    const interval = window.setInterval(() => {
      const latestWallet = readWallet();
      const previousWallet = walletRef.current;
      const previousSignature = walletSignature(previousWallet);
      const nextSignature = walletSignature(latestWallet);

      if (previousSignature !== nextSignature) {
        const { removed } = diffTickers(previousWallet, latestWallet);

        walletRef.current = latestWallet;
        setWallet(latestWallet);

        if (removed.length) {
          showToast({ title: `Removendo ${removed.slice(0, 2).join(", ")} da carteira.` });
        }
      }
    }, 1500);

    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      window.clearInterval(interval);
    };
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

  async function saveCurrentWallet(options?: { silent?: boolean; keepalive?: boolean }) {
    const cleanEmail = (emailRef.current || email).trim().toLowerCase();
    const currentToken = tokenRef.current || token;
    const currentWallet = readWallet();

    if (!isEmail(cleanEmail) || !currentToken) return false;

    const signature = walletSignature(currentWallet);
    if (signature === lastSavedSignature.current) return true;

    if (options?.silent) setAutoSaving(true);
    else setLoading(true);

    try {
      const response = await fetch("/api/wallet-save-clean", {
        method: "POST",
        keepalive: Boolean(options?.keepalive),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, sessionToken: currentToken, wallet: currentWallet }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Erro ao salvar carteira.");

      lastSavedSignature.current = signature;
      walletRef.current = currentWallet;
      setWallet(currentWallet);
      setMessage(options?.silent ? "Carteira sincronizada automaticamente." : `Carteira sincronizada com sucesso. Total salvo: ${Number(json.saved || currentWallet.length)} FII(s).`);
      return true;
    } catch (err: any) {
      setMessage(err.message || "Erro ao sincronizar carteira automaticamente.");
      return false;
    } finally {
      if (options?.silent) setAutoSaving(false);
      else setLoading(false);
    }
  }

  async function loadWalletFromCloud(options?: { auto?: boolean }) {
    const cleanEmail = (emailRef.current || email).trim().toLowerCase();
    const currentToken = tokenRef.current || token;
    const currentWallet = readWallet();

    if (!isEmail(cleanEmail) || !currentToken) return false;
    if (options?.auto && currentWallet.length) return false;

    if (!options?.auto) {
      setLoading(true);
      setMessage("");
    }

    try {
      const json = await callApi({ action: "load", email: cleanEmail, sessionToken: currentToken, wallet: currentWallet }, "/api/wallet-load-legacy");
      const loadedWallet = Array.isArray(json.wallet) ? json.wallet : [];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedWallet));
      lastSavedSignature.current = walletSignature(loadedWallet);
      walletRef.current = loadedWallet;
      setWallet(loadedWallet);

      if (options?.auto) {
        if (isMobileViewport()) {
          setMessage("");
          showToast({ title: "Carteira atualizada." });
        } else {
          setMessage("Carteira atualizada.");
        }
      } else {
        setMessage(`Carteira carregada com sucesso. ${loadedWallet.length} FII(s) encontrados. Atualizando a tela...`);
        window.setTimeout(() => window.location.reload(), 800);
      }

      return true;
    } catch (err: any) {
      if (!options?.auto) setMessage(err.message || "Erro ao carregar carteira.");
      return false;
    } finally {
      if (!options?.auto) setLoading(false);
    }
  }

  useEffect(() => {
    if (!token || !isEmail(email)) return;

    const signature = walletSignature(wallet);
    if (signature === lastSavedSignature.current) return;

    setMessage("Alterações salvas neste navegador. Vamos sincronizar automaticamente depois de alguns minutos ou ao sair da página.");
    const timeout = window.setTimeout(() => {
      saveCurrentWallet({ silent: true });
    }, 120000);

    return () => window.clearTimeout(timeout);
  }, [email, token, wallet]);

  useEffect(() => {
    if (!token || !isEmail(email) || autoLoadDoneRef.current) return;

    autoLoadDoneRef.current = true;
    loadWalletFromCloud({ auto: true });
  }, [email, token]);

  useEffect(() => {
    function handlePageHide() {
      saveCurrentWallet({ silent: true, keepalive: true });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        saveCurrentWallet({ silent: true, keepalive: true });
      }
    }

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      saveCurrentWallet({ silent: true, keepalive: true });
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  async function sendCode() {
    const cleanEmail = email.trim().toLowerCase();

    if (hasSession) {
      setMessage("Este dispositivo já está confirmado. Use Carregar ou altere a carteira normalmente.");
      return;
    }

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
      emailRef.current = cleanEmail;
      tokenRef.current = "";
      autoLoadDoneRef.current = false;
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
      emailRef.current = cleanEmail;
      tokenRef.current = json.sessionToken;
      autoLoadDoneRef.current = false;
      setPin("");
      setMessage("E-mail confirmado. Agora sua carteira será carregada automaticamente quando disponível.");
    } catch (err: any) {
      setMessage(err.message || "Código inválido.");
    } finally {
      setLoading(false);
    }
  }

  async function syncLoad() {
    const cleanEmail = email.trim().toLowerCase();

    if (!isEmail(cleanEmail)) {
      setMessage("Informe um e-mail válido.");
      return;
    }

    if (!token) {
      setMessage("Confirme o código enviado para o e-mail antes de carregar.");
      return;
    }

    await loadWalletFromCloud();
  }

  return (
    <>
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
              {hasSession ? "Este dispositivo já está confirmado. Alterações ficam no navegador e sincronizam automaticamente ao sair ou após alguns minutos." : "Não enviaremos spam. O e-mail será usado apenas para recuperar e sincronizar sua carteira."}
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
                disabled={hasSession}
                className="block w-full min-w-0 max-w-full rounded-lg border border-gray-700 bg-gray-800 p-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
              />
              <button
                type="button"
                onClick={confirmCode}
                disabled={loading || !pin.trim() || hasSession}
                className="inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-lg bg-gray-800 px-4 py-2 text-sm font-bold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400 sm:w-auto sm:text-base"
              >
                Confirmar
              </button>
            </div>

            <div className="grid min-w-0 w-full gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={sendCode}
                disabled={loading || hasSession}
                className="inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-sm font-bold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
              >
                {loading ? <Loader2 className="shrink-0 animate-spin" size={16} /> : <Mail className="shrink-0" size={16} />}
                <span className="whitespace-nowrap">Enviar código</span>
              </button>
              <button
                type="button"
                onClick={syncLoad}
                disabled={loading || autoSaving || !token}
                className="inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-lg bg-gray-800 px-3 py-2 text-sm font-bold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
              >
                <span className="whitespace-nowrap">Carregar</span>
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

      {toast && (
        <div className="fixed inset-x-3 bottom-4 z-50 mx-auto max-w-sm overflow-hidden rounded-2xl bg-gray-950 text-white shadow-2xl ring-1 ring-white/10 sm:hidden">
          <div className="p-4">
            <p className="text-sm font-extrabold">{toast.title}</p>
            {toast.description && <p className="mt-1 text-xs font-medium leading-5 text-gray-300">{toast.description}</p>}
          </div>
          <div className="h-1 w-full bg-gray-800">
            <div
              className="h-full bg-indigo-400 transition-[width] ease-linear"
              style={{ width: toastProgress ? "0%" : "100%", transitionDuration: "3000ms" }}
            />
          </div>
        </div>
      )}
    </>
  );
}
