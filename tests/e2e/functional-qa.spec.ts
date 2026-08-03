import AxeBuilder from "@axe-core/playwright";
import {
  clickStableSemanticTarget,
  expect,
  expectAuthenticatedWallet,
  logoutWallet,
  observeWalletAuthentication,
  stabilizeCookieConsent,
  test,
} from "./fixtures";
import type { Page } from "@playwright/test";
import { parseDisplayedPercentage } from "./support/parse-displayed-percentage";
import {
  closedQaDividendMonths,
  saoPauloCalendarPeriod,
  type QaDividendMonth,
} from "./support/closedCompetences";

const remoteRun = Boolean(process.env.E2E_BASE_URL);
const qaPeriod = saoPauloCalendarPeriod();
const currentYear = qaPeriod.year;
const qaMonths = closedQaDividendMonths(qaPeriod);
const artificialCompetences = qaMonths.map((entry) => entry.competence);

test.skip(!remoteRun, "A suíte funcional remota exige E2E_BASE_URL e roda contra Preview ou produção.");
test.describe.configure({ mode: "serial", timeout: 180_000 });

function qaCredentials() {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  const missing = [
    !email && "E2E_USER_EMAIL",
    !password && "E2E_USER_PASSWORD",
  ].filter(Boolean);
  if (missing.length) throw new Error(`Configuração de QA ausente: ${missing.join(", ")}.`);
  return { email: email!, password: password! };
}

async function login(page: Page) {
  const credentials = qaCredentials();
  await page.goto("/carteira");
  await stabilizeCookieConsent(page);
  if (await page.getByRole("button", { name: "Sair da conta" }).isVisible().catch(() => false)) return "";
  await clickStableSemanticTarget(page, page.getByRole("button", { name: "Login" }));
  const dialog = page.getByRole("dialog", { name: "Entrar" });
  const emailInput = dialog.getByLabel("E-mail");
  const passwordInput = dialog.getByLabel("Senha");
  await expect.poll(() => emailInput.evaluate((element) => (
    getComputedStyle(element).getPropertyValue("-webkit-text-security")
  ))).toBe("disc");
  await expect.poll(() => passwordInput.evaluate((element) => (
    getComputedStyle(element).getPropertyValue("-webkit-text-security")
  ))).toBe("disc");
  await emailInput.fill(credentials.email);
  await passwordInput.fill(credentials.password);
  const authentication = observeWalletAuthentication(page);
  await clickStableSemanticTarget(page, dialog.getByRole("button", { name: "Entrar", exact: true }));
  return (await expectAuthenticatedWallet(page, authentication)).idToken;
}

async function cleanArtificialHistory(page: Page) {
  const result = await page.evaluate(async ({ competences }) => {
    const email = window.localStorage.getItem("dados-fii-wallet-email") || "";
    const token = window.localStorage.getItem("dados-fii-wallet-session") || "";
    if (!email || !token) return { ok: false, reason: "missing_session" };
    const headers = {
      "Content-Type": "application/json",
      "x-wallet-email": email,
      "x-wallet-session": token,
    };
    const endpoint = "/api/portfolio/history?portfolioId=default";
    const listed = await fetch(endpoint, { headers });
    if (!listed.ok) return { ok: false, reason: `list_${listed.status}` };
    const payload = await listed.json().catch(() => ({}));
    const targets = Array.isArray(payload.entries)
      ? payload.entries.filter((entry: { competence?: string; source?: string }) => (
          competences.includes(String(entry.competence)) && entry.source === "manual"
        ))
      : [];
    for (const entry of targets) {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers,
        body: JSON.stringify({ portfolioId: "default", competence: entry.competence }),
      });
      if (!response.ok && response.status !== 404) return { ok: false, reason: `delete_${response.status}` };
    }
    window.localStorage.removeItem("dados-fii-portfolio-history-cache-v2");
    window.localStorage.removeItem("dados-fii-portfolio-history-pending-v2");
    return { ok: true };
  }, { competences: artificialCompetences });
  expect(result).toEqual({ ok: true });
}

