import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

type RadarFund = {
  ticker: string;
  status: "active" | "paused_by_plan" | "in_portfolio";
  notificationsEnabled: boolean;
  name: string;
  segment: string;
  type: string;
  quality: { status: string; confidence: number | null; missingFields: string[]; invalidFields: string[] };
  lastDividend: { competence: string; amount: number; paymentDate: string; source: string } | null;
  recentEvents: Array<{ id: string; title: string; type: string; source: string; asOf: string; url: string | null }>;
  signals: { riskScore: number | null; confidence: number | null; level: string | null; reasons: string[] };
  asOf: string;
  insufficientData: boolean;
  dataUnavailable: boolean;
};

function fund(ticker: string, overrides: Partial<RadarFund> = {}): RadarFund {
  return {
    ticker,
    status: "active",
    notificationsEnabled: true,
    name: `Fundo ${ticker}`,
    segment: "Papéis",
    type: "FII",
    quality: { status: "partial", confidence: 72, missingFields: ["vacancy"], invalidFields: [] },
    lastDividend: { competence: "2026-08", amount: 0.1, paymentDate: "2026-08-14T00:00:00.000Z", source: "Dados FII" },
    recentEvents: [{ id: `${ticker}-event`, title: "Fato relevante publicado", type: "material_fact", source: "CVM", asOf: "2026-08-15T00:00:00.000Z", url: "https://example.invalid/fato" }],
    signals: { riskScore: 54, confidence: 50, level: "fair", reasons: ["Dados de risco parcialmente disponíveis."] },
    asOf: "2026-08-17T00:00:00.000Z",
    insufficientData: true,
    dataUnavailable: false,
    ...overrides,
  };
}

async function seedSession(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("dados-fii-wallet-email", "radar-e2e@example.invalid");
    window.localStorage.setItem("dados-fii-wallet-session", "radar-session-e2e");
    window.localStorage.setItem("dados-fii-consent-v2", JSON.stringify({ choice: "rejected", version: 2, updatedAt: "2026-08-17T00:00:00.000Z" }));
  });
}

function response(state: { plan: "free" | "premium"; limit: number; funds: RadarFund[]; updates: unknown[] }) {
  return {
    ok: true,
    plan: state.plan,
    planLabel: state.plan === "free" ? "Grátis" : "Premium",
    limit: state.limit,
    activeCount: state.funds.filter((item) => item.status === "active").length,
    funds: state.funds,
    updates: state.updates,
  };
}

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockRadar(page: Page, state: { plan: "free" | "premium"; limit: number; funds: RadarFund[]; updates: unknown[] }) {
  await page.route("**/api/fund-radar*", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith("/refresh")) {
      await fulfillJson(route, 200, { ok: true, processed: state.funds.length, createdUpdates: [] });
      return;
    }
    if (request.method() === "GET") {
      await fulfillJson(route, 200, response(state));
      return;
    }
    const body = request.postDataJSON() as Record<string, unknown>;
    expect(Object.keys(body).sort()).not.toContain("plan");
    const ticker = String(body.ticker);
    if (request.method() === "POST") {
      const existing = state.funds.find((item) => item.ticker === ticker);
      if (existing) {
        await fulfillJson(route, 200, { ok: true, created: false, fund: existing, limit: state.limit, activeCount: state.funds.length });
        return;
      }
      if (state.funds.filter((item) => item.status === "active").length >= state.limit) {
        await fulfillJson(route, 422, { ok: false, code: "FUND_RADAR_LIMIT_REACHED", error: "O limite do seu plano foi atingido." });
        return;
      }
      const created = fund(ticker);
      state.funds.push(created);
      await fulfillJson(route, 201, { ok: true, created: true, fund: created, limit: state.limit, activeCount: state.funds.length });
      return;
    }
    if (request.method() === "PATCH") {
      const item = state.funds.find((candidate) => candidate.ticker === ticker)!;
      item.notificationsEnabled = Boolean(body.notificationsEnabled);
      await fulfillJson(route, 200, { ok: true, ticker, notificationsEnabled: item.notificationsEnabled });
      return;
    }
    if (request.method() === "DELETE") {
      state.funds.splice(state.funds.findIndex((item) => item.ticker === ticker), 1);
      await fulfillJson(route, 200, { ok: true, ticker, removed: true, activeCount: state.funds.length, limit: state.limit });
    }
  });
}

