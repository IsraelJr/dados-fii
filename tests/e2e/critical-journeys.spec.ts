import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { saoPauloCalendarPeriod } from "./support/closedCompetences";

test.skip(Boolean(process.env.E2E_BASE_URL), "Suíte determinística local; jornadas remotas ficam em functional-qa.spec.ts.");

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\//, (route) => route.abort());
});

async function expectNoHighImpactAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["critical", "serious"].includes(item.impact || ""))).toEqual([]);
}

function latestClosedCompetences(count: number) {
  const period = saoPauloCalendarPeriod();
  return Array.from({ length: count }, (_, index) => {
    const offset = count - index;
    const date = new Date(Date.UTC(period.year, period.month - 1 - offset, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

test("página pública possui estrutura, navegação e acessibilidade essenciais", async ({ page }) => {
  const response = await page.goto("/fontes-dos-dados");
  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Fontes dos dados");
  await expect(page.getByRole("link", { name: "Dados FII - Início" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).not.toHaveCount(0);
  await expectNoHighImpactAccessibilityViolations(page);
});

test("Home preserva o botão flutuante de login oculto", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Login" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Entrar" })).toHaveCount(0);
  await expectNoHighImpactAccessibilityViolations(page);
});

test("carteira adiciona um fundo, persiste localmente e permanece acessível", async ({ page }) => {
  const currentMonth = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "America/Sao_Paulo" }).format(new Date());
  const currentYear = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date());
  await page.route("**/api/fii/batch", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        items: {
          TGAR11: {
            code: "TGAR11",
            name: "TG Ativo Real",
            segment: "Híbrido",
            price: "R$ 82,50",
            variation: "0,75%",
            [`earnings${currentYear}`]: {
              [currentMonth]: { earnings: "R$ 0,83", payment_date: "31/12/2099", date_with: "15/12/2099" },
            },
          },
        },
        errors: {},
      }),
    });
  });

  await page.goto("/carteira");
  await page.getByLabel("Ticker do fundo").fill("TGAR11");
  await page.getByLabel("Quantidade de cotas", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Adicionar" }).last().click();
  await expect(page.getByRole("link", { name: "TGAR11" }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("dados-fii-wallet-v1"))).toContain("TGAR11");
  await expectNoHighImpactAccessibilityViolations(page);
});

test("histórico manual permite incluir, sobrescrever, excluir e sincronizar dividendos", async ({ page }) => {
  const entries: Array<Record<string, unknown>> = [];
  const trackedBodies: unknown[] = [];
  const mutationMethods: string[] = [];

  await page.addInitScript(() => {
    window.localStorage.setItem("dados-fii-wallet-email", "e2e@example.com");
    window.localStorage.setItem("dados-fii-wallet-session", "session-e2e");
  });

  await page.route("**/api/product/events", async (route) => {
    trackedBodies.push(route.request().postDataJSON());
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.route("**/api/portfolio/history?portfolioId=default", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, entries }) });
      return;
    }

    mutationMethods.push(method);
    const body = route.request().postDataJSON() as Record<string, unknown>;
    expect(body).not.toHaveProperty("totalValue");

    if (method === "POST") {
      const competence = `${body.year}-${String(body.month).padStart(2, "0")}`;
      entries.splice(0, entries.length, {
        schemaVersion: 1,
        portfolioId: "default",
        competence,
        totalValue: null,
        dividends: Number(body.dividends),
        source: "manual",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true, entry: entries[0] }) });
      return;
    }

    if (method === "PATCH") {
      entries[0] = { ...entries[0], dividends: Number(body.dividends), updatedAt: new Date().toISOString() };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, entry: entries[0] }) });
      return;
    }

    entries.splice(0, entries.length);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/carteira");
  const history = page.locator('section[aria-labelledby="portfolio-history-title"]');
  const chips = history.getByLabel("Meses informados no histórico");
  await expect(history.getByRole("heading", { name: "Complete seu histórico de dividendos" })).toBeVisible();
  await expect(history.getByLabel("Patrimônio do mês")).toHaveCount(0);
  await expect(history.getByLabel("Ano do histórico")).toBeDisabled();

  await history.getByLabel("Mês do histórico").selectOption("1");
  await history.getByLabel("Dividendos recebidos no mês").fill("120,00");
  await history.getByRole("button", { name: "Salvar mês" }).click();
  await expect(chips.getByText("R$ 120,00", { exact: true })).toBeVisible();
  await expect(page.locator("svg text", { hasText: "R$ 120" })).toBeVisible();

  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect.poll(() => mutationMethods).toContain("POST");

  await history.getByLabel("Mês do histórico").selectOption("1");
  await history.getByLabel("Dividendos recebidos no mês").fill("130,00");
  await history.getByRole("button", { name: "Salvar mês" }).click();
  await expect(chips.getByText("R$ 130,00", { exact: true })).toBeVisible();
  await expect(page.locator("svg text", { hasText: "R$ 130" })).toBeVisible();

  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect.poll(() => mutationMethods).toContain("PATCH");

  await history.getByRole("button", { name: /Excluir/ }).click();
  await expect(chips.getByText("R$ 130,00", { exact: true })).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect.poll(() => mutationMethods).toContain("DELETE");

  await expect.poll(() => trackedBodies.length).toBeGreaterThanOrEqual(3);
  for (const body of trackedBodies) expect(Object.keys(body as Record<string, unknown>)).toEqual(["name"]);
  await expectNoHighImpactAccessibilityViolations(page);
});

