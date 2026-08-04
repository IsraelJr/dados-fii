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

function incrementalReference(options: { fingerprint: string; generatedAt: string; asOf: string; latestIncome: number }) {
  return {
    schemaVersion: 1,
    fingerprint: options.fingerprint,
    policyVersion: "1.0.0",
    generatedAt: options.generatedAt,
    asOf: options.asOf,
    signals: [],
    metrics: {
      latestClosedCompetence: "2026-06",
      latestIncome: options.latestIncome,
      blockVariationPercent: 0,
      sixMonthCoefficientOfVariationPercent: 0,
      largestPositionSharePercent: 100,
      topThreeSharePercent: 100,
      patrimonyHhi: 10_000,
      largestIncomeContributorTicker: "TGAR11",
      largestIncomeContributorSharePercent: 100,
      estimatedIncomeTotal: options.latestIncome,
      patrimonyCoveragePercent: 100,
      segmentCoveragePercent: 100,
      incomeCoveragePercent: 100,
      monthsAvailable: 6,
    },
    quality: { state: "sufficient", reasonCodes: [], warningCodes: [] },
  };
}

function changedComparison() {
  const previous = incrementalReference({
    fingerprint: "previous-fingerprint",
    generatedAt: "2026-08-03T12:00:00.000Z",
    asOf: "2026-08-03T12:00:00.000Z",
    latestIncome: 110,
  });
  const current = incrementalReference({
    fingerprint: "current-fingerprint",
    generatedAt: "2026-08-04T12:00:00.000Z",
    asOf: "2026-08-04T12:00:00.000Z",
    latestIncome: 100,
  });
  const materialChange = {
    id: "data:LATEST_INCOME_CHANGED:aggravated",
    category: "data",
    state: "aggravated",
    code: "LATEST_INCOME_CHANGED",
    title: "A renda do último mês fechado mudou",
    summary: "A renda do último mês encerrado variou além da política de materialidade.",
    material: true,
    before: 110,
    after: 100,
    evidence: {
      previousAsOf: previous.asOf,
      currentAsOf: current.asOf,
      previousFingerprint: previous.fingerprint,
      currentFingerprint: current.fingerprint,
      threshold: "3% relativos",
    },
  };
  return {
    schemaVersion: 1,
    policyVersion: "1.0.0",
    status: "changed",
    previous,
    current,
    changes: [materialChange],
    materialChanges: [materialChange],
    unchangedSignalCodes: ["RENDA_ESTAVEL"],
    summary: {
      materialChangeCount: 1,
      totalChangeCount: 1,
      unchangedSignalCount: 1,
      message: "1 mudança material desde a análise anterior.",
    },
  };
}

async function preparePortfolio(page: Page) {
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
}

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\//, (route) => route.abort());
});

