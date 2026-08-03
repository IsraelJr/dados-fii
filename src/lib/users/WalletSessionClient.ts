import type { User } from "firebase/auth";

export const WALLET_EMAIL_KEY = "dados-fii-wallet-email";
export const WALLET_SESSION_KEY = "dados-fii-wallet-session";
export const WALLET_SESSION_EXPIRES_AT_KEY = "dados-fii-wallet-session-expires-at";
export const WALLET_SESSION_LOGOUT_KEY = "dados-fii-wallet-session-logout";
export const WALLET_SESSION_UPDATED_EVENT = "dados-fii-wallet-session-updated";
export const WALLET_SESSION_INVALID_EVENT = "dados-fii-wallet-session-invalid";

const RENEWAL_SKEW_MS = 60_000;
const RENEWAL_LOCK_NAME = "dados-fii-wallet-session-renewal";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type FetchLike = typeof fetch;
type SessionUser = Pick<User, "email" | "getIdToken" | "uid">;

type WalletSessionPayload = Readonly<{
  token?: unknown;
  expiresAt?: unknown;
}>;

type RenewalOptions = Readonly<{
  storage?: StorageLike;
  fetcher?: FetchLike;
  notify?: () => void;
  nowMs?: number;
  force?: boolean;
  rejectedToken?: string;
}>;

type NavigatorWithLocks = Navigator & {
  locks?: {
    request<T>(name: string, callback: () => Promise<T>): Promise<T>;
  };
};

const renewals = new Map<string, Promise<boolean>>();

function browserStorage() {
  return window.localStorage;
}

function notifyBrowserSessionUpdated() {
  window.dispatchEvent(new Event(WALLET_SESSION_UPDATED_EVENT));
  window.dispatchEvent(new Event("wallet-session-updated"));
}

export function clearWalletSession(storage: StorageLike = browserStorage()) {
  storage.removeItem(WALLET_EMAIL_KEY);
  storage.removeItem(WALLET_SESSION_KEY);
  storage.removeItem(WALLET_SESSION_EXPIRES_AT_KEY);
}

export function markWalletLogout(storage: StorageLike = browserStorage()) {
  const entropy = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  storage.setItem(WALLET_SESSION_LOGOUT_KEY, `${new Date().toISOString()}:${entropy}`);
  clearWalletSession(storage);
}

export function walletSessionIsUsable(
  storage: StorageLike,
  expectedEmail: string,
  nowMs = Date.now(),
) {
  const email = String(storage.getItem(WALLET_EMAIL_KEY) || "").trim().toLowerCase();
  const token = String(storage.getItem(WALLET_SESSION_KEY) || "");
  const expiresAt = Date.parse(String(storage.getItem(WALLET_SESSION_EXPIRES_AT_KEY) || ""));
  return Boolean(token)
    && email === expectedEmail.trim().toLowerCase()
    && Number.isFinite(expiresAt)
    && expiresAt > nowMs + RENEWAL_SKEW_MS;
}

function persistWalletSession(
  storage: StorageLike,
  email: string,
  payload: WalletSessionPayload,
) {
  const token = typeof payload.token === "string" ? payload.token : "";
  const expiresAt = typeof payload.expiresAt === "string" ? payload.expiresAt : "";
  if (!token || !Number.isFinite(Date.parse(expiresAt))) {
    throw new Error("Resposta inválida ao renovar a sessão da carteira.");
  }
  storage.setItem(WALLET_EMAIL_KEY, email.trim().toLowerCase());
  storage.setItem(WALLET_SESSION_KEY, token);
  storage.setItem(WALLET_SESSION_EXPIRES_AT_KEY, expiresAt);
  storage.removeItem(WALLET_SESSION_LOGOUT_KEY);
}

async function exchangeFirebaseToken(
  user: SessionUser,
  storage: StorageLike,
  fetcher: FetchLike,
  notify: () => void,
) {
  const email = String(user.email || "").trim().toLowerCase();
  if (!email) throw new Error("Usuário Firebase sem e-mail válido.");
  const logoutMarker = storage.getItem(WALLET_SESSION_LOGOUT_KEY);
  const idToken = await user.getIdToken(true);
  const response = await fetcher("/api/wallet/session/firebase", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const payload = await response.json().catch(() => ({})) as WalletSessionPayload;
  if (!response.ok) throw new Error("Falha ao renovar a sessão segura da carteira.");
  const latestLogoutMarker = storage.getItem(WALLET_SESSION_LOGOUT_KEY);
  if (latestLogoutMarker && latestLogoutMarker !== logoutMarker) {
    throw new Error("Logout ocorreu durante a renovação da sessão.");
  }
  persistWalletSession(storage, email, payload);
  notify();
  return true;
}

async function withCrossTabRenewalLock<T>(callback: () => Promise<T>) {
  if (typeof navigator === "undefined") return callback();
  const locks = (navigator as NavigatorWithLocks).locks;
  return locks ? locks.request(RENEWAL_LOCK_NAME, callback) : callback();
}

export function ensureWalletSession(user: SessionUser, options: RenewalOptions = {}) {
  const storage = options.storage ?? browserStorage();
  const notify = options.notify ?? notifyBrowserSessionUpdated;
  const email = String(user.email || "").trim().toLowerCase();
  const existing = renewals.get(user.uid);
  if (existing) return existing;

  const renewal = withCrossTabRenewalLock(async () => {
    const currentToken = String(storage.getItem(WALLET_SESSION_KEY) || "");
    const anotherTabRenewed = Boolean(options.rejectedToken)
      && currentToken !== options.rejectedToken
      && walletSessionIsUsable(storage, email, options.nowMs);
    if (anotherTabRenewed || (!options.force && walletSessionIsUsable(storage, email, options.nowMs))) {
      return true;
    }
    const fetcher = options.fetcher
      ?? (typeof window === "undefined" ? undefined : window.fetch.bind(window));
    if (!fetcher) throw new Error("Cliente HTTP indisponível para renovar a sessão.");
    return exchangeFirebaseToken(user, storage, fetcher, notify);
  }).finally(() => renewals.delete(user.uid));
  renewals.set(user.uid, renewal);
  return renewal;
}

function walletAuthenticatedRequest(input: RequestInfo | URL, init?: RequestInit) {
  const value = typeof input === "string" || input instanceof URL ? String(input) : input.url;
  const url = new URL(value, window.location.origin);
  if (url.origin !== window.location.origin || url.pathname === "/api/wallet/session/firebase") return false;
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (headers.has("x-wallet-session")) return true;
  return /^\/api\/(?:portfolio\/|wallet(?:\/|-)|product\/events|user-notifications)/.test(url.pathname);
}

function walletSessionTokenAtRequest(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  return String(headers.get("x-wallet-session") || window.localStorage.getItem(WALLET_SESSION_KEY) || "");
}

export function installWalletUnauthorizedObserver(onUnauthorized: (rejectedToken: string) => void) {
  const originalFetch = window.fetch.bind(window);
  const observedFetch: typeof window.fetch = async (input, init) => {
    const authenticatedRequest = walletAuthenticatedRequest(input, init);
    const rejectedToken = authenticatedRequest ? walletSessionTokenAtRequest(input, init) : "";
    const response = await originalFetch(input, init);
    if (response.status === 401 && authenticatedRequest && rejectedToken) {
      queueMicrotask(() => onUnauthorized(rejectedToken));
    }
    return response;
  };
  window.fetch = observedFetch;
  return () => {
    if (window.fetch === observedFetch) window.fetch = originalFetch;
  };
}