async function followFromRadar(page: Page, ticker: string) {
  await page.goto("/radar", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Acompanhar um fundo fora da carteira").fill(ticker);
  await page.getByRole("button", { name: "Acompanhar", exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await seedSession(page);
  await page.route(/^https:\/\//, (route) => route.abort());
});

test("Free acompanha primeiro fundo, explica limite no segundo e gerencia Radar", async ({ page }) => {
  const state = { plan: "free" as const, limit: 1, funds: [] as RadarFund[], updates: [] as unknown[] };
  await mockRadar(page, state);
  await followFromRadar(page, "MXRF11");
  await expect(page.getByText("MXRF11 adicionado ao Radar.")).toBeVisible();

  await page.getByLabel("Acompanhar um fundo fora da carteira").fill("TGAR11");
  await page.getByRole("button", { name: "Acompanhar", exact: true }).click();
  await expect(page.getByText("O limite do seu plano foi atingido.")).toBeVisible();

  await page.goto("/radar", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Radar de fundos" })).toBeVisible();
  await expect(page.getByText("1 de 1 fundos ativos")).toBeVisible();
  await expect(page.getByRole("link", { name: "MXRF11", exact: true })).toBeVisible();
  await expect(page.getByText("Dados insuficientes ou parciais.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Eventos e fatos relevantes" })).toBeVisible();
  await expect(page.getByText("Fato relevante publicado")).toBeVisible();
  await page.getByRole("button", { name: "Desativar notificações" }).click();
  await expect(page.getByRole("button", { name: "Ativar notificações" })).toBeVisible();
  await page.getByRole("button", { name: "Deixar de acompanhar" }).click();
  await expect(page.getByRole("heading", { name: "Seu Radar está vazio" })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["critical", "serious"].includes(item.impact || ""))).toEqual([]);
});

test("Premium permite o décimo e bloqueia o décimo primeiro", async ({ page }) => {
  const initial = Array.from({ length: 9 }, (_, index) => fund(`AAAA${index + 1}`));
  const state = { plan: "premium" as const, limit: 10, funds: initial, updates: [] as unknown[] };
  await mockRadar(page, state);
  await followFromRadar(page, "BODB11");
  await expect(page.getByText("BODB11 adicionado ao Radar.")).toBeVisible();
  await page.getByLabel("Acompanhar um fundo fora da carteira").fill("VISC11");
  await page.getByRole("button", { name: "Acompanhar", exact: true }).click();
  await expect(page.getByText("O limite do seu plano foi atingido.")).toBeVisible();
  await page.goto("/radar", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("10 de 10 fundos ativos")).toBeVisible();
});

test("fundo comprado deixa de consumir limite e não duplica atualização", async ({ page }) => {
  const fingerprint = "a".repeat(64);
  const state = {
    plan: "free" as const,
    limit: 1,
    funds: [fund("MXRF11", { status: "in_portfolio" as const })],
    updates: [{
      fingerprint,
      ticker: "MXRF11",
      title: "Rendimento atualizado em MXRF11",
      whatChanged: "Nova competência identificada.",
      whyItMatters: "O evento merece conferência.",
      source: "Dados FII",
      asOf: "2026-08-14T00:00:00.000Z",
      missingData: [],
      createdAt: "2026-08-17T00:00:00.000Z",
    }],
  };
  await mockRadar(page, state);
  await page.goto("/radar", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("0 de 1 fundos ativos")).toBeVisible();
  await expect(page.getByText("Acompanhado pela Inteligência da Carteira")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rendimento atualizado em MXRF11" })).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Rendimento atualizado em MXRF11" })).toHaveCount(1);
});
