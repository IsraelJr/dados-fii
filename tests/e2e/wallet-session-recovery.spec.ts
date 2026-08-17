import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const EMAIL_KEY = "dados-fii-wallet-email";
const TOKEN_KEY = "dados-fii-wallet-session";
const WALLET_KEY = "dados-fii-wallet-v1";
const SNAPSHOTS_KEY = "dados-fii-wallet-monthly-snapshots-v1";
const HISTORY_KEY = "dados-fii-portfolio-history-cache-v2";

async function expectAccessibleRecovery(page: Page) {
  const results = await new AxeBuilder({ page })
    .include("section")
    .analyze();
  expect(results.violations.filter((item) => ["critical", "serious"].includes(item.impact || ""))).toEqual([]);
}

async function stubSupportingWalletRequests(page: Page) {
  await page.route("**/api/fii/batch", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, items: {}, errors: {} }) });
  });
  await page.route("**/api/portfolio/history?portfolioId=default", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, entries: [] }) });
  });
  await page.route("**/api/wallet/notification-preferences", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      ok: true,
      isPaid: false,
      plan: "free",
      planLabel: "Grátis",
      thresholdPercent: 3,
      minimumPercent: 1,
      maximumPercent: 20,
    }) });
  });
  await page.route("**/api/notifications", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, items: [], unreadCount: 0 }) });
  });
  await page.route("**/api/portfolio/incremental-analysis/availability", async (route) => {
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ ok: false }) });
  });
}

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\//, (route) => route.abort());
  await stubSupportingWalletRequests(page);
});

test("token armazenado rejeitado oferece recuperação e preserva todos os dados locais", async ({ page }) => {
  await page.addInitScript(({ emailKey, tokenKey, walletKey, snapshotsKey, historyKey }) => {
    localStorage.setItem(emailKey, "qa@example.test");
    localStorage.setItem(tokenKey, "rejected-session");
    localStorage.setItem(walletKey, JSON.stringify([{ ticker: "MXRF11", quotas: 10 }]));
    localStorage.setItem(snapshotsKey, JSON.stringify([{ monthKey: "2026-07", totalValue: 1000, estimatedMonthlyIncome: 10 }]));
    localStorage.setItem(historyKey, JSON.stringify([{ competence: "2026-07", dividends: 10, source: "manual" }]));
  }, { emailKey: EMAIL_KEY, tokenKey: TOKEN_KEY, walletKey: WALLET_KEY, snapshotsKey: SNAPSHOTS_KEY, historyKey: HISTORY_KEY });
  await page.route("**/api/wallet/snapshots", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ ok: false, error: "Sessão da carteira inválida." }) });
  });

  await page.goto("/carteira");

  await expect(page.getByRole("status").filter({ hasText: "Sua sessão da carteira expirou" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar novo código" })).toBeEnabled();
  await expect(page.getByLabel("Código de verificação recebido por e-mail")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Confirmar" })).toBeDisabled();
  await expect(page.getByLabel("E-mail para salvar e recuperar a carteira")).toHaveValue("qa@example.test");
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY)).toBeNull();
  const preserved = await page.evaluate(({ walletKey, snapshotsKey, historyKey }) => ({
    wallet: localStorage.getItem(walletKey),
    snapshots: localStorage.getItem(snapshotsKey),
    history: localStorage.getItem(historyKey),
  }), { walletKey: WALLET_KEY, snapshotsKey: SNAPSHOTS_KEY, historyKey: HISTORY_KEY });
  expect(preserved.wallet).toContain("MXRF11");
  expect(preserved.snapshots).toContain("2026-07");
  expect(preserved.history).toContain("2026-07");
  await expect(page.getByLabel("Meses informados no histórico").getByText("R$\u00a010,00", { exact: true })).toBeVisible();
  await expectAccessibleRecovery(page);
});