test("resumo e gráfico usam o mesmo histórico consolidado e preservam fevereiro", async ({ page }) => {
  const currentYear = new Date().getFullYear();
  const now = new Date().toISOString();
  const entries: Array<Record<string, unknown>> = [{
    schemaVersion: 1,
    portfolioId: "default",
    competence: `${currentYear}-01`,
    totalValue: null,
    dividends: 100,
    source: "manual",
    createdAt: now,
    updatedAt: now,
  }];
  const mutationMethods: string[] = [];

  await page.addInitScript(() => {
    window.localStorage.setItem("dados-fii-wallet-email", "summary-e2e@example.com");
    window.localStorage.setItem("dados-fii-wallet-session", "summary-session-e2e");
  });

  await page.route("**/api/product/events", async (route) => {
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.route("**/api/portfolio/history?portfolioId=default", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, entries }) });
      return;
    }

    mutationMethods.push(method);
    const body = route.request().postDataJSON() as Record<string, unknown>;
    const competence = method === "POST"
      ? `${body.year}-${String(body.month).padStart(2, "0")}`
      : String(body.competence);

    if (method === "DELETE") {
      const index = entries.findIndex((entry) => entry.competence === competence);
      if (index >= 0) entries.splice(index, 1);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      return;
    }

    const entry = {
      schemaVersion: 1,
      portfolioId: "default",
      competence,
      totalValue: null,
      dividends: Number(body.dividends),
      source: "manual",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const index = entries.findIndex((item) => item.competence === competence);
    if (index >= 0) entries[index] = entry;
    else entries.push(entry);
    await route.fulfill({
      status: method === "POST" ? 201 : 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, entry }),
    });
  });

  await page.goto("/carteira");
  const history = page.locator('section[aria-labelledby="portfolio-history-title"]');
  const summary = page.getByRole("heading", { name: "Leitura rápida dos números" }).locator("..").locator("..");
  const summaryGrid = summary.locator("div.mt-5.grid").first();
  const bestMonth = summary.getByText(`Maior mês (${currentYear})`, { exact: true }).locator("..");
  const yearTotal = summaryGrid.locator(":scope > div").nth(5);
  const dividendChart = page.getByRole("heading", { name: `Dividendos pagos em ${currentYear}` }).locator("..");

  await expect(summaryGrid).toHaveAttribute("class", "mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6");
  await expect(summaryGrid.locator(":scope > div")).toHaveCount(6);
  await expect(summaryGrid.locator(":scope > div > p:first-child")).toHaveText([
    `Maior mês (${currentYear})`,
    `Menor mês (${currentYear})`,
    "Maior da história",
    "Menor da história",
    "Maior ano de dividendos",
    "Total do ano",
  ]);

  await history.getByLabel("Mês do histórico").selectOption("2");
  await history.getByLabel("Dividendos recebidos no mês").fill("450,03");
  await history.getByRole("button", { name: "Salvar mês" }).click();
  await expect(history.getByText("Salvo neste dispositivo", { exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect.poll(() => mutationMethods.filter((method) => method === "POST").length).toBe(1);
  await expect(history.getByText("Sincronizado", { exact: true })).toBeVisible();

  await expect(bestMonth).toContainText(`Fev/${currentYear}`);
  await expect(bestMonth).toContainText("R$ 450,03");
  await expect(yearTotal).toContainText("R$ 550,03");
  await expect(dividendChart.locator("svg text").filter({ hasText: "Fev" })).toBeVisible();
  await expect(dividendChart.locator("svg text").filter({ hasText: "R$ 450" })).toBeVisible();

  await history.getByRole("button", { name: `Excluir Fevereiro / ${currentYear}` }).click();
  await expect(history.getByText("Salvo neste dispositivo", { exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect.poll(() => mutationMethods).toContain("DELETE");
  await expect(history.getByText("Sincronizado", { exact: true })).toBeVisible();
  await expect(bestMonth).toContainText(`Jan/${currentYear}`);
  await expect(bestMonth).toContainText("R$ 100,00");
  await expect(yearTotal).toContainText("R$ 100,00");
  await expect(dividendChart.locator("svg text").filter({ hasText: "Fev" })).toHaveCount(0);

  await history.getByLabel("Mês do histórico").selectOption("2");
  await history.getByLabel("Dividendos recebidos no mês").fill("450,03");
  await history.getByRole("button", { name: "Salvar mês" }).click();
  await expect(history.getByText("Salvo neste dispositivo", { exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect.poll(() => mutationMethods.filter((method) => method === "POST").length).toBe(2);
  await expect(history.getByText("Sincronizado", { exact: true })).toBeVisible();
  await expect(bestMonth).toContainText(`Fev/${currentYear}`);
  await expect(bestMonth).toContainText("R$ 450,03");
  await expect(yearTotal).toContainText("R$ 550,03");
  await expect(dividendChart.locator("svg text").filter({ hasText: "Fev" })).toBeVisible();
  await expect(dividendChart.locator("svg text").filter({ hasText: "R$ 450" })).toBeVisible();

  await page.goto("/fontes-dos-dados");
  await page.goBack();
  await expect(bestMonth).toContainText(`Fev/${currentYear}`);
  await expect(bestMonth).toContainText("R$ 450,03");
  await expect(yearTotal).toContainText("R$ 550,03");

  await page.reload();
  await expect(bestMonth).toContainText(`Fev/${currentYear}`);
  await expect(bestMonth).toContainText("R$ 450,03");
  await expect(yearTotal).toContainText("R$ 550,03");
  await expect(dividendChart.locator("svg text").filter({ hasText: "Fev" })).toBeVisible();
});

test("inteligência apresenta carregamento, resumo, três prioridades, evidências e expansão acessível", async ({ page }) => {
  const now = new Date().toISOString();
  const entries = latestClosedCompetences(6).map((competence, index) => ({
    schemaVersion: 1,
    portfolioId: "default",
    competence,
    totalValue: null,
    dividends: index < 3 ? 100 : 110,
    source: "manual",
    createdAt: now,
    updatedAt: now,
  }));
  const currentYear = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date());
  const currentMonth = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "America/Sao_Paulo" }).format(new Date());
  let releaseBatch: () => void = () => {};
  const batchBarrier = new Promise<void>((resolve) => { releaseBatch = resolve; });

  await page.addInitScript(({ historyEntries }) => {
    window.localStorage.setItem("dados-fii-wallet-email", "intelligence-e2e@example.com");
    window.localStorage.setItem("dados-fii-wallet-session", "intelligence-session-e2e");
    window.localStorage.setItem("dados-fii-wallet-v1", JSON.stringify([{ ticker: "TGAR11", quotas: 10 }]));
    window.localStorage.setItem("dados-fii-portfolio-history-cache-v2", JSON.stringify(historyEntries));
  }, { historyEntries: entries });

  await page.route("**/api/portfolio/history?portfolioId=default", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, entries }),
  }));
  await page.route("**/api/fii/batch", async (route) => {
    await batchBarrier;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        items: {
          TGAR11: {
            code: "TGAR11",
            name: "TG Ativo Real",
            segment: "Híbrido",
            price: "R$ 10,00",
            [`earnings${currentYear}`]: {
              [currentMonth]: { earnings: "R$ 1,00", payment_date: "31/12/2099", date_with: "15/12/2099" },
            },
          },
        },
        errors: {},
      }),
    });
  });

  await page.goto("/carteira");
  const loading = page.getByTestId("portfolio-intelligence-loading");
  await expect(loading).toBeVisible();
  await expect(loading).toHaveAttribute("aria-busy", "true");
  await expect(page.locator('[data-signal-code="DADOS_INSUFICIENTES"]')).toHaveCount(0);
  releaseBatch();

  const intelligence = page.getByTestId("portfolio-intelligence");
  await expect(intelligence).toBeVisible();
  await expect(intelligence).toHaveAttribute("data-analysis-state", "complete");
  await expect(intelligence.getByTestId("portfolio-income-state")).toHaveText("Alta");
  await expect(intelligence.getByTestId("portfolio-quality-state")).toHaveText("Suficiente");
  await expect(intelligence.getByTestId("portfolio-attention-count")).toHaveText("3 pontos");
  await expect(intelligence.locator("[data-signal-code]")).toHaveCount(3);
  await expect(intelligence.locator('[data-signal-code="RENDA_EM_ALTA"]')).toHaveCount(0);
  await expect(intelligence.getByText("Confiança alta").first()).toBeVisible();
  await expect(intelligence.getByText("Alerta").first()).toBeVisible();

  const expand = intelligence.locator('button[aria-controls="portfolio-intelligence-signals"]');
  await expect(expand).toHaveAccessibleName("Ver todos os 4 sinais");
  await expect(expand).toHaveAttribute("aria-expanded", "false");
  await expect(expand).toHaveAttribute("aria-controls", "portfolio-intelligence-signals");
  await expand.focus();
  await page.keyboard.press("Enter");
  await expect(expand).toHaveAttribute("aria-expanded", "true");
  await expect(expand).toHaveAccessibleName("Recolher sinais");
  await expect(intelligence.locator("[data-signal-code]")).toHaveCount(4);
  await expect(intelligence.locator('[data-signal-code="RENDA_EM_ALTA"]')).toBeVisible();
  await expect(intelligence.getByText("R$ 100,00", { exact: true }).first()).toBeVisible();
  await expect(intelligence.getByText("10%", { exact: true }).first()).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(expand).toHaveAttribute("aria-expanded", "false");
  await expect(intelligence.locator("[data-signal-code]")).toHaveCount(3);

  await expect(intelligence.getByRole("heading", { name: "Dados usados nesta análise" })).toBeVisible();
  await expect(intelligence.getByText("6 de 6 meses encerrados necessários")).toBeVisible();
  await expect(intelligence.getByText("1 com cotação e 0 sem cotação, de 1 posição(ões)")).toBeVisible();
  await expect(intelligence.getByText("Cobertura de segmentos").locator("..")).toContainText("100%");
  await expect(intelligence.getByText("Cobertura de renda").locator("..")).toContainText("100%");
  await expect(intelligence).toHaveClass(/dark:bg-gray-950/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await expectNoHighImpactAccessibilityViolations(page);
});

