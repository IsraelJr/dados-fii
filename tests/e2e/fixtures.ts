import {
  test as base,
  expect,
  type ConsoleMessage,
  type Locator,
  type Page,
  type Request,
  type Response,
} from "@playwright/test";

const CONSENT_STORAGE_KEY = "dados-fii-consent-v2";
const PROFILE_ENDPOINT = "/api/user-profile";

type AuthenticationObservation = {
  profileResponse: Promise<Response | null>;
};

type AuthenticationResult = {
  idToken: string;
  profileObserved: true;
  protectedStatus: 200;
};

type RuntimeEvidence = {
  console: Array<{ type: string; text: string }>;
  failedRequests: Array<{ method: string; url: string; failure: string }>;
  errorResponses: Array<{ method: string; url: string; status: number }>;
};

async function waitForStableLayout(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function targetIsStableAndUnobscured(target: Locator) {
  return target.evaluate(async (element) => {
    const before = element.getBoundingClientRect();
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    const after = element.getBoundingClientRect();
    const stable = (["top", "right", "bottom", "left", "width", "height"] as const).every((key) => (
      Math.abs(before[key] - after[key]) < 1
    ));
    if (!stable || after.width <= 0 || after.height <= 0) return false;

    const centerX = after.left + after.width / 2;
    const centerY = after.top + after.height / 2;
    if (centerX < 0 || centerY < 0 || centerX > window.innerWidth || centerY > window.innerHeight) return false;
    const hit = document.elementFromPoint(centerX, centerY);
    return hit === element || Boolean(hit && element.contains(hit));
  });
}

export async function clickStableSemanticTarget(page: Page, target: Locator, timeout = 15_000) {
  await expect(target).toBeVisible({ timeout });
  await expect(target).toBeEnabled({ timeout });
  await target.evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" }));
  await waitForStableLayout(page);
  await expect.poll(() => targetIsStableAndUnobscured(target), {
    timeout,
    message: "O alvo semântico deve estar estável, visível e sem overlay antes do clique.",
  }).toBe(true);
  await target.click({ timeout });
}

export async function configurePersistedCookieConsent(page: Page, choice: "accepted" | "rejected" = "rejected") {
  await page.addInitScript(({ key, persistedChoice }) => {
    window.localStorage.setItem(key, JSON.stringify({
      choice: persistedChoice,
      updatedAt: "2026-01-01T00:00:00.000Z",
      version: 2,
    }));
  }, { key: CONSENT_STORAGE_KEY, persistedChoice: choice });
}

export async function stabilizeCookieConsent(page: Page, choice: "accepted" | "rejected" = "rejected") {
  await page.waitForLoadState("domcontentloaded");
  const banner = page.getByRole("dialog", { name: "Privacidade e cookies" });
  const persisted = await page.evaluate((key) => Boolean(window.localStorage.getItem(key)), CONSENT_STORAGE_KEY);

  if (!persisted) await expect(banner).toBeVisible({ timeout: 15_000 });
  if (await banner.isVisible().catch(() => false)) {
    const action = choice === "accepted" ? "Aceitar opcionais" : "Recusar opcionais";
    await clickStableSemanticTarget(page, banner.getByRole("button", { name: action }));
  }

  await expect(banner).toBeHidden({ timeout: 15_000 });
  await expect.poll(() => page.evaluate((key) => Boolean(window.localStorage.getItem(key)), CONSENT_STORAGE_KEY), {
    timeout: 15_000,
    message: "O consentimento deve ficar explicitamente persistido.",
  }).toBe(true);
  await expect.poll(async () => {
    const overlays = await page.locator('[aria-labelledby="cookie-consent-title"]').evaluateAll((elements) => (
      elements.some((element) => {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return style.visibility !== "hidden" && style.display !== "none" && bounds.width > 0 && bounds.height > 0;
      })
    ));
    return !overlays;
  }, {
    timeout: 15_000,
    message: "O overlay de consentimento não pode continuar interceptando cliques.",
  }).toBe(true);
}

export function observeWalletAuthentication(page: Page, timeout = 30_000): AuthenticationObservation {
  return {
    profileResponse: page.waitForResponse((response) => (
      response.url().includes(PROFILE_ENDPOINT)
      && response.request().method() === "POST"
    ), { timeout }).catch(() => null),
  };
}

export async function expectAuthenticatedWallet(
  page: Page,
  observation: AuthenticationObservation,
  timeout = 30_000,
): Promise<AuthenticationResult> {
  await expect(page.getByRole("dialog", { name: "Entrar" })).toBeHidden({ timeout });
  await expect(page.getByRole("button", { name: "Sair da conta" })).toBeVisible({ timeout });
  await expect.poll(() => page.evaluate(() => Boolean(
    window.localStorage.getItem("dados-fii-wallet-email")
    && window.localStorage.getItem("dados-fii-wallet-session"),
  )), {
    timeout,
    message: "A UI autenticada deve possuir e-mail e sessão da carteira sem expor seus valores.",
  }).toBe(true);

  const protectedStatus = await page.evaluate(async () => {
    const email = window.localStorage.getItem("dados-fii-wallet-email") || "";
    const session = window.localStorage.getItem("dados-fii-wallet-session") || "";
    if (!email || !session) return 0;
    return fetch("/api/portfolio/history?portfolioId=default", {
      headers: { "x-wallet-email": email, "x-wallet-session": session },
    }).then((response) => response.status).catch(() => 0);
  });
  expect(protectedStatus).toBe(200);

  const profileResponse = await observation.profileResponse;
  expect(profileResponse, "O perfil obrigatório deve responder após a autenticação.").not.toBeNull();
  expect(profileResponse?.ok()).toBe(true);
  const authorization = profileResponse?.request().headers().authorization || "";
  expect(authorization).toMatch(/^Bearer\s+\S+$/i);
  return {
    idToken: authorization.replace(/^Bearer\s+/i, ""),
    profileObserved: true,
    protectedStatus: 200,
  };
}

function secretValues() {
  return [
    process.env.E2E_USER_EMAIL,
    process.env.E2E_USER_PASSWORD,
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  ].filter((value): value is string => Boolean(value));
}

export function sanitizeEvidence(value: unknown) {
  let safe = String(value ?? "");
  for (const secret of secretValues()) safe = safe.split(secret).join("[REDACTED]");
  return safe
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_TOKEN]")
    .replace(/([?&](?:token|code|secret|key|password|session)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/(\b(?:Authorization|Cookie|Set-Cookie|x-wallet-session)\s*:\s*)[^\r\n]+/gi, "$1[REDACTED]")
    .replace(/R\$\s*\d[\d.]*,\d{2}/g, "R$ [REDACTED]");
}

function safeUrl(value: string) {
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return sanitizeEvidence(value.split("?")[0]);
  }
}