test("carteira exibe análise incremental, evidências e explicações sob demanda acessíveis", async ({ page }) => {
  await preparePortfolio(page);

  let signalExplanationRequests = 0;
  await page.route("**/api/portfolio/intelligence/explanation", async (route) => {
    signalExplanationRequests += 1;
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

  let incrementalRequests = 0;
  await page.route("**/api/portfolio/incremental-analysis", async (route) => {
    incrementalRequests += 1;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        comparison: changedComparison(),
        persistence: { stored: true, baselineState: "found" },
      }),
    });
  });

  let incrementalExplanationRequests = 0;
  await page.route("**/api/portfolio/incremental-analysis/explanation", async (route) => {
    incrementalExplanationRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        degraded: false,
        explanation: {
          version: "1.0.0",
          source: "ai",
          summary: "A comparação identificou uma mudança material já validada pelo domínio determinístico.",
          changeExplanations: [{
            id: "data:LATEST_INCOME_CHANGED:aggravated",
            title: "A renda do último mês fechado mudou",
            explanation: "A renda recente ficou abaixo da referência anterior e ultrapassou o limiar definido.",
            whyItMatters: "A mudança merece acompanhamento sem transformar uma única comparação em previsão futura.",
          }],
          limitations: [
            "A explicação não recalcula valores, categorias ou materialidade.",
            "A comparação depende das duas referências válidas.",
          ],
          disclaimer: "Explicação informativa de mudanças já calculadas. Não é recomendação de compra, venda, manutenção ou aporte.",
          metadata: {
            engineVersion: "test-engine",
            promptVersion: "portfolio-incremental-explanation-v1",
            model: "test-model",
            fingerprint: "incremental-test-fingerprint",
            generatedAt: "2026-08-04T19:00:00.000Z",
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

  const incrementalPanel = page.getByTestId("portfolio-incremental-report");
  await expect(incrementalPanel).toHaveAttribute("data-incremental-state", "changed");
  await expect(incrementalPanel.getByRole("heading", { name: "O que mudou desde a última análise" })).toBeVisible();
  await expect(incrementalPanel.getByText("1 mudança material desde a análise anterior.")).toBeVisible();
  await expect(incrementalPanel.locator('[data-incremental-change="LATEST_INCOME_CHANGED"]')).toBeVisible();
  expect(incrementalRequests).toBe(1);

  const evidenceButton = incrementalPanel.getByRole("button", { name: "Ver evidências da comparação" });
  await expect(evidenceButton).toHaveAttribute("aria-expanded", "false");
  await evidenceButton.click();
  await expect(evidenceButton).toHaveAttribute("aria-expanded", "true");
  await expect(incrementalPanel.getByText("3% relativos")).toBeVisible();
  await expect(incrementalPanel.getByText(/previous → current/)).toBeVisible();

  const incrementalExplanationPanel = page.getByTestId("portfolio-incremental-explanation");
  const incrementalExplanationButton = incrementalExplanationPanel.getByRole("button", { name: "Explicar estas mudanças" });
  expect(incrementalExplanationRequests).toBe(0);
  await incrementalExplanationButton.click();
  await expect(incrementalExplanationPanel.getByRole("status")).toContainText("Traduzindo as mudanças");
  await expect(incrementalExplanationPanel.locator('[data-incremental-explanation-source="ai"]')).toBeVisible();
  await expect(incrementalExplanationPanel.getByText("Explicado por IA")).toBeVisible();
  await expect(incrementalExplanationPanel.getByText("Por que importa:")).toBeVisible();
  await expect(incrementalExplanationPanel.getByRole("heading", { name: "Limitações desta leitura" })).toBeVisible();
  expect(incrementalExplanationRequests).toBe(1);

  const expansion = panel.locator('button[aria-controls="portfolio-intelligence-signals"]');
  await expect(expansion).toHaveAccessibleName(/Ver todos os .* sinais/);
  await expansion.click();
  await expect(expansion).toHaveAccessibleName("Recolher sinais");
  await expect.poll(() => panel.locator("[data-signal-code]").count()).toBeGreaterThan(3);

  const explanationPanel = page.getByTestId("portfolio-intelligence-explanation");
  const explanationButton = explanationPanel.getByRole("button", { name: "Explicar estes sinais" });
  expect(signalExplanationRequests).toBe(0);
  await explanationButton.click();
  await expect(explanationPanel.getByRole("status")).toContainText("Traduzindo os sinais");
  await expect(explanationPanel.locator('[data-explanation-source="ai"]')).toBeVisible();
  expect(signalExplanationRequests).toBe(1);

  await expectNoHighImpactAccessibilityViolations(page);
});

test("primeira análise cria referência sem inventar mudanças", async ({ page }) => {
  await preparePortfolio(page);
  const current = incrementalReference({
    fingerprint: "baseline-fingerprint",
    generatedAt: "2026-08-04T12:00:00.000Z",
    asOf: "2026-08-04T12:00:00.000Z",
    latestIncome: 100,
  });
  await page.route("**/api/portfolio/incremental-analysis", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        comparison: {
          schemaVersion: 1,
          policyVersion: "1.0.0",
          status: "baseline",
          previous: null,
          current,
          changes: [],
          materialChanges: [],
          unchangedSignalCodes: [],
          summary: {
            materialChangeCount: 0,
            totalChangeCount: 0,
            unchangedSignalCount: 0,
            message: "Esta é a primeira análise válida. Ela foi salva como referência para a próxima comparação.",
          },
        },
        persistence: { stored: true, baselineState: "missing" },
      }),
    });
  });

  await page.goto("/carteira");
  const incrementalPanel = page.getByTestId("portfolio-incremental-report");
  await expect(incrementalPanel).toHaveAttribute("data-incremental-state", "baseline");
  await expect(incrementalPanel.getByText("Primeira referência criada")).toBeVisible();
  await expect(incrementalPanel.getByText(/primeira análise válida/i)).toBeVisible();
  await expect(page.getByTestId("portfolio-incremental-explanation")).toHaveCount(0);
});
