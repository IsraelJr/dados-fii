import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

function sha256Fingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

const PREVIOUS_REFERENCE_FINGERPRINT = sha256Fingerprint("portfolio-reference:previous");
const CURRENT_REFERENCE_FINGERPRINT = sha256Fingerprint("portfolio-reference:current");

function previousClosedCompetences(count: number, asOf: Date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(asOf).map((part) => [part.type, part.value]));
  const currentOrdinal = Number(parts.year) * 12 + Number(parts.month) - 1;
  return Array.from({ length: count }, (_, index) => {
    const ordinal = currentOrdinal - count + index;
    const year = Math.floor(ordinal / 12);
    const month = ordinal % 12 + 1;
    return `${year}-${String(month).padStart(2, "0")}`;
  });
}

async function expectNoHighImpactAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["critical", "serious"].includes(item.impact || ""))).toEqual([]);
}

function incrementalReference(options: { fingerprint: string; generatedAt: string; asOf: string; latestIncome: number }) {
  return {
    schemaVersion: 2,
    fingerprint: options.fingerprint,
    dataFingerprint: sha256Fingerprint(`portfolio-data:${options.fingerprint}`),
    policyFingerprint: sha256Fingerprint("portfolio-policy:1.0.0"),
    domainVersion: "2.0.0",
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
    quality: {
      state: "sufficient",
      reasonCodes: [],
      warningCodes: [],
      warnings: [],
      confidence: { trend: "high", concentration: "high", segments: "high", income: "high" },
      pricedPositionCount: 1,
      unpricedPositionCount: 0,
      knownSegmentPositionCount: 1,
      incomeKnownPositionCount: 1,
      monthsRequired: 6,
    },
  };
}

function changedComparison() {
  const previous = incrementalReference({
    fingerprint: PREVIOUS_REFERENCE_FINGERPRINT,
    generatedAt: "2026-08-03T12:00:00.000Z",
    asOf: "2026-08-03T12:00:00.000Z",
    latestIncome: 110,
  });
  const current = incrementalReference({
    fingerprint: CURRENT_REFERENCE_FINGERPRINT,
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
    schemaVersion: 2,
    policyVersion: "2.0.0",
    comparisonId: sha256Fingerprint("portfolio-comparison:changed"),
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

function unchangedComparison() {
  const reference = incrementalReference({
    fingerprint: sha256Fingerprint("portfolio-reference:unchanged"),
    generatedAt: "2026-08-04T12:00:00.000Z",
    asOf: "2026-08-04T12:00:00.000Z",
    latestIncome: 100,
  });
  return {
    schemaVersion: 2,
    policyVersion: "2.0.0",
    comparisonId: sha256Fingerprint("portfolio-comparison:unchanged"),
    status: "unchanged",
    previous: reference,
    current: reference,
    changes: [],
    materialChanges: [],
    unchangedSignalCodes: ["RENDA_ESTAVEL"],
    summary: {
      materialChangeCount: 0,
      totalChangeCount: 0,
      unchangedSignalCount: 1,
      message: "Nenhuma mudança material desde a análise anterior.",
    },
  };
}

async function preparePortfolio(page: Page, options: { authenticated?: boolean } = {}) {
  const authenticated = options.authenticated !== false;
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

  await page.addInitScript(({ snapshots, authenticated }) => {
    window.localStorage.setItem("dados-fii-wallet-v1", JSON.stringify([{ ticker: "TGAR11", quotas: 10 }]));
    window.localStorage.setItem("dados-fii-wallet-monthly-snapshots-v1", JSON.stringify(snapshots));
    if (authenticated) {
      window.localStorage.setItem("dados-fii-wallet-email", "portfolio-e2e@example.test");
      window.localStorage.setItem("dados-fii-wallet-session", "portfolio-e2e-session");
      window.localStorage.setItem("dados-fii-wallet-cloud-load-cache-v1", JSON.stringify({
        email: "portfolio-e2e@example.test",
        signature: JSON.stringify([{ ticker: "TGAR11", quotas: 10 }]),
        loadedAt: Date.now(),
      }));
    } else {
      window.localStorage.removeItem("dados-fii-wallet-email");
      window.localStorage.removeItem("dados-fii-wallet-session");
      window.localStorage.removeItem("dados-fii-wallet-cloud-load-cache-v1");
    }
  }, { snapshots, authenticated });

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

  await page.route("**/api/wallet-load-legacy", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, wallet: [{ ticker: "TGAR11", quotas: 10 }] }),
  }));
  await page.route("**/api/wallet/snapshots", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, snapshots: [] }),
  }));
  await page.route("**/api/wallet-save-clean", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, saved: 1 }),
  }));
  await page.route("**/api/portfolio/history?portfolioId=default", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, entries: [] }),
  }));
  await page.route("**/api/product/events", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true }),
  }));
  await page.route("**/api/portfolio/incremental-analysis/availability", (route) => route.fulfill({
    status: 204,
    body: "",
  }));
}

