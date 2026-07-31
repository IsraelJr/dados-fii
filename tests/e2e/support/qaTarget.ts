export type QaEnvironment = "Preview" | "Production";

export function validateQaTarget(
  value: string,
  environment: QaEnvironment,
  options: Readonly<{
    productionOrigin?: string;
    previewHostnameSuffix?: string;
  }> = {},
) {
  const target = new URL(value);
  if (target.protocol !== "https:" || target.username || target.password || target.search || target.hash) {
    throw new Error("Origem de QA inválida.");
  }
  if (target.pathname !== "/" && target.pathname !== "") {
    throw new Error("O alvo de QA deve ser uma origem, sem caminho.");
  }

  if (environment === "Production") {
    const production = new URL(options.productionOrigin || "https://www.dadosfii.com.br");
    if (target.origin !== production.origin) throw new Error("Origem de produção não autorizada.");
    return target.origin;
  }

  const suffix = String(options.previewHostnameSuffix || "").trim().toLowerCase();
  if (!suffix.startsWith("-") || !suffix.endsWith(".vercel.app")) {
    throw new Error("VERCEL_PREVIEW_HOST_SUFFIX inválido.");
  }
  const hostname = target.hostname.toLowerCase();
  if (!hostname.endsWith(suffix) || !/^dados(?:-fii)?-[a-z0-9-]+$/.test(hostname.slice(0, -suffix.length))) {
    throw new Error("Origem de Preview não pertence ao projeto autorizado.");
  }
  return target.origin;
}

export function vercelBypassHeadersForOrigin(
  targetOrigin: string,
  requestUrl: string,
  secret: string,
): Record<string, string> {
  const target = new URL(targetOrigin);
  const request = new URL(requestUrl, target);
  if (request.origin !== target.origin) return {};
  return {
    "x-vercel-protection-bypass": secret,
    "x-vercel-set-bypass-cookie": "true",
  };
}
