import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/editorial/events", async (route) => {
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.route(/^https:\/\//, (route) => route.abort());
});

test("hub apresenta sete cenários específicos e links de continuidade", async ({ page }) => {
  await page.goto("/mercado");
  await expect(page.getByRole("heading", { level: 1, name: "Mercado de FIIs e cenários por segmento" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir análise" })).toHaveCount(7);
  await expect(page.getByText("FIAGRO e agronegócio: cenário da safra, crédito e riscos")).toBeVisible();
  await expect(page.getByText("FIIs de galpões e logística: demanda, contratos e localização")).toBeVisible();
  await expect(page.getByText("FIIs de shoppings: vendas, ocupação e qualidade do portfólio")).toBeVisible();
  await expect(page.getByRole("link", { name: /Analisar minha carteira/ })).toHaveAttribute("href", "/carteira");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["critical", "serious"].includes(item.impact || ""))).toEqual([]);
});

test("página de cenário expõe data-base, fontes, limitações e schema editorial", async ({ page }) => {
  await page.goto("/mercado/galpoes-logistica");
  await expect(page.getByRole("heading", { level: 1, name: "FIIs de galpões e logística: demanda, contratos e localização" })).toBeVisible();
  await expect(page.getByText(/Data-base:/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Indicadores de contexto" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fontes e atualização" })).toBeVisible();
  await expect(page.getByText("Sem recomendação de compra ou venda")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Limitações desta leitura" })).toBeVisible();
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(2);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/mercado\/galpoes-logistica$/);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["critical", "serious"].includes(item.impact || ""))).toEqual([]);
});

test("slug desconhecido retorna 404 real", async ({ page }) => {
  const response = await page.goto("/mercado/cenario-generico-inexistente");
  expect(response?.status()).toBe(404);
});
