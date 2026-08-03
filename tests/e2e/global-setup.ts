import { request, type FullConfig } from "@playwright/test";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  validateQaTarget,
  vercelBypassHeadersForOrigin,
  type QaEnvironment,
} from "./support/qaTarget";

export const VERCEL_BYPASS_STORAGE_STATE = path.join(
  process.cwd(),
  "playwright",
  ".auth",
  "vercel-bypass.json",
);

export default async function globalSetup(_config: FullConfig) {
  await rm(VERCEL_BYPASS_STORAGE_STATE, { force: true });
  const configuredTarget = process.env.E2E_BASE_URL?.trim();
  const environment = process.env.E2E_ENVIRONMENT as QaEnvironment | undefined;
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (!configuredTarget || environment !== "Preview" || !secret) return;

  const targetOrigin = validateQaTarget(configuredTarget, environment, {
    previewHostnameSuffix: process.env.VERCEL_PREVIEW_HOST_SUFFIX,
  });
  const headers = vercelBypassHeadersForOrigin(targetOrigin, targetOrigin, secret);
  const context = await request.newContext({ baseURL: targetOrigin, extraHTTPHeaders: headers });
  try {
    const response = await context.get("/", {
      failOnStatusCode: false,
      maxRedirects: 0,
    });
    const redirect = response.headers().location;
    if (redirect && new URL(redirect, targetOrigin).hostname === "vercel.com") {
      throw new Error("A Vercel não aceitou a configuração de bypass do Preview.");
    }
    if (![200, 301, 302, 303, 307, 308].includes(response.status())) {
      throw new Error(`A origem do Preview recusou a inicialização segura (${response.status()}).`);
    }
    const state = await context.storageState();
    const bypassCookie = state.cookies.find((cookie) => (
      cookie.domain.replace(/^\./, "") === new URL(targetOrigin).hostname
      && cookie.name === "_vercel_jwt"
    ));
    if (!bypassCookie) throw new Error("A Vercel não emitiu o cookie de bypass esperado.");
    await mkdir(path.dirname(VERCEL_BYPASS_STORAGE_STATE), { recursive: true });
    await context.storageState({ path: VERCEL_BYPASS_STORAGE_STATE });
  } finally {
    await context.dispose();
  }
}