async function addOrUpdatePosition(page: Page, quotas = 10) {
  await page.getByLabel("Ticker do fundo").fill("TGAR11");
  await page.getByLabel("Quantidade de cotas").fill(String(quotas));
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\//, (route) => route.abort());
});

test("competências encerradas respeitam São Paulo nas fronteiras de mês e ano", () => {
  expect(previousClosedCompetences(2, new Date("2027-01-01T02:59:59.000Z"))).toEqual([
    "2026-10",
    "2026-11",
  ]);
  expect(previousClosedCompetences(2, new Date("2027-01-01T03:00:00.000Z"))).toEqual([
    "2026-11",
    "2026-12",
  ]);
  expect(previousClosedCompetences(2, new Date("2027-02-01T03:00:00.000Z"))).toEqual([
    "2026-12",
    "2027-01",
  ]);
});

test("carteira exibe análise incremental, evidências e explicações sob demanda acessíveis", async ({ page }) => {
  await preparePortfolio(page);

  let walletSaveRequests = 0;
  await page.route("**/api/wallet-save-clean", async (route) => {
    walletSaveRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, saved: 1 }),
    });
  });

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
            fingerprint: sha256Fingerprint("portfolio-primary-explanation"),
            generatedAt: "2026-08-04T15:00:00.000Z",
            cached: false,
          },
        },
      }),
    });
  });

  let incrementalRequests = 0;
  const incrementalBodies: unknown[] = [];
  await page.route("**/api/portfolio/incremental-analysis", async (route) => {
    incrementalRequests += 1;
    incrementalBodies.push(route.request().postDataJSON());
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
  const incrementalExplanationBodies: unknown[] = [];
  await page.route("**/api/portfolio/incremental-analysis/explanation", async (route) => {
    incrementalExplanationRequests += 1;
    incrementalExplanationBodies.push(route.request().postDataJSON());
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
            fingerprint: sha256Fingerprint("portfolio-incremental-explanation"),
            generatedAt: "2026-08-04T19:00:00.000Z",
            cached: false,
          },
        },
      }),
    });
  });

  await page.goto("/carteira");
  await expect(page.getByTestId("portfolio-intelligence-loading")).toBeVisible();
  await addOrUpdatePosition(page);

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
  expect(incrementalBodies).toEqual([{ portfolioId: "default" }]);

  const evidenceButton = incrementalPanel.locator('button[aria-controls^="incremental-evidence-"]');
  await expect(evidenceButton).toHaveAccessibleName("Ver evidências da comparação");
  await expect(evidenceButton).toHaveAttribute("aria-expanded", "false");
  await evidenceButton.click();
  await expect(evidenceButton).toHaveAttribute("aria-expanded", "true");
  await expect(evidenceButton).toHaveAccessibleName("Ocultar evidências");
  await expect(incrementalPanel.getByText("3% relativos")).toBeVisible();
  await expect(incrementalPanel.getByText(
    `${PREVIOUS_REFERENCE_FINGERPRINT.slice(0, 8)} → ${CURRENT_REFERENCE_FINGERPRINT.slice(0, 8)}`,
  )).toBeVisible();

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
  expect(incrementalExplanationBodies).toEqual([{
    portfolioId: "default",
    currentFingerprint: CURRENT_REFERENCE_FINGERPRINT,
    comparisonId: sha256Fingerprint("portfolio-comparison:changed"),
  }]);

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
  expect(signalExplanationRequests).toBe(0);
  await explanationButton.click();
  await expect(explanationPanel.getByRole("status")).toContainText("Traduzindo os sinais");
  await expect(explanationPanel.locator('[data-explanation-source="ai"]')).toBeVisible();
  await expect(explanationPanel.getByText("Explicado por IA")).toBeVisible();
  await expect(explanationPanel.getByText("Por que importa:")).toBeVisible();
  await expect(explanationPanel.getByRole("heading", { name: "Limitações desta leitura" })).toBeVisible();
  await expect(explanationPanel.getByText(/Não é recomendação de compra, venda ou manutenção/)).toBeVisible();
  expect(signalExplanationRequests).toBe(1);

  await page.evaluate(() => {
    const state = window as typeof window & { portfolioSavedEventDetail?: unknown };
    window.addEventListener("dados-fii-wallet-saved", (event) => {
      state.portfolioSavedEventDetail = event instanceof CustomEvent ? event.detail : null;
    }, { once: true });
    window.localStorage.setItem("dados-fii-wallet-v1", JSON.stringify([{ ticker: "TGAR11", quotas: 11 }]));
  });
  await page.waitForTimeout(1_700);
  const syncButton = page.getByRole("button", { name: "Sincronizar agora" });
  await expect(syncButton).toBeEnabled();
  await syncButton.click();
  await expect.poll(() => walletSaveRequests).toBe(1);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("dados-fii-wallet-saved"));
    window.dispatchEvent(new Event("dados-fii-wallet-saved"));
  });
  await expect.poll(() => incrementalRequests).toBe(2);
  expect(incrementalBodies).toEqual([
    { portfolioId: "default" },
    { portfolioId: "default" },
  ]);
  expect(await page.evaluate(() => (
    window as typeof window & { portfolioSavedEventDetail?: unknown }
  ).portfolioSavedEventDetail)).toBeNull();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  await expectNoHighImpactAccessibilityViolations(page);
});