function consoleEntry(message: ConsoleMessage) {
  return { type: message.type(), text: sanitizeEvidence(message.text()) };
}

function failedRequestEntry(request: Request) {
  return {
    method: request.method(),
    url: safeUrl(request.url()),
    failure: sanitizeEvidence(request.failure()?.errorText || "request_failed"),
  };
}

function errorResponseEntry(response: Response) {
  return {
    method: response.request().method(),
    url: safeUrl(response.url()),
    status: response.status(),
  };
}

export const test = base.extend<{ runtimeEvidence: RuntimeEvidence }>({
  runtimeEvidence: [async ({ page }, use, testInfo) => {
    const evidence: RuntimeEvidence = { console: [], failedRequests: [], errorResponses: [] };

    await page.addInitScript(() => {
      const installCredentialMask = () => {
        const style = document.createElement("style");
        style.dataset.e2eCredentialMask = "true";
        style.textContent = [
          "input[type='email'],",
          "input[type='password'],",
          "input[autocomplete='email'],",
          "input[autocomplete='username'],",
          "[data-sensitive='true']",
          "{-webkit-text-security:disc!important;color:transparent!important;",
          "text-shadow:none!important;caret-color:transparent!important}",
        ].join("");
        document.documentElement.appendChild(style);
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", installCredentialMask, { once: true });
      } else {
        installCredentialMask();
      }
    });

    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) evidence.console.push(consoleEntry(message));
    });
    page.on("requestfailed", (request) => evidence.failedRequests.push(failedRequestEntry(request)));
    page.on("response", (response) => {
      if (response.status() >= 400) evidence.errorResponses.push(errorResponseEntry(response));
    });

    await use(evidence);

    if (testInfo.status !== testInfo.expectedStatus) {
      const metadata = {
        sha: process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || "local",
        environment: process.env.E2E_ENVIRONMENT || "local",
        baseURL: safeUrl(process.env.E2E_BASE_URL || "http://127.0.0.1:3100"),
        project: testInfo.project.name,
      };
      await testInfo.attach("runtime-evidence", {
        body: Buffer.from(JSON.stringify({ metadata, ...evidence }, null, 2)),
        contentType: "application/json",
      });
      const screenshotPath = testInfo.outputPath("failure.png");
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        mask: [page.locator("input[type='email'], input[type='password'], input[autocomplete='email'], input[autocomplete='username'], [data-sensitive='true']")],
      }).catch(() => undefined);
      await testInfo.attach("failure-screenshot", {
        path: screenshotPath,
        contentType: "image/png",
      }).catch(() => undefined);
    }
  }, { auto: true }],
});

export { expect };
