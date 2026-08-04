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

test("carteira exibe análise, evidências, expansão e explicação sob demanda acessíveis", async ({ page }) => {
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

  let explanationRequests = 0;
  await page.route("**/api/portfolio/intelligence/explanation", async (route) => {
    explanationRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 120));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        degraded: false,
        explanation: {
          version: "1.0.0",
          source: "ai",
          summary: "Os sinais indicam estabilidade recente, acompanhada por concentração que merece atenção.",
          signalExplanations: [{
            code: "RENDA_ESTAVEL",
            title: "Sua renda recente ficou estável",
            explanation: "O fluxo de renda manteve um comportamento previsível no histórico observado.",
            whyItMatters: "A estabilidade ajuda no planejamento, sem garantir que o mesmo padrão continuará.",
            confidence: "high",
          }],
          overallConfidence: "high",
          limitations: [
            "A leitura depende do histórico disponível e não antecipa distribuições futuras.",
            "A explicação não altera, completa ou recalcula as métricas determinísticas.",
          ],
          disclaimer: "Explicação informativa dos sinais calculados. Não é recomendação de compra, venda ou manutenção de ativos.",
          metadata: {
            engineVersion: "test-engine",
            promptVersion: "portfolio-intelligence-explanation-v1",
            model: "test-model",
            fingerprint: "test-fingerprint",
            generatedAt: "2026-08-04T15:00:00.000Z",
            cached: false,
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
  await expect(panel.getByRole("heading", { name: "O que merece atenção na sua carteira" })).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Dados usados nesta análise" })).toBeVisible();
  await expect(panel.getByText("Conteúdo informativo, sem recomendação de investimento.")).toBeVisible();

  const expansion = panel.locator('button[aria-controls="portfolio-intelligence-signals"]');
  await expect(expansion).toHaveAccessibleName(/Ver todos os .* sinais/);
  await expect(expansion).toHaveAttribute("aria-expanded", "false");
  await expansion.click();
  await expect(expansion).toHaveAttribute("aria-expanded", "true");
  await expect(expansion).toHaveAccessibleName("Recolher sinais");
  await expect.poll(() => panel.locator("[data-signal-code]").count()).toBeGreaterThan(3);

  const explanationPanel = page.getByTestId("portfolio-intelligence-explanation");
  const explanationButton = explanationPanel.getByRole("button", { name: "Explicar estes sinais" });
  await expect(explanationButton).toBeVisible();
  expect(explanationRequests).toBe(0);
  await explanationButton.click();
  await expect(explanationPanel.getByRole("status")).toContainText("Traduzindo os sinais");
  await expect(explanationPanel.locator('[data-explanation-source="ai"]')).toBeVisible();
  await expect(explanationPanel.getByText("Explicado por IA")).toBeVisible();
  await expect(explanationPanel.getByText("Por que importa:")).toBeVisible();
  await expect(explanationPanel.getByRole("heading", { name: "Limitações desta leitura" })).toBeVisible();
  await expect(explanationPanel.getByText(/Não é recomendação de compra, venda ou manutenção/)).toBeVisible();
  expect(explanationRequests).toBe(1);

  await expectNoHighImpactAccessibilityViolations(page);
});