async function saveMonth(page: Page, month: string, value: string) {
  const history = page.locator('section[aria-labelledby="portfolio-history-title"]');
  await history.getByLabel("Mês do histórico").selectOption(month);
  await history.getByLabel("Dividendos recebidos no mês").fill(value);
  await history.getByRole("button", { name: "Salvar mês" }).click();
}

async function flushHistory(page: Page) {
  const history = page.locator('section[aria-labelledby="portfolio-history-title"]');
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect(history.getByText("Sincronizado", { exact: true })).toBeVisible({ timeout: 30_000 });
}

function summarySection(page: Page) {
  return page.getByRole("heading", { name: "Leitura rápida dos números" }).locator("..").locator("..");
}

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function expectedSummary(entries: readonly QaDividendMonth[]) {
  if (!entries.length) throw new Error("Resumo exige ao menos uma competência encerrada.");
  const total = entries.reduce((sum, entry) => sum + entry.numericValue, 0);
  const best = [...entries].sort((left, right) => right.numericValue - left.numericValue)[0];
  const worst = [...entries].sort((left, right) => left.numericValue - right.numericValue)[0];
  return {
    bestMonth: `${best.shortLabel}/${currentYear}`,
    bestValue: brl(best.numericValue),
    worstMonth: `${worst.shortLabel}/${currentYear}`,
    worstValue: brl(worst.numericValue),
    total: brl(total),
    average: `Média mensal em ${currentYear}: ${brl(total / entries.length)}`,
  };
}

async function expectSummary(page: Page, expected: {
  bestMonth: string;
  bestValue: string;
  worstMonth: string;
  worstValue: string;
  total: string;
  average: string;
}) {
  const summary = summarySection(page);
  const best = summary.getByText(`Maior mês (${currentYear})`, { exact: true }).locator("..");
  const worst = summary.getByText(`Menor mês (${currentYear})`, { exact: true }).locator("..");
  const total = summary.getByText("Total do ano", { exact: true }).locator("..");
  await expect(best).toContainText(expected.bestMonth);
  await expect(best).toContainText(expected.bestValue);
  await expect(worst).toContainText(expected.worstMonth);
  await expect(worst).toContainText(expected.worstValue);
  await expect(total).toContainText(expected.total);
  const title = (await summary.locator("div.mt-5.grid").first().getAttribute("title"))?.replace(/\u00a0/g, " ");
  expect(title).toContain(expected.average);
}

async function expectNoHighImpactAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations
    .filter((violation) => ["critical", "serious"].includes(violation.impact || ""))
    .map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length }));
  expect(blocking).toEqual([]);
}

test("@smoke @critical autenticação válida, persistente, logout e acesso não autorizado bloqueado", async ({ page }) => {
  await page.goto("/fii/TGAR11");
  await stabilizeCookieConsent(page);
  await clickStableSemanticTarget(page, page.getByRole("button", { name: "Acessar Premium" }));
  await expect(page.getByText(/Entre na sua conta Premium/i)).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Login" })).toHaveCount(0);
  await login(page);
  await page.reload();
  await expect(page).toHaveURL(/\/carteira$/);
  await expect(page.getByRole("button", { name: "Sair da conta" })).toBeVisible();
  const logout = await logoutWallet(page);
  expect(logout.deleteStatus, "O smoke autenticado deve comprovar a revogação no servidor.").toBe(200);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/sistema$/);
  await expect(page.getByRole("heading", { name: "Acesso administrativo" })).toBeVisible();
});

test("@preview @full login inválido permanece fora do smoke de produção", async ({ page }) => {
  const credentials = qaCredentials();
  await page.goto("/carteira");
  await stabilizeCookieConsent(page);
  await clickStableSemanticTarget(page, page.getByRole("button", { name: "Login" }));
  const dialog = page.getByRole("dialog", { name: "Entrar" });
  await dialog.getByLabel("E-mail").fill(credentials.email);
  await dialog.getByLabel("Senha").fill("InvalidQa123456");
  await clickStableSemanticTarget(page, dialog.getByRole("button", { name: "Entrar", exact: true }));
  await expect(dialog.getByRole("alert")).toContainText(/Falha ao autenticar|Senha incorreta|Muitas tentativas/i);
  await dialog.getByRole("button", { name: "Fechar login" }).click();
});

