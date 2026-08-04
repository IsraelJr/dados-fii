import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\//, (route) => route.abort());
  await page.addInitScript(() => {
    window.localStorage.setItem("dados-fii-wallet-v1", "[]");
    window.localStorage.setItem("dados-fii-wallet-monthly-snapshots-v1", "[]");
  });
});

test("carteira apresenta o Premium como beta sem checkout ou chamada autenticada silenciosa", async ({ page }) => {
  let discoveryRequests = 0;
  await page.route("**/api/premium/discovery**", async (route) => {
    discoveryRequests += 1;
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Autenticação necessária para o Premium." }),
    });
  });

  await page.goto("/carteira");

  const panel = page.getByTestId("premium-discovery");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Premium em validação")).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Ajude a definir o próximo nível do Dados FII" })).toBeVisible();
  await expect(panel.getByText(/não cria cobrança e não garante liberação automática/i)).toBeVisible();
  await expect(panel.getByText(/Não existe checkout nesta etapa/i)).toBeVisible();
  await expect(panel.getByRole("link", { name: "Entrar para participar" })).toHaveAttribute("href", "/login");
  await expect(panel.getByRole("button", { name: /Assinar|Comprar|Pagar/i })).toHaveCount(0);
  expect(discoveryRequests).toBe(0);

  const results = await new AxeBuilder({ page }).include('[data-testid="premium-discovery"]').analyze();
  expect(results.violations.filter((item) => ["critical", "serious"].includes(item.impact || ""))).toEqual([]);
});
