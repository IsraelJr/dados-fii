import type { Page } from "@playwright/test";
import {
  clickStableSemanticTarget,
  configurePersistedCookieConsent,
  expect,
  expectAuthenticatedWallet,
  logoutWallet,
  observeWalletAuthentication,
  stabilizeCookieConsent,
  test,
} from "./fixtures";

const consentMarkup = `
  <section role="dialog" aria-modal="true" aria-labelledby="cookie-consent-title">
    <h2 id="cookie-consent-title">Privacidade e cookies</h2>
    <button type="button" id="reject-consent">Recusar opcionais</button>
  </section>
  <script>
    document.querySelector('#reject-consent').addEventListener('click', () => {
      localStorage.setItem('dados-fii-consent-v2', JSON.stringify({ choice: 'rejected', version: 2 }));
      document.querySelector('[aria-labelledby="cookie-consent-title"]').remove();
    });
  </script>
`;

async function sameOriginDocument(page: Page, markup: string) {
  await page.route("**/__functional_qa_fixture__", (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: `<!doctype html><html lang="pt-BR"><body>${markup}</body></html>`,
  }));
  await page.goto("/__functional_qa_fixture__");
}

async function installAuthenticationHarness(page: Page, updateFunctionalState: boolean) {
  await page.route("**/api/user-profile", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true }),
  }));
  await page.route("**/api/portfolio/history?portfolioId=default", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, entries: [] }),
  }));
  await sameOriginDocument(page, `
    <div role="dialog" aria-labelledby="login-title">
      <h2 id="login-title">Entrar</h2>
      <button type="button" id="submit-login">Entrar</button>
    </div>
    <button type="button" aria-label="Sair da conta" hidden>Sair</button>
    <script>
      document.querySelector('#submit-login').addEventListener('click', async () => {
        await fetch('/api/user-profile', {
          method: 'POST',
          headers: { Authorization: 'Bearer synthetic-fixture-token' }
        });
        if (${JSON.stringify(updateFunctionalState)}) {
          localStorage.setItem('dados-fii-wallet-email', 'fixture@example.test');
          localStorage.setItem('dados-fii-wallet-session', 'fixture-session');
          document.querySelector('[role="dialog"]').remove();
          document.querySelector('[aria-label="Sair da conta"]').hidden = false;
        }
      });
    </script>
  `);
}

test("consentimento ainda não informado é escolhido e o overlay desaparece", async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem("dados-fii-consent-v2"));
  await sameOriginDocument(page, consentMarkup);
  await stabilizeCookieConsent(page);
  await expect(page.getByRole("dialog", { name: "Privacidade e cookies" })).toBeHidden();
  await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem("dados-fii-consent-v2")))).toBe(true);
});

test("consentimento já salvo permanece idempotente", async ({ page }) => {
  await configurePersistedCookieConsent(page);
  await sameOriginDocument(page, "<main><button type='button'>Continuar</button></main>");
  await stabilizeCookieConsent(page);
  await stabilizeCookieConsent(page);
  await expect(page.getByRole("button", { name: "Continuar" })).toBeVisible();
});

test("viewport mobile com header fixo permite clique sem coordenada ou force", async ({ page }) => {
  await sameOriginDocument(page, `
    <style>
      body { margin: 0; min-height: 2200px; }
      header { position: fixed; inset: 0 0 auto; height: 120px; background: black; z-index: 10; }
      button { margin-top: 1800px; }
    </style>
    <header></header>
    <button type="button" id="premium">Acessar Premium</button>
    <output id="result"></output>
    <script>
      document.querySelector('#premium').addEventListener('click', () => {
        document.querySelector('#result').textContent = 'clicked';
      });
    </script>
  `);
  await clickStableSemanticTarget(page, page.getByRole("button", { name: "Acessar Premium" }));
  await expect(page.locator("#result")).toHaveText("clicked");
});

test("login captura resposta rápida registrada antes da ação", async ({ page }) => {
  await installAuthenticationHarness(page, true);
  const observation = observeWalletAuthentication(page, 2_000);
  await page.getByRole("button", { name: "Entrar" }).click();
  const result = await expectAuthenticatedWallet(page, observation, 2_000);
  expect(result).toMatchObject({ profileObserved: true, protectedStatus: 200 });
});

test("login preserva resposta ocorrida antes de uma espera tardia", async ({ page }) => {
  await installAuthenticationHarness(page, true);
  const observation = observeWalletAuthentication(page, 2_000);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem("dados-fii-wallet-session")))).toBe(true);
  const result = await expectAuthenticatedWallet(page, observation, 2_000);
  expect(result.profileObserved).toBe(true);
});

test("resposta de rede sem UI e sessão não determina autenticação", async ({ page }) => {
  await installAuthenticationHarness(page, false);
  const observation = observeWalletAuthentication(page, 2_000);
  await page.getByRole("button", { name: "Entrar" }).click();
  let rejected = false;
  try {
    await expectAuthenticatedWallet(page, observation, 500);
  } catch {
    rejected = true;
  }
  expect(rejected).toBe(true);
});

test("logout aguarda navegação seguida de reidratação antes de clicar", async ({ page }) => {
  await configurePersistedCookieConsent(page);
  await page.addInitScript(() => {
    localStorage.setItem("dados-fii-wallet-email", "fixture@example.test");
    localStorage.setItem("dados-fii-wallet-session", "fixture-session");
  });
  let deleteRequests = 0;
  await page.route("**/api/wallet/session/firebase", async (route) => {
    if (route.request().method() === "DELETE") deleteRequests += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.route("**/api/portfolio/history?portfolioId=default", (route) => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ error: "unauthorized" }),
  }));
  await page.route("**/carteira", (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: `<!doctype html><html lang="pt-BR"><body>
      <button type="button" id="login">Login</button>
      <button type="button" id="logout" aria-label="Sair da conta" hidden>Sair</button>
      <script>
        setTimeout(() => {
          document.querySelector('#login').hidden = true;
          document.querySelector('#logout').hidden = false;
        }, 200);
        document.querySelector('#logout').addEventListener('click', async () => {
          const response = await fetch('/api/wallet/session/firebase', { method: 'DELETE' });
          if (!response.ok) return;
          localStorage.removeItem('dados-fii-wallet-email');
          localStorage.removeItem('dados-fii-wallet-session');
          document.querySelector('#logout').hidden = true;
          document.querySelector('#login').hidden = false;
        });
      </script>
    </body></html>`,
  }));

  const result = await logoutWallet(page);
  expect(result.deleteStatus).toBe(200);
  expect(result.protectedStatus).toBe(401);
  expect(deleteRequests).toBe(1);
});