test("@preview @full usuário de QA não é admin e sessão não aceita identidade trocada", async ({ page }) => {
  const idToken = await login(page);
  expect(idToken).not.toBe("");
  const securityProof = await page.evaluate(async (firebaseToken) => {
    const email = window.localStorage.getItem("dados-fii-wallet-email") || "";
    const walletToken = window.localStorage.getItem("dados-fii-wallet-session") || "";
    const admin = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", idToken: firebaseToken }),
    });
    const isolated = await fetch("/api/portfolio/history?portfolioId=default", {
      headers: {
        "x-wallet-email": `different-${email}`,
        "x-wallet-session": walletToken,
      },
    });
    const originalEmail = email;
    window.localStorage.setItem("dados-fii-wallet-email", "client-entitlement@example.test");
    const clientEscalation = await fetch("/api/wallet-risk-report/status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-wallet-email": "client-entitlement@example.test",
        "x-wallet-session": walletToken,
      },
      body: JSON.stringify({ email: "client-entitlement@example.test" }),
    });
    window.localStorage.setItem("dados-fii-wallet-email", originalEmail);
    return {
      adminStatus: admin.status,
      isolatedStatus: isolated.status,
      clientEscalationStatus: clientEscalation.status,
    };
  }, idToken);
  expect(securityProof).toEqual({
    adminStatus: 403,
    isolatedStatus: 401,
    clientEscalationStatus: 401,
  });

  const generations = await page.evaluate(async (firebaseToken) => {
    const email = window.localStorage.getItem("dados-fii-wallet-email") || "";
    const tokenA = window.localStorage.getItem("dados-fii-wallet-session") || "";
    const renewal = await fetch("/api/wallet/session/firebase", {
      method: "POST",
      headers: { Authorization: `Bearer ${firebaseToken}` },
    });
    const payload = await renewal.json() as { token?: string; expiresAt?: string };
    const tokenB = payload.token || "";
    const statusFor = (token: string) => new Promise<number>((resolve) => {
      const request = new XMLHttpRequest();
      request.open("GET", "/api/portfolio/history?portfolioId=default");
      request.setRequestHeader("x-wallet-email", email);
      request.setRequestHeader("x-wallet-session", token);
      request.onload = () => resolve(request.status);
      request.onerror = () => resolve(0);
      request.send();
    });

    window.sessionStorage.setItem("dados-fii-e2e-family-email", email);
    window.sessionStorage.setItem("dados-fii-e2e-family-token-a", tokenA);
    window.sessionStorage.setItem("dados-fii-e2e-family-token-b", tokenB);
    window.localStorage.setItem("dados-fii-wallet-session", tokenB);
    window.localStorage.setItem("dados-fii-wallet-session-expires-at", payload.expiresAt || "");

    return {
      renewalStatus: renewal.status,
      tokenAStatus: await statusFor(tokenA),
      tokenBStatus: await statusFor(tokenB),
    };
  }, idToken);
  expect(generations).toEqual({
    renewalStatus: 200,
    tokenAStatus: 401,
    tokenBStatus: 200,
  });

  await logoutWallet(page);
  const revokedStatuses = await page.evaluate(async () => {
    const email = window.sessionStorage.getItem("dados-fii-e2e-family-email") || "";
    const tokenA = window.sessionStorage.getItem("dados-fii-e2e-family-token-a") || "";
    const tokenB = window.sessionStorage.getItem("dados-fii-e2e-family-token-b") || "";
    const statusFor = (token: string) => new Promise<number>((resolve) => {
      const request = new XMLHttpRequest();
      request.open("GET", "/api/portfolio/history?portfolioId=default");
      request.setRequestHeader("x-wallet-email", email);
      request.setRequestHeader("x-wallet-session", token);
      request.onload = () => resolve(request.status);
      request.onerror = () => resolve(0);
      request.send();
    });
    const statuses = {
      tokenAStatus: await statusFor(tokenA),
      tokenBStatus: await statusFor(tokenB),
    };
    window.sessionStorage.removeItem("dados-fii-e2e-family-email");
    window.sessionStorage.removeItem("dados-fii-e2e-family-token-a");
    window.sessionStorage.removeItem("dados-fii-e2e-family-token-b");
    return statuses;
  });
  expect(revokedStatuses).toEqual({ tokenAStatus: 401, tokenBStatus: 401 });
});

