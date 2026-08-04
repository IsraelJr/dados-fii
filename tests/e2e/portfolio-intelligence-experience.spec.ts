import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

function previousClosedCompetences(count: number) {
  const first = new Date();
  first.setDate(1);
  first.setHours(12, 0, 0, 0);
  first.setMonth(first.getMonth() - count);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(first);
    date.setMonth(first.getMonth() + index);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

async function expectNoHighImpactAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["critical", "serious"].includes(item.impact || ""))).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\//, (route) => route.abort());
});

test("carteira exibe loading, análise determinística, evidências e expansão acessível", async ({ page }) => {
  const competences = previousClosedCompetences(6);
  const currentMonth = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const currentYear = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const snapshots = competences.map((competence, index) => ({
    monthKey: competence,
    label: competence,
    totalValue: 1_000,
    estimatedMonthlyIncome: 100,
    announcedMonthlyIncome: 100,
    walletCount: 1,
    topWeightTicker: "TGAR11",
    topIncomeTicker: "TGAR11",
    createdAt: new Date(2026, 0, index + 1).toISOString(),
    updatedAt: new Date(2026, 0, index + 1).toISOString(),
  }));

  await page.addInitScript(({ snapshots }) => {
    window.localStorage.setItem("dados-fii-wallet-v1", JSON.stringify([{ ticker: "TGAR11", quotas: 10 }]));
    window.localStorage.setItem("dados-fii-wallet-monthly-snapshots-v1", JSON.stringify(snapshots));
  }, { snapshots });

  await page.route("**/api/fii/batch", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
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
            price: "R$ 100,00",
            variation: "0,00%",
            [`earnings${currentYear}`]: {
              [currentMonth]: {
                earnings: "R$ 10,00",
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
  await expect(page.getByTestId("portfolio-intelligence-loading")).toBeVisible();

  const panel = page.getByTestId("portfolio-intelligence");
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("portfolio-intelligence-loading")).toHaveCount(0);
  await expect(panel).toHaveAttribute("data-analysis-state", "complete");
  await expect(page.getByTestId("portfolio-income-state")).toHaveText("Estável");
  await expect(page.getByTestId("portfolio-quality-state")).toHaveText("Suficiente");
  await expect(panel.getByRole("heading", { name: "O que merece atenção na sua carteira" })).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Dados usados nesta análise" })).toBeVisible();
  await expect(panel.getByText("Conteúdo informativo, sem recomendação de investimento.")).toBeVisible();

  const expansion = panel.getByRole("button", { name: /Ver todos os .* sinais/ });
  await expect(expansion).toBeVisible();
  await expansion.click();
  await expect(expansion).toHaveAttribute("aria-expanded", "true");
  await expect(panel.locator("[data-signal-code]").count()).resolves.toBeGreaterThan(3);

  await expectNoHighImpactAccessibilityViolations(page);
});
