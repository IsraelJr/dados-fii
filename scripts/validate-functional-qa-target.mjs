import { validateQaTarget } from "../tests/e2e/support/qaTarget.ts";

const target = process.env.E2E_TARGET_URL || "";
const environment = process.env.E2E_TARGET_ENVIRONMENT || "";
if (environment !== "Preview" && environment !== "Production") {
  throw new Error("Ambiente funcional inválido.");
}
validateQaTarget(target, environment, {
  productionOrigin: process.env.CONFIGURED_PRODUCTION_URL || "https://www.dadosfii.com.br",
  previewHostnameSuffix: process.env.VERCEL_PREVIEW_HOST_SUFFIX,
});
