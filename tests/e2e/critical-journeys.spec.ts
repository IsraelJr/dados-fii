import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\//, (route) => route.abort());
});

async function expectNoHighImpactAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((item) =>
      ["critical", "serious"].includes(item.impact || ""),
    ),
  ).toEqual([]);
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

test("login possui diálogo modal, validação compreensível e restauração de foco", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Login" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Entrar" });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeFocused();
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("email válido");
  await expectNoHighImpactAccessibilityViolations(page);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("carteira adiciona um fundo, persiste localmente e permanece acessível", async ({ page }) => {
  const currentMonth = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const currentYear = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
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
              [currentMonth]: {
                earnings: "R$ 0,83",
                payment_date: "31/12/2099",
                date_with: "15/12/2099",
              },
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
  await page.getByRole("button", { name: "Adicionar" }).click();

  await expect(page.getByRole("link", { name: "TGAR11" }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() =>
    window.localStorage.getItem("dados-fii-wallet-v1"),
  )).toContain("TGAR11");
  await expectNoHighImpactAccessibilityViolations(page);
});

test("área administrativa permanece fechada sem sessão", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/sistema$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Acesso administrativo" }),
  ).toBeVisible();
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

  const anonymousMutation = await request.post("/api/admin/create-fii", {
    data: { ticker: "TGAR11" },
  });
  expect(anonymousMutation.status()).toBe(401);
  await expect(anonymousMutation.json()).resolves.toMatchObject({
    error: expect.stringMatching(/sessão|autentica|credencial/i),
  });

  const premium = await request.get("/api/fii/TGAR11/report/premium");
  expect(premium.status()).toBe(401);

  const externalOrigin = await request.post("/api/admin/session", {
    headers: { Origin: "https://evil.example" },
    data: { action: "login", idToken: "token-sintetico-invalido" },
  });
  expect(externalOrigin.status()).toBe(403);

  const missing = await request.get("/recurso-que-nao-existe-corrective");
  expect(missing.status()).toBe(404);

  const forbiddenEvidenceMutation = await request.get(
    "/api/system/risk-lab-cohort-backtest?action=run",
  );
  expect(forbiddenEvidenceMutation.status()).toBe(405);

  const disabledPremiumHealth = await request.get(
    "/api/health/risk-lab-premium",
  );
  expect(disabledPremiumHealth.status()).toBe(503);
});