test("envio, erros do PIN, reenvio e confirmação recuperam a sessão sem requisições duplicadas", async ({ page }) => {
  let requestCodeCalls = 0;
  let verifyCodeCalls = 0;
  await page.addInitScript((emailKey) => localStorage.setItem(emailKey, "qa@example.test"), EMAIL_KEY);
  await page.route("**/api/wallet/snapshots", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, snapshots: [] }) });
  });
  await page.route("**/api/wallet-load-legacy", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, wallet: [] }) });
  });
  await page.route("**/api/wallet-sync", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    if (body.action === "request-code") {
      requestCodeCalls += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, message: "Código enviado para seu e-mail." }) });
      return;
    }
    verifyCodeCalls += 1;
    if (verifyCodeCalls === 1) {
      await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ ok: false, error: "Código incorreto." }) });
      return;
    }
    if (verifyCodeCalls === 2) {
      await route.fulfill({ status: 410, contentType: "application/json", body: JSON.stringify({ ok: false, error: "Código expirado." }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, sessionToken: "renewed-session" }) });
  });

  await page.goto("/carteira");
  const send = page.getByRole("button", { name: "Enviar novo código" });
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Enviar novo código"));
    button?.click();
    button?.click();
  });
  await expect(page.getByRole("status").filter({ hasText: "Código enviado" })).toBeVisible();
  expect(requestCodeCalls).toBe(1);
  await expect(page.getByLabel("Código de verificação recebido por e-mail")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Confirmar" })).toBeDisabled();

  await page.getByLabel("Código de verificação recebido por e-mail").fill("000000");
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Código incorreto" })).toBeVisible();
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Código expirado" })).toBeVisible();

  await page.getByRole("button", { name: "Reenviar código" }).click();
  expect(requestCodeCalls).toBe(2);
  await page.getByLabel("Código de verificação recebido por e-mail").fill("123456");
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY)).toBe("renewed-session");
  await expect(page.getByRole("button", { name: "Sincronizar agora" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Carregar" })).toBeEnabled();
  await expectAccessibleRecovery(page);
});

test("falha e rate limit no request-code não afirmam envio nem habilitam o PIN", async ({ page }) => {
  let calls = 0;
  await page.addInitScript((emailKey) => localStorage.setItem(emailKey, "qa@example.test"), EMAIL_KEY);
  await page.route("**/api/wallet-sync", async (route) => {
    calls += 1;
    const status = calls === 1 ? 500 : 429;
    const error = calls === 1 ? "Falha temporária ao enviar código." : "Muitas tentativas. Aguarde para reenviar.";
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ ok: false, error }) });
  });

  await page.goto("/carteira");
  await page.getByRole("button", { name: "Enviar novo código" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Falha temporária" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Código enviado" })).toHaveCount(0);
  await expect(page.getByLabel("Código de verificação recebido por e-mail")).toBeDisabled();
  await page.getByRole("button", { name: "Enviar novo código" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Muitas tentativas" })).toBeVisible();
  await expect(page.getByLabel("Código de verificação recebido por e-mail")).toBeDisabled();
});

test("sessão válida que expira durante o uso entra em recovery sem reload ou loop de autosave", async ({ page }) => {
  let saveCalls = 0;
  await page.addInitScript(({ emailKey, tokenKey, walletKey }) => {
    localStorage.setItem(emailKey, "qa@example.test");
    localStorage.setItem(tokenKey, "initially-valid-session");
    localStorage.setItem(walletKey, JSON.stringify([{ ticker: "MXRF11", quotas: 10 }]));
  }, { emailKey: EMAIL_KEY, tokenKey: TOKEN_KEY, walletKey: WALLET_KEY });
  await page.route("**/api/wallet/snapshots", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, snapshots: [] }) });
  });
  await page.route("**/api/wallet-save-clean", async (route) => {
    saveCalls += 1;
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ ok: false, error: "Sessão da carteira inválida." }) });
  });

  await page.goto("/carteira");
  await expect(page.getByRole("button", { name: "Sincronizar agora" })).toBeVisible();
  await page.getByRole("button", { name: "Sincronizar agora" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Sua sessão da carteira expirou" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar novo código" })).toBeEnabled();
  await page.evaluate(() => {
    window.dispatchEvent(new Event("pagehide"));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(100);
  expect(saveCalls).toBe(1);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), WALLET_KEY)).toContain("MXRF11");
});