test("primeira análise cria referência sem inventar mudanças", async ({ page }) => {
  await preparePortfolio(page);
  const requestBodies: unknown[] = [];
  const current = incrementalReference({
    fingerprint: sha256Fingerprint("portfolio-reference:baseline"),
    generatedAt: "2026-08-04T12:00:00.000Z",
    asOf: "2026-08-04T12:00:00.000Z",
    latestIncome: 100,
  });
  await page.route("**/api/portfolio/incremental-analysis", async (route) => {
    requestBodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        comparison: {
          schemaVersion: 2,
          policyVersion: "2.0.0",
          comparisonId: sha256Fingerprint("portfolio-comparison:baseline"),
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
  await addOrUpdatePosition(page);
  const incrementalPanel = page.getByTestId("portfolio-incremental-report");
  await expect(incrementalPanel).toHaveAttribute("data-incremental-state", "baseline");
  await expect(incrementalPanel.getByText("Primeira referência criada")).toBeVisible();
  await expect(incrementalPanel.getByText(/primeira análise válida/i)).toBeVisible();
  await expect(page.getByTestId("portfolio-incremental-explanation")).toHaveCount(0);
  expect(requestBodies).toEqual([{ portfolioId: "default" }]);
});

test("análise inalterada não repete sinais como novidade nem oferece IA incremental", async ({ page }) => {
  await preparePortfolio(page);
  const requestBodies: unknown[] = [];
  await page.route("**/api/portfolio/incremental-analysis", async (route) => {
    requestBodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        comparison: unchangedComparison(),
        persistence: { stored: false, baselineState: "found" },
      }),
    });
  });

  await page.goto("/carteira");
  await addOrUpdatePosition(page);
  const incrementalPanel = page.getByTestId("portfolio-incremental-report");
  await expect(incrementalPanel).toHaveAttribute("data-incremental-state", "unchanged");
  await expect(incrementalPanel.getByText("Nada material mudou")).toBeVisible();
  await expect(incrementalPanel.getByText("1 sinal(is) permaneceu(ram) inalterado(s)")).toBeVisible();
  await expect(incrementalPanel.locator("[data-incremental-change]")).toHaveCount(0);
  await expect(page.getByTestId("portfolio-incremental-explanation")).toHaveCount(0);
  expect(requestBodies).toEqual([{ portfolioId: "default" }]);
});

