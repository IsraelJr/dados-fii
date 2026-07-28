import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\//, (route) => route.abort());
});

async function expectNoHighImpactAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["critical", "serious"].includes(item.impact || ""))).toEqual([]);
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

test("Home não exibe botão flutuante nem diálogo de Login", async ({ page }) => {
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

test("histórico manual permite incluir, editar e excluir dividendos sem patrimônio estimado", async ({ page }) => {
  const currentYear = new Date().getFullYear();
  const entries: Array<Record<string, unknown>> = [];
  const trackedBodies: unknown[] = [];

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
    const body = route.request().postDataJSON() as Record<string, unknown>;
    if (method === "POST") {
      expect(body).not.toHaveProperty("totalValue");
      const competence = `${body.year}-${String(body.month).padStart(2, "0")}`;
      entries.splice(0, entries.length, {
        schemaVersion: 1,
        portfolioId: "default",
        competence,
        totalValue: null,
        dividends: 120,
        source: "manual",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true, entry: entries[0] }) });
      return;
    }
    if (method === "PATCH") {
      expect(body).not.toHaveProperty("totalValue");
      entries[0] = { ...entries[0], dividends: 130, updatedAt: new Date().toISOString() };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, entry: entries[0] }) });
      return;
    }
    entries.splice(0, entries.length);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/carteira");
  const history = page.locator('section[aria-labelledby="portfolio-history-title"]');
  await expect(history.getByRole("heading", { name: "Complete seu histórico de dividendos" })).toBeVisible();
  await expect(history.getByLabel("Patrimônio do mês")).toHaveCount(0);
  await history.getByLabel("Ano do histórico").fill(String(currentYear));
  await history.getByLabel("Mês do histórico").selectOption("1");
  await history.getByLabel("Dividendos recebidos no mês").fill("120,00");
  await history.getByRole("button", { name: "Adicionar" }).click();
  await expect(history.getByText("R$ 120,00")).toBeVisible();

  await history.getByRole("button", { name: /Editar/ }).click();
  await history.getByLabel("Dividendos recebidos no mês").fill("130,00");
  await history.getByRole("button", { name: "Salvar" }).click();
  await expect(history.getByText("R$ 130,00")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await history.getByRole("button", { name: /Excluir/ }).click();
  await expect(history.getByText("Nenhum dividendo informado no ano corrente.")).toBeVisible();

  await expect.poll(() => trackedBodies.length).toBeGreaterThanOrEqual(4);
  for (const body of trackedBodies) expect(Object.keys(body as Record<string, unknown>)).toEqual(["name"]);
  await expectNoHighImpactAccessibilityViolations(page);
});

test("área administrativa permanece fechada sem sessão", async ({ page }) => {
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
