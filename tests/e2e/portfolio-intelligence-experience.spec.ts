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

test("carteira exibe análise, expansão e explicação por IA somente após o clique", async ({ page }) => {
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

  let explanationCalls = 0;
  await page.route("**/api/portfolio/intelligence/explanation", async (route) => {
    explanationCalls += 1;
    const requestBody = route.request().postDataJSON() as { result?: unknown };
    expect(requestBody.result).toBeTruthy();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        explanation: {
          mode: "ai",
          headline: "A carteira concentra patrimônio e renda em um único fundo",
          summary: "Os sinais determinísticos mostram concentração patrimonial, de renda e por segmento, enquanto a renda recente permaneceu estável.",
          keyPoints: [
            "TGAR11 representa 100% do patrimônio coberto.",
            "TGAR11 representa 100% da renda estimada coberta.",
          ],
          limitations: [
            "A explicação usa somente os sinais e métricas já calculados pelo painel.",
          ],
          disclaimer: "Explicação informativa. Não constitui recomendação de compra, venda, manutenção ou alocação de investimentos.",
          metadata: {
            engineVersion: "1.0.0",
            promptVersion: "portfolio-intelligence-explanation-v1",
            model: "test-model",
            fingerprint: "test-fingerprint",
            generatedAt: "2026-08-04T12:00:00.000Z",
            cached: false,
            fallbackReason: null,
          },
        },
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
  await expect(panel.getByText("A IA recebe somente os sinais e métricas já calculados. Nenhum número é recalculado.")).toBeVisible();
  expect(explanationCalls).toBe(0);

  const explainButton = panel.getByRole("button", { name: "Explicar com IA" });
  await explainButton.click();
  await expect.poll(() => explanationCalls).toBe(1);
  const explanation = page.getByTestId("portfolio-intelligence-explanation");
  await expect(explanation).toHaveAttribute("data-explanation-mode", "ai");
  await expect(explanation.getByText("Explicação por IA")).toBeVisible();
  await expect(explanation.getByRole("heading", { name: "A carteira concentra patrimônio e renda em um único fundo" })).toBeVisible();
  await expect(explanation.getByText("Limitações desta explicação")).toBeVisible();
  await expect(explanation.getByText(/Não constitui recomendação de compra, venda, manutenção ou alocação/)).toBeVisible();

  const expansion = panel.locator('button[aria-controls="portfolio-intelligence-signals"]');
  await expect(expansion).toHaveAccessibleName(/Ver todos os .* sinais/);
  await expansion.click();
  await expect(expansion).toHaveAttribute("aria-expanded", "true");
  await expect(expansion).toHaveAccessibleName("Recolher sinais");
  await expect.poll(() => panel.locator("[data-signal-code]").count()).toBeGreaterThan(3);

  await expectNoHighImpactAccessibilityViolations(page);
});
