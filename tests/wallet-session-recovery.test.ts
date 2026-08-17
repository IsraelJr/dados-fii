import assert from "node:assert/strict";
import test from "node:test";
import {
  clearRejectedWalletSession,
  handleWalletSessionResponse,
  installWalletUnauthorizedObserver,
  WALLET_EMAIL_KEY,
  WALLET_SESSION_KEY,
  walletSessionControls,
// @ts-expect-error Node's native strip-types runner requires the explicit .ts suffix.
} from "../src/lib/users/WalletSessionRecoveryClient.ts";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

test("401 remove somente a credencial rejeitada e preserva carteira, e-mail e históricos", () => {
  const storage = memoryStorage({
    [WALLET_EMAIL_KEY]: "qa@example.test",
    [WALLET_SESSION_KEY]: "rejected-session",
    "dados-fii-wallet-v1": "wallet-sentinel",
    "dados-fii-wallet-monthly-snapshots-v1": "snapshots-sentinel",
    "dados-fii-portfolio-history-cache-v2": "history-sentinel",
  });

  assert.equal(clearRejectedWalletSession("rejected-session", storage), true);
  assert.equal(storage.getItem(WALLET_SESSION_KEY), null);
  assert.equal(storage.getItem(WALLET_EMAIL_KEY), "qa@example.test");
  assert.equal(storage.getItem("dados-fii-wallet-v1"), "wallet-sentinel");
  assert.equal(storage.getItem("dados-fii-wallet-monthly-snapshots-v1"), "snapshots-sentinel");
  assert.equal(storage.getItem("dados-fii-portfolio-history-cache-v2"), "history-sentinel");
});

test("401 tardio de uma geração antiga não invalida a sessão nova", () => {
  const storage = memoryStorage({ [WALLET_SESSION_KEY]: "new-session" });
  assert.equal(clearRejectedWalletSession("old-session", storage), false);
  assert.equal(storage.getItem(WALLET_SESSION_KEY), "new-session");
});

test("estado sem sessão válida nunca estabiliza sem uma ação de recuperação", () => {
  for (const state of ["invalid", "code_sent"] as const) {
    const controls = walletSessionControls(state, { validEmail: true, hasPin: state === "code_sent", busy: false });
    assert.equal(controls.canRequestCode || controls.canConfirmCode, true);
  }

  assert.deepEqual(
    walletSessionControls("invalid", { validEmail: true, hasPin: false, busy: false }),
    { sessionValid: false, canRequestCode: true, canConfirmCode: false },
  );
  assert.deepEqual(
    walletSessionControls("code_sent", { validEmail: true, hasPin: true, busy: false }),
    { sessionValid: false, canRequestCode: true, canConfirmCode: true },
  );
});

test("observer converge 401 autenticado para a política central sem afetar outra origem", async () => {
  const previousWindow = typeof window === "undefined" ? undefined : window;
  const storage = memoryStorage({ [WALLET_SESSION_KEY]: "session-a" });
  const calls: string[] = [];
  const browser = {
    location: { origin: "https://dados-fii.example" },
    localStorage: storage,
    fetch: async (input: RequestInfo | URL) => new Response("{}", {
      status: String(input).includes("/api/wallet/snapshots") ? 401 : 200,
      headers: { "Content-Type": "application/json" },
    }),
    dispatchEvent: () => true,
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: browser, writable: true });

  try {
    const remove = installWalletUnauthorizedObserver((token) => {
      if (token) calls.push(token);
      return true;
    });
    await window.fetch("/api/wallet/snapshots", { method: "POST" });
    await Promise.resolve();
    await window.fetch("https://outside.example/api/wallet/snapshots");
    await Promise.resolve();
    assert.deepEqual(calls, ["session-a"]);
    remove();
  } finally {
    if (previousWindow) {
      Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow, writable: true });
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
});

test("respostas diferentes de 401 não disparam invalidação", () => {
  const previousWindow = typeof window === "undefined" ? undefined : window;
  const storage = memoryStorage({ [WALLET_SESSION_KEY]: "session-a" });
  const browser = { localStorage: storage, dispatchEvent: () => true };
  Object.defineProperty(globalThis, "window", { configurable: true, value: browser, writable: true });
  try {
    assert.equal(handleWalletSessionResponse({ status: 429 }, "session-a"), false);
    assert.equal(storage.getItem(WALLET_SESSION_KEY), "session-a");
  } finally {
    if (previousWindow) {
      Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow, writable: true });
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
});