test("área administrativa permanece fechada sem sessão", async ({ page }) => {
  await page.route("**/api/admin/session", (route) => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ ok: false, error: "Sessão administrativa necessária." }),
  }));
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/sistema$/);
  await expect(page.getByRole("heading", { level: 1, name: "Acesso administrativo" })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Senha")).toBeVisible();
  await expectNoHighImpactAccessibilityViolations(page);
});

test("respostas públicas recebem headers defensivos e correlação", async ({ request }) => {
  const response = await request.get("/");
  expect(response.status()).toBe(200);
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["x-powered-by"]).toBeUndefined();
  expect(headers["x-correlation-id"]).toMatch(/^[A-Za-z0-9._-]{8,128}$/);
  expect(headers["set-cookie"]).toMatch(/anonId=.*HttpOnly.*SameSite=Lax/i);
});

test("contratos HTTP rejeitam ticker inválido, duplicidade e mutação anônima", async ({ request }) => {
  const invalidTicker = await request.get("/api/fii?ticker=ABC");
  expect(invalidTicker.status()).toBe(400);
  await expect(invalidTicker.json()).resolves.toMatchObject({ code: "invalid_ticker" });
  const duplicateTicker = await request.get("/api/fii?ticker=TGAR11&ticker=MXRF11");
  expect(duplicateTicker.status()).toBe(400);
  await expect(duplicateTicker.json()).resolves.toMatchObject({ code: "duplicate_ticker" });
  const anonymousMutation = await request.post("/api/admin/create-fii", { data: { ticker: "TGAR11" } });
  expect(anonymousMutation.status()).toBe(401);
  await expect(anonymousMutation.json()).resolves.toMatchObject({ error: expect.stringMatching(/sessão|autentica|credencial/i) });
  const premium = await request.get("/api/fii/TGAR11/report/premium");
  expect(premium.status()).toBe(401);
  const externalOrigin = await request.post("/api/admin/session", {
    headers: { Origin: "https://evil.example" },
    data: { action: "login", idToken: "token-sintetico-invalido" },
  });
  expect(externalOrigin.status()).toBe(403);
  expect((await request.get("/recurso-que-nao-existe-corrective")).status()).toBe(404);
  expect((await request.get("/api/system/risk-lab-cohort-backtest?action=run")).status()).toBe(405);
  expect((await request.get("/api/health/risk-lab-premium")).status()).toBe(503);
});
