'use client';

import { useEffect, useRef, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import {
  handleWalletSessionResponse,
  notifyWalletSessionUpdated,
  WALLET_EMAIL_KEY,
  WALLET_SESSION_INVALID_EVENT,
  WALLET_SESSION_KEY,
  WALLET_SESSION_UPDATED_EVENT,
  walletSessionControls,
  type WalletSessionState,
} from "@/lib/users/WalletSessionRecoveryClient";

type WalletItem = {
  ticker: string;
  quotas: number;
};

type ToastState = {
  title: string;
  description?: string;
};

type CloudLoadCache = {
  email: string;
  signature: string;
  loadedAt: number;
};

type WalletSnapshot = {
  monthKey: string;
  label: string;
  totalValue: number;
  estimatedMonthlyIncome: number;
  announcedMonthlyIncome: number;
  walletCount: number;
  topWeightTicker?: string;
  topIncomeTicker?: string;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "dados-fii-wallet-v1";
const SNAPSHOT_KEY = "dados-fii-wallet-monthly-snapshots-v1";
const CLOUD_LOAD_CACHE_KEY = "dados-fii-wallet-cloud-load-cache-v1";
const SNAPSHOT_HYDRATION_KEY = "dados-fii-wallet-snapshots-hydrated-v1";
const PORTFOLIO_SAVED_EVENT = "dados-fii-wallet-saved";
const AUTO_CLOUD_LOAD_TTL_MS = 12 * 60 * 60 * 1000;
const AUTO_SAVE_DELAY_MS = 5 * 1000;

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

function snapshotSignature(items: WalletSnapshot[]) {
  return JSON.stringify(items.map((item) => ({ monthKey: item.monthKey, totalValue: item.totalValue, estimatedMonthlyIncome: item.estimatedMonthlyIncome })));
}

function normalizeSnapshots(value: unknown): WalletSnapshot[] {
  if (!Array.isArray(value)) return [];

  const snapshots = value.reduce<WalletSnapshot[]>((acc, item: any) => {
    const monthKey = String(item?.monthKey || item?.id || "").trim();
    if (!/^\d{4}-\d{2}$/.test(monthKey)) return acc;

    const totalValue = Number(item?.totalValue || 0);
    const estimatedMonthlyIncome = Number(item?.estimatedDividendIncome ?? item?.estimatedMonthlyIncome ?? item?.announcedMonthlyIncome ?? 0);
    const closedAt = String(item?.closedAt || item?.updatedAt || item?.createdAt || new Date().toISOString());

    const snapshot: WalletSnapshot = {
      monthKey,
      label: String(item?.label || monthKey),
      totalValue: Number.isFinite(totalValue) ? totalValue : 0,
      estimatedMonthlyIncome: Number.isFinite(estimatedMonthlyIncome) ? estimatedMonthlyIncome : 0,
      announcedMonthlyIncome: Number.isFinite(estimatedMonthlyIncome) ? estimatedMonthlyIncome : 0,
      walletCount: Number(item?.walletCount || 0),
      topWeightTicker: String(item?.topWeightTicker || ""),
      topIncomeTicker: String(item?.topIncomeTicker || ""),
      createdAt: closedAt,
      updatedAt: closedAt,
    };

    if (snapshot.totalValue > 0 || snapshot.estimatedMonthlyIncome > 0) acc.push(snapshot);
    return acc;
  }, []);

  return snapshots.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

function readCloudLoadCache(): CloudLoadCache | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(CLOUD_LOAD_CACHE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as CloudLoadCache;
    return parsed?.email && typeof parsed.loadedAt === "number" ? parsed : null;
  } catch {
    return null;
  }
}

function saveCloudLoadCache(email: string, signature: string) {
  try {
    window.localStorage.setItem(CLOUD_LOAD_CACHE_KEY, JSON.stringify({ email, signature, loadedAt: Date.now() }));
  } catch {
    return;
  }
}

function shouldAutoLoadFromCloud(email: string, currentWallet: WalletItem[]) {
  if (currentWallet.length) return false;

  const cache = readCloudLoadCache();
  if (!cache || cache.email !== email) return true;

  return Date.now() - cache.loadedAt > AUTO_CLOUD_LOAD_TTL_MS;
}

function diffTickers(previous: WalletItem[], current: WalletItem[]) {
  const currentSet = new Set(current.map((item) => item.ticker));

  return {
    removed: previous.filter((item) => !currentSet.has(item.ticker)).map((item) => item.ticker),
  };
}

export default function WalletEmailVerifiedSync() {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [token, setToken] = useState("");
  const [sessionState, setSessionState] = useState<WalletSessionState>("unknown");
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
  const snapshotLoadDoneRef = useRef(false);
  const requestCodeInFlightRef = useRef(false);
  const verifyCodeInFlightRef = useRef(false);
  const controls = walletSessionControls(sessionState, {
    validEmail: isEmail(email),
    hasPin: Boolean(pin.trim()),
    busy: loading || autoSaving,
  });
  const hasSession = controls.sessionValid;

  function markSessionInvalid() {
    setToken("");
    tokenRef.current = "";
    autoLoadDoneRef.current = false;
    snapshotLoadDoneRef.current = false;
    setAutoSaving(false);
    setSessionState("invalid");
    setMessage("Sua sessão da carteira expirou. Solicite um novo código para continuar.");
  }

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
    const storedEmail = window.localStorage.getItem(WALLET_EMAIL_KEY) || "";
    const storedToken = window.localStorage.getItem(WALLET_SESSION_KEY) || "";
    setEmail(storedEmail);
    setToken(storedToken);
    emailRef.current = storedEmail;
    tokenRef.current = storedToken;
    setSessionState(storedToken && isEmail(storedEmail) ? "validating" : "invalid");
    walletRef.current = initialWallet;
    setWallet(initialWallet);
    const initialSignature = walletSignature(initialWallet);
    const cloudCache = readCloudLoadCache();
    const hasConfirmedCloudSignature = Boolean(
      storedToken
      && cloudCache
      && cloudCache.email.trim().toLowerCase() === storedEmail.trim().toLowerCase()
      && cloudCache.signature === initialSignature,
    );
    lastSavedSignature.current = !storedToken || hasConfirmedCloudSignature
      ? initialSignature
      : "";

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

    const syncStoredSession = () => {
      const nextEmail = window.localStorage.getItem(WALLET_EMAIL_KEY) || emailRef.current;
      const nextToken = window.localStorage.getItem(WALLET_SESSION_KEY) || "";
      if (!nextToken) {
        markSessionInvalid();
        return;
      }
      if (nextToken === tokenRef.current) return;
      setEmail(nextEmail);
      setToken(nextToken);
      emailRef.current = nextEmail;
      tokenRef.current = nextToken;
      autoLoadDoneRef.current = false;
      snapshotLoadDoneRef.current = false;
      setSessionState("validating");
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === WALLET_SESSION_KEY) syncStoredSession();
    };
    window.addEventListener(WALLET_SESSION_INVALID_EVENT, markSessionInvalid);
    window.addEventListener(WALLET_SESSION_UPDATED_EVENT, syncStoredSession);
    window.addEventListener("storage", onStorage);

    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      window.clearInterval(interval);
      window.removeEventListener(WALLET_SESSION_INVALID_EVENT, markSessionInvalid);
      window.removeEventListener(WALLET_SESSION_UPDATED_EVENT, syncStoredSession);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  async function callApi(payload: Record<string, any>, endpoint = "/api/wallet-sync") {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await response.json().catch(() => ({}));
    const rejectedToken = typeof payload.sessionToken === "string" ? payload.sessionToken : undefined;
    handleWalletSessionResponse(response, rejectedToken);

    if (!response.ok || !json?.ok) throw new Error(json?.error || "Erro ao sincronizar carteira.");
    return json;
  }

  async function hydrateSnapshotsFromCloud(options?: { auto?: boolean; validatesSession?: boolean }) {
    const cleanEmail = (emailRef.current || email).trim().toLowerCase();
    const currentToken = tokenRef.current || token;

    if (!isEmail(cleanEmail) || !currentToken) return false;

    try {
      const json = await callApi({ email: cleanEmail, sessionToken: currentToken }, "/api/wallet/snapshots");
      if (options?.validatesSession && tokenRef.current === currentToken) {
        setSessionState("valid");
        notifyWalletSessionUpdated();
      }
      const snapshots = normalizeSnapshots(json?.snapshots);
      if (!snapshots.length) return true;

      const nextSignature = snapshotSignature(snapshots);
      const currentStored = normalizeSnapshots(JSON.parse(window.localStorage.getItem(SNAPSHOT_KEY) || "[]"));
      const currentSignature = snapshotSignature(currentStored);

      window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots));

      if (!options?.auto) {
        setMessage(`Histórico patrimonial carregado. ${snapshots.length} mês(es) encontrado(s). Atualizando a tela...`);
        window.setTimeout(() => window.location.reload(), 700);
        return true;
      }

      const reloadKey = `${SNAPSHOT_HYDRATION_KEY}:${cleanEmail}`;
      const lastHydratedSignature = window.sessionStorage.getItem(reloadKey) || "";
      const shouldReload = currentSignature !== nextSignature && lastHydratedSignature !== nextSignature && window.location.pathname.includes("/carteira");

      if (shouldReload) {
        window.sessionStorage.setItem(reloadKey, nextSignature);
        window.setTimeout(() => window.location.reload(), 400);
      }

      return true;
    } catch (err: any) {
      if (options?.validatesSession && tokenRef.current === currentToken) {
        setSessionState("invalid");
        setMessage(err.message || "Não foi possível validar a sessão. Solicite um novo código para continuar.");
      } else if (!options?.auto) {
        setMessage(err.message || "Erro ao carregar histórico patrimonial.");
      }
      return false;
    }
  }

  async function saveCurrentWallet(options?: { silent?: boolean; keepalive?: boolean }) {
    const cleanEmail = (emailRef.current || email).trim().toLowerCase();
    const currentToken = tokenRef.current || token;
    const currentWallet = readWallet();

    if (!isEmail(cleanEmail) || !currentToken) return false;

    const signature = walletSignature(currentWallet);
    if (signature === lastSavedSignature.current) {
      if (!options?.silent) setMessage("Carteira já está sincronizada.");
      return true;
    }

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
      handleWalletSessionResponse(response, currentToken);
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Erro ao salvar carteira.");

      lastSavedSignature.current = signature;
      walletRef.current = currentWallet;
      setWallet(currentWallet);
      saveCloudLoadCache(cleanEmail, signature);
      window.dispatchEvent(new Event(PORTFOLIO_SAVED_EVENT));
      await hydrateSnapshotsFromCloud({ auto: true });
      setMessage(options?.silent ? "Carteira sincronizada automaticamente." : `Carteira sincronizada com sucesso. Total salvo: ${Number(json.saved || currentWallet.length)} FII(s).`);
      return true;
    } catch (err: any) {
      if (tokenRef.current === currentToken) {
        setMessage(err.message || "Erro ao sincronizar carteira automaticamente.");
      }
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
    const beforeSignature = walletSignature(currentWallet);

    if (!isEmail(cleanEmail) || !currentToken) return false;
    if (options?.auto && !shouldAutoLoadFromCloud(cleanEmail, currentWallet)) return false;

    if (!options?.auto) {
      setLoading(true);
      setMessage("");
    }

    try {
      const json = await callApi({ action: "load", email: cleanEmail, sessionToken: currentToken, wallet: currentWallet }, "/api/wallet-load-legacy");
      const loadedWallet = Array.isArray(json.wallet) ? json.wallet : [];
      const loadedSignature = walletSignature(loadedWallet);

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedWallet));
      saveCloudLoadCache(cleanEmail, loadedSignature);
      lastSavedSignature.current = loadedSignature;
      walletRef.current = loadedWallet;
      setWallet(loadedWallet);
      await hydrateSnapshotsFromCloud({ auto: Boolean(options?.auto) });

      if (options?.auto) {
        if (loadedWallet.length && loadedSignature !== beforeSignature) {
          if (isMobileViewport()) {
            setMessage("");
            showToast({ title: "Carteira atualizada." });
          } else {
            setMessage("Carteira atualizada.");
          }
        }
      } else {
        setMessage(`Carteira e histórico carregados com sucesso. ${loadedWallet.length} FII(s) encontrados. Atualizando a tela...`);
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
    if (sessionState !== "valid" || !token || !isEmail(email)) return;

    const signature = walletSignature(wallet);
    if (signature === lastSavedSignature.current) return;

    setMessage("Alterações serão salvas automaticamente.");
    const timeout = window.setTimeout(() => {
      saveCurrentWallet({ silent: true });
    }, AUTO_SAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [email, token, wallet, sessionState]);

  useEffect(() => {
    if (!token || !isEmail(email) || snapshotLoadDoneRef.current) return;

    snapshotLoadDoneRef.current = true;
    hydrateSnapshotsFromCloud({ auto: true, validatesSession: sessionState === "validating" });
  }, [email, token, sessionState]);

  useEffect(() => {
    if (sessionState !== "valid" || !token || !isEmail(email) || autoLoadDoneRef.current) return;

    autoLoadDoneRef.current = true;
    loadWalletFromCloud({ auto: true });
  }, [email, token, sessionState]);

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
      setMessage("Este dispositivo já está confirmado. Alterações serão salvas automaticamente.");
      return;
    }
    if (requestCodeInFlightRef.current) return;

    if (!isEmail(cleanEmail)) {
      setMessage("Informe um e-mail válido.");
      return;
    }

    const previousState = sessionState;
    requestCodeInFlightRef.current = true;
    setSessionState("requesting_code");
    setLoading(true);
    setMessage("");

    try {
      const json = await callApi({ action: "request-code", email: cleanEmail });
      window.localStorage.setItem(WALLET_EMAIL_KEY, cleanEmail);
      window.localStorage.removeItem(WALLET_SESSION_KEY);
      setEmail(cleanEmail);
      setToken("");
      emailRef.current = cleanEmail;
      tokenRef.current = "";
      autoLoadDoneRef.current = false;
      snapshotLoadDoneRef.current = false;
      setSessionState("code_sent");
      setMessage(json.message || "Código enviado para seu e-mail.");
    } catch (err: any) {
      setSessionState(previousState === "code_sent" ? "code_sent" : "invalid");
      setMessage(err.message || "Erro ao enviar código.");
    } finally {
      requestCodeInFlightRef.current = false;
      setLoading(false);
    }
  }

  async function confirmCode() {
    const cleanEmail = email.trim().toLowerCase();

    if (!isEmail(cleanEmail) || !pin.trim() || sessionState !== "code_sent") {
      setMessage("Informe o e-mail e o código recebido.");
      return;
    }

    if (verifyCodeInFlightRef.current) return;
    verifyCodeInFlightRef.current = true;
    setSessionState("verifying");
    setLoading(true);
    setMessage("");

    try {
      const json = await callApi({ action: "verify-code", email: cleanEmail, code: pin.trim() });
      if (typeof json.sessionToken !== "string" || !json.sessionToken) throw new Error("Resposta inválida ao confirmar o código.");
      window.localStorage.setItem(WALLET_EMAIL_KEY, cleanEmail);
      window.localStorage.setItem(WALLET_SESSION_KEY, json.sessionToken);
      lastSavedSignature.current = "";
      setToken(json.sessionToken);
      emailRef.current = cleanEmail;
      tokenRef.current = json.sessionToken;
      autoLoadDoneRef.current = false;
      snapshotLoadDoneRef.current = false;
      setPin("");
      setSessionState("valid");
      notifyWalletSessionUpdated();
      setMessage("E-mail confirmado. Use Carregar para trazer a carteira e o histórico salvos neste dispositivo.");
    } catch (err: any) {
      setSessionState("code_sent");
      setMessage(err.message || "Código inválido.");
    } finally {
      verifyCodeInFlightRef.current = false;
      setLoading(false);
    }
  }

  async function syncLoad() {
    const cleanEmail = email.trim().toLowerCase();

    if (!isEmail(cleanEmail)) {
      setMessage("Informe um e-mail válido.");
      return;
    }

    if (!hasSession || !token) {
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
              Sua carteira fica salva neste navegador e pode ser recuperada pelo e-mail confirmado.
            </p>
            <p className="mt-1 text-xs font-medium leading-5 text-gray-400">
              {sessionState === "validating"
                ? "Validando a sessão salva neste dispositivo..."
                : hasSession
                  ? "Este dispositivo já está confirmado. Alterações serão salvas automaticamente."
                  : sessionState === "code_sent"
                    ? "Código enviado. Informe o PIN recebido para confirmar este dispositivo."
                    : "Sua sessão pode ser recuperada sem apagar os dados locais da carteira."}
            </p>
          </div>

          <div className="grid min-w-0 w-full max-w-full gap-2 lg:max-w-md">
            <input
              type="email"
              aria-label="E-mail para salvar e recuperar a carteira"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu@email.com"
              className="block w-full min-w-0 max-w-full rounded-lg border border-gray-700 bg-gray-800 p-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-indigo-400 sm:text-base"
            />

            <div className="grid min-w-0 w-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                aria-label="Código de verificação recebido por e-mail"
                autoComplete="one-time-code"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                placeholder="Código recebido"
                inputMode="numeric"
                disabled={sessionState !== "code_sent"}
                className="block w-full min-w-0 max-w-full rounded-lg border border-gray-700 bg-gray-800 p-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
              />
              <button
                type="button"
                onClick={confirmCode}
                disabled={!controls.canConfirmCode}
                className="inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-lg bg-gray-800 px-4 py-2 text-sm font-bold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400 sm:w-auto sm:text-base"
              >
                Confirmar
              </button>
            </div>

            <div className="grid min-w-0 w-full gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={hasSession ? () => saveCurrentWallet() : sendCode}
                disabled={hasSession ? loading || autoSaving : !controls.canRequestCode}
                className="inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-sm font-bold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
              >
                {loading || autoSaving ? <Loader2 className="shrink-0 animate-spin" size={16} /> : <Mail className="shrink-0" size={16} />}
                <span className="whitespace-nowrap">{hasSession ? "Sincronizar agora" : sessionState === "code_sent" ? "Reenviar código" : "Enviar novo código"}</span>
              </button>
              <button
                type="button"
                onClick={syncLoad}
                disabled={loading || autoSaving || !hasSession}
                className="inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-lg bg-gray-800 px-3 py-2 text-sm font-bold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
              >
                <span className="whitespace-nowrap">Carregar</span>
              </button>
            </div>

            {message && (
              <p role="status" className="min-w-0 max-w-full whitespace-pre-wrap break-words rounded-lg bg-gray-950/60 p-3 text-xs font-medium leading-5 text-yellow-200 sm:text-sm">
                {message}
              </p>
            )}
          </div>
        </div>
      </section>

      {toast && (
        <div className="wallet-sync-toast-top-right fixed right-3 top-4 z-50 max-w-sm overflow-hidden rounded-2xl bg-gray-950 text-white shadow-2xl ring-1 ring-white/10 sm:hidden">
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
