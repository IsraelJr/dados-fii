import { test as base, expect, type ConsoleMessage, type Request, type Response } from "@playwright/test";

type RuntimeEvidence = {
  console: Array<{ type: string; text: string }>;
  failedRequests: Array<{ method: string; url: string; failure: string }>;
  errorResponses: Array<{ method: string; url: string; status: number }>;
};

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