test("feature flag desligada remove o relatório incremental sem afetar a análise principal", async ({ page }) => {
  await preparePortfolio(page, { authenticated: false });
  let availabilityRequests = 0;
  const requestBodies: unknown[] = [];
  await page.route("**/api/portfolio/incremental-analysis/availability", async (route) => {
    availabilityRequests += 1;
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        code: "PORTFOLIO_INCREMENTAL_DISABLED",
        error: "Relatório incremental temporariamente indisponível.",
      }),
    });
  });
  await page.route("**/api/portfolio/incremental-analysis", async (route) => {
    requestBodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        code: "PORTFOLIO_INCREMENTAL_DISABLED",
        error: "Relatório incremental temporariamente indisponível.",
      }),
    });
  });

  await page.goto("/carteira");
  await addOrUpdatePosition(page);
  await expect(page.getByTestId("portfolio-intelligence")).toBeVisible();
  await expect(page.getByTestId("portfolio-incremental-report")).toHaveCount(0);
  expect(availabilityRequests).toBe(1);
  expect(requestBodies).toEqual([]);
});

test("rollback durante aba aberta permanece oculto e não repete análise após eventos", async ({ page }) => {
  await preparePortfolio(page);
  let incrementalRequests = 0;
  await page.route("**/api/portfolio/incremental-analysis", async (route) => {
    incrementalRequests += 1;
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        code: "PORTFOLIO_INCREMENTAL_DISABLED",
        error: "Relatório incremental temporariamente indisponível.",
      }),
    });
  });

  await page.goto("/carteira");
  await addOrUpdatePosition(page);
  await expect.poll(() => incrementalRequests).toBe(1);
  await expect(page.getByTestId("portfolio-incremental-report")).toHaveCount(0);

  await page.evaluate(() => {
    window.dispatchEvent(new Event("dados-fii-wallet-saved"));
    window.dispatchEvent(new Event("dados-fii-portfolio-history-persisted"));
    window.dispatchEvent(new Event("dados-fii-wallet-session-updated"));
  });
  await page.waitForTimeout(500);
  await expect(page.getByTestId("portfolio-incremental-report")).toHaveCount(0);
  expect(incrementalRequests).toBe(1);
});

test("sessão ausente orienta autenticação e não envia carteira nem inicia comparação", async ({ page }) => {
  await preparePortfolio(page, { authenticated: false });
  let incrementalRequests = 0;
  await page.route("**/api/portfolio/incremental-analysis", async (route) => {
    incrementalRequests += 1;
    await route.abort();
  });

  await page.goto("/carteira");
  await addOrUpdatePosition(page);
  const incrementalPanel = page.getByTestId("portfolio-incremental-report");
  await expect(incrementalPanel).toHaveAttribute("data-incremental-state", "signed-out");
  await expect(incrementalPanel.getByText(/Confirme seu e-mail para comparar/i)).toBeVisible();
  await expect(page.getByTestId("portfolio-incremental-explanation")).toHaveCount(0);
  expect(incrementalRequests).toBe(0);
});