test("@critical carteira mantém cards, gráfico, rede e persistência sincronizados", async ({ page }) => {
  await login(page);
  await page.goto("/carteira");
  await cleanArtificialHistory(page);
  await page.reload();

  try {
    const history = page.locator('section[aria-labelledby="portfolio-history-title"]');
    if (!qaMonths.length) {
      await expect(history.getByLabel("Mês do histórico").locator("option")).toHaveCount(0);
      await page.goto("/fontes-dos-dados");
      await page.goBack();
      await page.reload();
      await expect(history.getByLabel("Mês do histórico").locator("option")).toHaveCount(0);
      return;
    }

    for (const entry of qaMonths) await saveMonth(page, entry.month, entry.value);
    await flushHistory(page);

    const completeSummary = expectedSummary(qaMonths);
    await expectSummary(page, completeSummary);
    const chart = page.getByRole("heading", { name: `Dividendos pagos em ${currentYear}` }).locator("..");
    const best = [...qaMonths].sort((left, right) => right.numericValue - left.numericValue)[0];
    await expect(chart.locator("svg text").filter({ hasText: best.shortLabel })).toBeVisible();
    await expect(chart.locator("svg text").filter({ hasText: new RegExp(String(Math.trunc(best.numericValue))) })).toBeVisible();

    const february = qaMonths.find((entry) => entry.monthNumber === 2);
    if (february) {
      await history.getByRole("button", { name: `Excluir Fevereiro / ${currentYear}` }).click();
      await flushHistory(page);
      const withoutFebruary = qaMonths.filter((entry) => entry.monthNumber !== 2);
      await expectSummary(page, expectedSummary(withoutFebruary));
      await expect(chart.locator("svg text").filter({ hasText: "Fev" })).toHaveCount(0);

      await saveMonth(page, february.month, february.value);
      await flushHistory(page);
      await expectSummary(page, completeSummary);
      await expect(chart.locator("svg text").filter({ hasText: "Fev" })).toBeVisible();
    }

    let failedOnce = false;
    const historyPattern = "**/api/portfolio/history?portfolioId=default";
    await page.route(historyPattern, async (route) => {
      if (!failedOnce && ["POST", "PATCH", "DELETE"].includes(route.request().method())) {
        failedOnce = true;
        await route.abort("internetdisconnected");
        return;
      }
      await route.continue();
    });
    const networkMonth = qaMonths.at(-1)!;
    await saveMonth(page, networkMonth.month, brl(networkMonth.numericValue + 1).replace("R$", "").trim());
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await expect(history.getByText("Falha ao sincronizar", { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.unroute(historyPattern);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(history.getByText("Sincronizado", { exact: true })).toBeVisible({ timeout: 30_000 });
    await saveMonth(page, networkMonth.month, networkMonth.value);
    await flushHistory(page);

    await page.goto("/fontes-dos-dados");
    await page.goBack();
    await expectSummary(page, completeSummary);
    await page.reload();
    await expectSummary(page, completeSummary);
    await expect(chart.locator("svg text").filter({ hasText: best.shortLabel })).toBeVisible();
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.goto("/carteira").catch(() => undefined);
    await cleanArtificialHistory(page);
    await logoutWallet(page);
  }
});

test("@smoke @critical consulta de fundos trata ticker válido, ausente, inválido e responsividade", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Digite o ticker, ex: ABCD11").fill("TGAR11");
  await page.getByRole("button", { name: "Consultar" }).click();
  await expect(page.getByRole("link", { name: "TGAR11", exact: true })).toBeVisible({ timeout: 30_000 });

  await page.goto("/fii/TGAR11");
  await expect(page.getByRole("heading", { name: /TGAR11: preço, dividendos, DY e P\/VP/ })).toBeVisible();
  const percentages = (await page.locator("body").innerText()).match(/[+-]?\s*\d+(?:[.,]\d+)?\s*%/g) || [];
  for (const percentage of percentages) {
    const parsed = parseDisplayedPercentage(percentage);
    expect(parsed, `Percentual exibido em formato inválido: ${percentage}`).not.toBeNull();
    expect(Math.abs(parsed!)).toBeLessThanOrEqual(1_000);
  }

  await page.goto("/fii/ZZZZ11");
  await expect(page.getByText("Não foi possível carregar este fundo.")).toBeVisible();
  await page.goto("/");
  await page.getByPlaceholder("Digite o ticker, ex: ABCD11").fill("ABC");
  await page.getByRole("button", { name: "Consultar" }).click();
  await expect(page.getByText(/ticker inválido|Digite um ticker válido/i)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("@critical @full relatórios controlam acesso, persistem, geram PDF e não recomendam operação", async ({ page }) => {
  await login(page);
  await page.goto("/carteira");
  try {
    await page.evaluate(() => window.localStorage.setItem("dados-fii-wallet-v1", "[]"));
    await page.reload();
    await page.getByLabel("Ticker do fundo").fill("TGAR11");
    await page.getByLabel("Quantidade de cotas", { exact: true }).fill("1");
    await page.getByRole("button", { name: "Adicionar" }).last().click();
    const walletSave = page.waitForResponse((response) => (
      response.url().includes("/api/wallet-save-clean") && response.request().method() === "POST"
    ));
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    expect((await walletSave).ok()).toBe(true);

    const report = page.getByRole("heading", { name: "Relatório de risco da carteira" }).locator("..").locator("..");
    await expect(report).toBeVisible({ timeout: 30_000 });
    const generate = report.getByRole("button", { name: /Gerar relatório automático|Abrir relatório do mês/ });
    await expect(generate).toBeEnabled();
    await generate.click();
    const content = report.locator("pre");
    await expect(content).toBeVisible({ timeout: 120_000 });
    const reportText = await content.innerText();
    expect(reportText).not.toMatch(/\bcompre\b|\bvenda agora\b|\brecomendamos (?:a )?(?:compra|venda)\b/i);

    await page.reload();
    await expect(report.locator("pre")).toBeVisible({ timeout: 30_000 });
    const downloadPromise = page.waitForEvent("download");
    await report.getByRole("button", { name: "Baixar PDF" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    const stream = await download.createReadStream();
    const firstChunk = await new Promise<Buffer>((resolve, reject) => {
      stream.once("data", (chunk) => resolve(Buffer.from(chunk)));
      stream.once("error", reject);
    });
    expect(firstChunk.subarray(0, 4).toString()).toBe("%PDF");

    await page.route("**/api/wallet-risk-report", (route) => route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Erro interno ao gerar relatório." }),
    }));
    await report.getByRole("button", { name: "Abrir relatório do mês" }).click();
    await expect(report.getByText("Erro interno ao gerar relatório.")).toBeVisible();
    expect(await report.innerText()).not.toMatch(/Bearer\s|firebase|stack|token|cookie/i);
    await page.unroute("**/api/wallet-risk-report");
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.evaluate(() => window.localStorage.setItem("dados-fii-wallet-v1", "[]")).catch(() => undefined);
    const walletCleanup = page.waitForResponse((response) => (
      response.url().includes("/api/wallet-save-clean") && response.request().method() === "POST"
    )).catch(() => null);
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide"))).catch(() => undefined);
    await walletCleanup;
    await logoutWallet(page);
  }
});

test("@smoke @critical acessibilidade bloqueia violações sérias e críticas", async ({ page }) => {
  await page.goto("/");
  await expectNoHighImpactAccessibilityViolations(page);
  await page.goto("/carteira");
  await expectNoHighImpactAccessibilityViolations(page);
  await page.goto("/fii/TGAR11");
  await expectNoHighImpactAccessibilityViolations(page);
});
