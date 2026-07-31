import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

const remoteRun = Boolean(process.env.E2E_BASE_URL);
const currentYear = new Date().getFullYear();
const artificialCompetences = Array.from({ length: 6 }, (_, index) => `${currentYear}-${String(index + 1).padStart(2, "0")}`);
const qaMonths = [
  { month: "1", value: "47,00" },
  { month: "2", value: "450,03" },
  { month: "3", value: "87,06" },
  { month: "4", value: "40,00" },
  { month: "5", value: "50,00" },
  { month: "6", value: "60,00" },
] as const;

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
  await page.goto("/");
  if (await page.getByRole("button", { name: "Sair da conta" }).isVisible().catch(() => false)) return;
  await page.getByRole("button", { name: "Login" }).click();
  const dialog = page.getByRole("dialog", { name: "Entrar" });
  await dialog.getByLabel("E-mail").fill(credentials.email);
  await dialog.getByLabel("Senha").fill(credentials.password);
  await dialog.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sair da conta" })).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => Boolean(
    window.localStorage.getItem("dados-fii-wallet-email")
    && window.localStorage.getItem("dados-fii-wallet-session"),
  ))).toBe(true);
}

async function logout(page: Page) {
  await page.goto("/");
  const button = page.getByRole("button", { name: "Sair da conta" });
  if (await button.isVisible().catch(() => false)) await button.click();
  await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(
    window.localStorage.getItem("dados-fii-wallet-email")
    || window.localStorage.getItem("dados-fii-wallet-session"),
  ))).toBe(false);
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

test("@smoke @critical autenticação válida, inválida, persistente, logout e bloqueio", async ({ page }) => {
  const credentials = qaCredentials();
  await page.goto("/fii/TGAR11");
  await page.getByRole("button", { name: "Acessar Premium" }).click();
  await expect(page.getByText(/Entre na sua conta Premium/i)).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Login" }).click();
  const dialog = page.getByRole("dialog", { name: "Entrar" });
  await dialog.getByLabel("E-mail").fill(credentials.email);
  await dialog.getByLabel("Senha").fill("InvalidQa123456");
  await dialog.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(/Falha ao autenticar|Senha incorreta|Muitas tentativas/i);
  await dialog.getByRole("button", { name: "Fechar login" }).click();

  await login(page);
  await page.reload();
  await expect(page.getByRole("button", { name: "Sair da conta" })).toBeVisible();
  await logout(page);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/sistema$/);
  await expect(page.getByRole("heading", { name: "Acesso administrativo" })).toBeVisible();
});

test("@critical carteira mantém cards, gráfico, rede e persistência sincronizados", async ({ page }) => {
  await login(page);
  await page.goto("/carteira");
  await cleanArtificialHistory(page);
  await page.reload();

  try {
    for (const entry of qaMonths) await saveMonth(page, entry.month, entry.value);
    await flushHistory(page);

    await expectSummary(page, {
      bestMonth: `Fev/${currentYear}`,
      bestValue: "R$ 450,03",
      worstMonth: `Abr/${currentYear}`,
      worstValue: "R$ 40,00",
      total: "R$ 734,09",
      average: `Média mensal em ${currentYear}: R$ 122,35`,
    });
    const chart = page.getByRole("heading", { name: `Dividendos pagos em ${currentYear}` }).locator("..");
    await expect(chart.locator("svg text").filter({ hasText: "Fev" })).toBeVisible();
    await expect(chart.locator("svg text").filter({ hasText: "R$ 450" })).toBeVisible();

    const history = page.locator('section[aria-labelledby="portfolio-history-title"]');
    await history.getByRole("button", { name: `Excluir Fevereiro / ${currentYear}` }).click();
    await flushHistory(page);
    await expectSummary(page, {
      bestMonth: `Mar/${currentYear}`,
      bestValue: "R$ 87,06",
      worstMonth: `Abr/${currentYear}`,
      worstValue: "R$ 40,00",
      total: "R$ 284,06",
      average: `Média mensal em ${currentYear}: R$ 56,81`,
    });
    await expect(chart.locator("svg text").filter({ hasText: "Fev" })).toHaveCount(0);

    await saveMonth(page, "2", "450,03");
    await flushHistory(page);
    await expectSummary(page, {
      bestMonth: `Fev/${currentYear}`,
      bestValue: "R$ 450,03",
      worstMonth: `Abr/${currentYear}`,
      worstValue: "R$ 40,00",
      total: "R$ 734,09",
      average: `Média mensal em ${currentYear}: R$ 122,35`,
    });

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
    await saveMonth(page, "6", "61,00");
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await expect(history.getByText("Falha ao sincronizar", { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.unroute(historyPattern);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(history.getByText("Sincronizado", { exact: true })).toBeVisible({ timeout: 30_000 });
    await saveMonth(page, "6", "60,00");
    await flushHistory(page);

    await page.goto("/fontes-dos-dados");
    await page.goBack();
    await expectSummary(page, {
      bestMonth: `Fev/${currentYear}`,
      bestValue: "R$ 450,03",
      worstMonth: `Abr/${currentYear}`,
      worstValue: "R$ 40,00",
      total: "R$ 734,09",
      average: `Média mensal em ${currentYear}: R$ 122,35`,
    });
    await page.reload();
    await expectSummary(page, {
      bestMonth: `Fev/${currentYear}`,
      bestValue: "R$ 450,03",
      worstMonth: `Abr/${currentYear}`,
      worstValue: "R$ 40,00",
      total: "R$ 734,09",
      average: `Média mensal em ${currentYear}: R$ 122,35`,
    });
    await expect(chart.locator("svg text").filter({ hasText: "Fev" })).toBeVisible();
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.goto("/carteira").catch(() => undefined);
    await cleanArtificialHistory(page);
    await logout(page);
  }
});

test("@smoke @critical consulta de fundos trata ticker válido, ausente, inválido e responsividade", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Digite o ticker, ex: ABCD11").fill("TGAR11");
  await page.getByRole("button", { name: "Consultar" }).click();
  await expect(page.getByRole("link", { name: "TGAR11", exact: true })).toBeVisible({ timeout: 30_000 });

  await page.goto("/fii/TGAR11");
  await expect(page.getByRole("heading", { name: /TGAR11: preço, dividendos, DY e P\/VP/ })).toBeVisible();
  const percentages = (await page.locator("body").innerText()).match(/-?\d+(?:[.,]\d+)?%/g) || [];
  for (const percentage of percentages) {
    const parsed = Number(percentage.replace("%", "").replace(/\./g, "").replace(",", "."));
    expect(Math.abs(parsed)).toBeLessThanOrEqual(1_000);
  }

  await page.goto("/fii/ZZZZ11");
  await expect(page.getByText("Não foi possível carregar este fundo.")).toBeVisible();
  await page.goto("/");
  await page.getByPlaceholder("Digite o ticker, ex: ABCD11").fill("ABC");
  await page.getByRole("button", { name: "Consultar" }).click();
  await expect(page.getByText(/ticker inválido|Digite um ticker válido/i)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("@full relatórios controlam acesso, persistem, geram PDF e não recomendam operação", async ({ page }) => {
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
    await logout(page);
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
