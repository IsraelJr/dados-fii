export const WALLET_EMAIL_KEY = "dados-fii-wallet-email";
export const WALLET_SESSION_KEY = "dados-fii-wallet-session";
export const WALLET_SESSION_UPDATED_EVENT = "dados-fii-wallet-session-updated";
export const WALLET_SESSION_INVALID_EVENT = "dados-fii-wallet-session-invalid";

export type WalletSessionState =
  | "unknown"
  | "validating"
  | "valid"
  | "invalid"
  | "requesting_code"
  | "code_sent"
  | "verifying";

type StorageLike = Pick<Storage, "getItem" | "removeItem">;

const AUTHENTICATED_WALLET_PATH = /^\/api\/(?:portfolio\/|wallet(?:\/|-)|product\/events|notifications(?:\/|$)|user-notifications(?:\/|$)|get-user$|add-alert$)/;

function browserStorage(): StorageLike | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function dispatchSessionEvent(name: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(name));
}

export function notifyWalletSessionUpdated() {
  dispatchSessionEvent(WALLET_SESSION_UPDATED_EVENT);
  dispatchSessionEvent("wallet-session-updated");
}

export function clearRejectedWalletSession(
  rejectedToken?: string,
  storage: StorageLike | null = browserStorage(),
) {
  if (!storage) return false;
  const currentToken = String(storage.getItem(WALLET_SESSION_KEY) || "");
  if (!currentToken || (rejectedToken && currentToken !== rejectedToken)) return false;
  storage.removeItem(WALLET_SESSION_KEY);
  return true;
}

export function invalidateWalletSession(rejectedToken?: string) {
  const cleared = clearRejectedWalletSession(rejectedToken);
  if (!cleared) return false;
  dispatchSessionEvent(WALLET_SESSION_INVALID_EVENT);
  notifyWalletSessionUpdated();
  return true;
}

export function handleWalletSessionResponse(response: Pick<Response, "status">, rejectedToken?: string) {
  if (response.status !== 401) return false;
  return invalidateWalletSession(rejectedToken);
}

function authenticatedWalletRequest(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof window === "undefined") return false;
  const value = typeof input === "string" || input instanceof URL ? String(input) : input.url;
  const url = new URL(value, window.location.origin);
  if (url.origin !== window.location.origin) return false;
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  return headers.has("x-wallet-session") || AUTHENTICATED_WALLET_PATH.test(url.pathname);
}

export function installWalletUnauthorizedObserver(
  onUnauthorized: (rejectedToken: string) => unknown = invalidateWalletSession,
) {
  if (typeof window === "undefined") return () => undefined;
  const originalFetch = window.fetch.bind(window);
  const observedFetch: typeof window.fetch = async (input, init) => {
    const observesSession = authenticatedWalletRequest(input, init);
    const rejectedToken = observesSession
      ? String(window.localStorage.getItem(WALLET_SESSION_KEY) || "")
      : "";
    const response = await originalFetch(input, init);
    if (response.status === 401 && observesSession && rejectedToken) {
      queueMicrotask(() => onUnauthorized(rejectedToken));
    }
    return response;
  };
  window.fetch = observedFetch;
  return () => {
    if (window.fetch === observedFetch) window.fetch = originalFetch;
  };
}

export function walletSessionControls(
  state: WalletSessionState,
  options: Readonly<{ validEmail: boolean; hasPin: boolean; busy: boolean }>,
) {
  const sessionValid = state === "valid";
  const codeSent = state === "code_sent";
  const requestReady = state === "invalid" || codeSent;
  return {
    sessionValid,
    canRequestCode: requestReady && options.validEmail && !options.busy,
    canConfirmCode: codeSent && options.hasPin && !options.busy,
  } as const;
}