test("troca de identidade e logout em outra aba removem dados incrementais anteriores", async ({ page, context }) => {
  await preparePortfolio(page);
  const requests: Array<Readonly<{ email: string | null; token: string | null }>> = [];
  await page.route("**/api/portfolio/incremental-analysis", async (route) => {
    const email = route.request().headers()["x-wallet-email"] ?? null;
    const token = route.request().headers()["x-wallet-session"] ?? null;
    requests.push({ email, token });
    if (email === "portfolio-e2e-b@example.test" && token !== "portfolio-e2e-session-b") {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, code: "WALLET_SESSION_REQUIRED", error: "Sessão obrigatória." }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        comparison: email === "portfolio-e2e-b@example.test" ? unchangedComparison() : changedComparison(),
        persistence: { stored: false, baselineState: "found" },
      }),
    });
  });

  await page.goto("/carteira");
  await addOrUpdatePosition(page);
  const panel = page.getByTestId("portfolio-incremental-report");
  await expect(panel).toHaveAttribute("data-incremental-state", "changed");
  await expect(panel.locator("[data-incremental-change]")).toHaveCount(1);

  const sibling = await context.newPage();
  await sibling.goto("/robots.txt");
  await sibling.evaluate(() => {
    window.localStorage.setItem("dados-fii-wallet-email", "portfolio-e2e-b@example.test");
  });
  await expect(panel).toHaveAttribute("data-incremental-state", "unavailable");
  await expect(panel.locator("[data-incremental-change]")).toHaveCount(0);

  await sibling.evaluate(() => {
    window.localStorage.setItem("dados-fii-wallet-session", "portfolio-e2e-session-b");
  });
  await expect(panel).toHaveAttribute("data-incremental-state", "unchanged");
  await expect(panel.locator("[data-incremental-change]")).toHaveCount(0);

  await sibling.evaluate(() => window.localStorage.clear());
  await expect(panel).toHaveAttribute("data-incremental-state", "signed-out");
  await expect(panel.locator("[data-incremental-change]")).toHaveCount(0);
  await expect(page.getByTestId("portfolio-incremental-explanation")).toHaveCount(0);
  expect(requests).toEqual([
    { email: "portfolio-e2e@example.test", token: "portfolio-e2e-session" },
    { email: "portfolio-e2e-b@example.test", token: "portfolio-e2e-session" },
    { email: "portfolio-e2e-b@example.test", token: "portfolio-e2e-session-b" },
  ]);
  await sibling.close();
});

test("histórico só atualiza o relatório incremental depois do flush remoto confirmado", async ({ page }) => {
  await preparePortfolio(page);

  let incrementalRequests = 0;
  await page.route("**/api/portfolio/incremental-analysis", async (route) => {
    incrementalRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        comparison: unchangedComparison(),
        persistence: { stored: false, baselineState: "found" },
      }),
    });
  });

  let historyWrites = 0;
  let rejectNextWrite = true;
  await page.route("**/api/portfolio/history?portfolioId=default", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, entries: [] }),
      });
      return;
    }
    historyWrites += 1;
    if (rejectNextWrite) {
      rejectNextWrite = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Falha temporária de sincronização." }),
      });
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.addInitScript(() => {
    const state = window as typeof window & { historyPersistedDetails?: unknown[] };
    state.historyPersistedDetails = [];
    window.addEventListener("dados-fii-portfolio-history-persisted", (event) => {
      state.historyPersistedDetails?.push(event instanceof CustomEvent ? event.detail : null);
    });
  });

  await page.goto("/carteira");
  await addOrUpdatePosition(page);
  await expect(page.getByTestId("portfolio-intelligence")).toHaveAttribute(
    "data-analysis-state",
    "complete",
    { timeout: 20_000 },
  );
  await expect(page.getByTestId("portfolio-incremental-report")).toHaveAttribute(
    "data-incremental-state",
    "unchanged",
  );
  await expect.poll(() => incrementalRequests).toBeGreaterThanOrEqual(1);
  const requestsBeforeHistory = incrementalRequests;

  await page.getByLabel("Dividendos recebidos no mês").fill("47,00");
  await page.getByRole("button", { name: "Salvar mês" }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect.poll(() => historyWrites).toBe(1);
  await expect(page.getByText("Falha ao sincronizar")).toBeVisible();
  await page.waitForTimeout(500);
  expect(incrementalRequests).toBe(requestsBeforeHistory);
  expect(await page.evaluate(() => (
    window as typeof window & { historyPersistedDetails?: unknown[] }
  ).historyPersistedDetails)).toEqual([]);

  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => historyWrites).toBe(2);
  await expect(page.getByText("Sincronizado", { exact: true })).toBeVisible();
  await expect.poll(() => incrementalRequests).toBe(requestsBeforeHistory + 1);
  expect(await page.evaluate(() => (
    window as typeof window & { historyPersistedDetails?: unknown[] }
  ).historyPersistedDetails)).toEqual([null]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
