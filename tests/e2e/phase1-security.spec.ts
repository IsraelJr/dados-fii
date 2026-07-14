import { expect, test } from "@playwright/test";

function isBlocked(status: number) {
  return [400, 401, 403, 405].includes(status);
}

const sameOriginHeaders = { "Sec-Fetch-Site": "same-origin" };

test.describe("Fase 1 - segurança das APIs", () => {
  test("relatórios regulatórios não são expostos por GET anônimo", async ({ request }) => {
    const report = await request.get("/api/fii-regulatory-report?ticker=KNCA11");
    const comparator = await request.get("/api/fii-regulatory-comparator?tickers=KNCA11,MXRF11");

    expect(isBlocked(report.status())).toBeTruthy();
    expect(isBlocked(comparator.status())).toBeTruthy();
  });

  test("POST anônimo não recebe conteúdo regulatório", async ({ request }) => {
    const response = await request.post("/api/fii-regulatory-report", {
      data: { ticker: "KNCA11" },
    });
    const body = await response.json().catch(() => ({}));

    expect(response.ok()).toBeFalsy();
    expect(body.report).toBeUndefined();
    expect(body.premiumInput).toBeUndefined();
  });

  test("rotas administrativas rejeitam acesso sem sessão", async ({ request }) => {
    const status = await request.get("/api/admin/fii-ingestion/status?ticker=MXRF11");
    const publication = await request.post("/api/admin/fii-ingestion/publication", {
      data: { runId: "invalid", proposalHash: "invalid", confirmationText: "invalid" },
    });
    const rollback = await request.post("/api/admin/fii-ingestion/rollback", {
      data: { runId: "invalid", proposalHash: "invalid", confirmationText: "invalid" },
    });

    expect(status.status()).toBe(401);
    expect(publication.status()).toBe(401);
    expect(rollback.status()).toBe(401);
  });

  test("login com chave incorreta é recusado", async ({ request }) => {
    const response = await request.post("/api/admin/session", {
      headers: sameOriginHeaders,
      data: { token: "invalid-admin-secret" },
    });

    expect([401, 500]).toContain(response.status());
  });

  test("cabeçalhos básicos de segurança estão presentes", async ({ request }) => {
    const response = await request.get("/");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(response.headers()["referrer-policy"]).toBeTruthy();
  });

  test("sessão administrativa persiste e logout invalida cookie", async ({ page }) => {
    const adminSecret = process.env.E2E_ADMIN_UPDATE_SECRET;
    test.skip(!adminSecret, "E2E_ADMIN_UPDATE_SECRET não configurado.");

    const client = page.context().request;
    const login = await client.post("/api/admin/session", {
      headers: sameOriginHeaders,
      data: { token: adminSecret },
    });
    expect(login.status()).toBe(200);

    const session = await client.get("/api/admin/session");
    expect(session.status()).toBe(200);
    expect((await session.json()).authenticated).toBe(true);

    await page.goto("/admin/fii-ingestion");
    await page.reload();
    expect(page.url()).toContain("/admin/fii-ingestion");

    const logout = await client.delete("/api/admin/session", {
      headers: sameOriginHeaders,
    });
    expect(logout.status()).toBe(200);
    expect((await client.get("/api/admin/session")).status()).toBe(401);
  });
});
