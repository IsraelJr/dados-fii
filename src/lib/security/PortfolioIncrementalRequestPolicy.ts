export type PortfolioIncrementalIntent = Readonly<{
  portfolioId: "default";
}>;

export type PortfolioIncrementalExplanationIntent = Readonly<{
  portfolioId: "default";
  currentFingerprint: string;
  comparisonId: string;
}>;

export type PortfolioIncrementalRequestErrorCode =
  | "PORTFOLIO_INCREMENTAL_INVALID_CONTENT_TYPE"
  | "PORTFOLIO_INCREMENTAL_PAYLOAD_TOO_LARGE"
  | "PORTFOLIO_INCREMENTAL_INVALID_JSON"
  | "PORTFOLIO_INCREMENTAL_INVALID_INTENT";

export class PortfolioIncrementalRequestError extends Error {
  readonly code: PortfolioIncrementalRequestErrorCode;
  readonly status: 400 | 413 | 415;

  constructor(
    code: PortfolioIncrementalRequestErrorCode,
    status: 400 | 413 | 415,
  ) {
    super(code);
    this.name = "PortfolioIncrementalRequestError";
    this.code = code;
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  return actual.length === canonical.length
    && actual.every((key, index) => key === canonical[index]);
}

function assertJsonContentType(request: Request) {
  const contentType = String(request.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new PortfolioIncrementalRequestError(
      "PORTFOLIO_INCREMENTAL_INVALID_CONTENT_TYPE",
      415,
    );
  }
}

async function readJsonRecord(request: Request, maximumBytes: number) {
  assertJsonContentType(request);
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new PortfolioIncrementalRequestError(
      "PORTFOLIO_INCREMENTAL_PAYLOAD_TOO_LARGE",
      413,
    );
  }

  const reader = request.body?.getReader();
  if (!reader) {
    throw new PortfolioIncrementalRequestError(
      "PORTFOLIO_INCREMENTAL_PAYLOAD_TOO_LARGE",
      413,
    );
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new PortfolioIncrementalRequestError(
          "PORTFOLIO_INCREMENTAL_PAYLOAD_TOO_LARGE",
          413,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) {
    throw new PortfolioIncrementalRequestError(
      "PORTFOLIO_INCREMENTAL_PAYLOAD_TOO_LARGE",
      413,
    );
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) throw new Error("not-an-object");
    return parsed;
  } catch {
    throw new PortfolioIncrementalRequestError(
      "PORTFOLIO_INCREMENTAL_INVALID_JSON",
      400,
    );
  }
}

export async function readPortfolioIncrementalIntent(
  request: Request,
  maximumBytes = 1_024,
): Promise<PortfolioIncrementalIntent> {
  const value = await readJsonRecord(request, maximumBytes);
  if (!hasExactKeys(value, ["portfolioId"]) || value.portfolioId !== "default") {
    throw new PortfolioIncrementalRequestError(
      "PORTFOLIO_INCREMENTAL_INVALID_INTENT",
      400,
    );
  }
  return Object.freeze({ portfolioId: "default" });
}

export async function readPortfolioIncrementalExplanationIntent(
  request: Request,
  maximumBytes = 2_048,
): Promise<PortfolioIncrementalExplanationIntent> {
  const value = await readJsonRecord(request, maximumBytes);
  if (
    !hasExactKeys(value, ["portfolioId", "currentFingerprint", "comparisonId"])
    || value.portfolioId !== "default"
    || typeof value.currentFingerprint !== "string"
    || !/^[a-f0-9]{64}$/.test(value.currentFingerprint)
    || typeof value.comparisonId !== "string"
    || !/^[a-f0-9]{64}$/.test(value.comparisonId)
  ) {
    throw new PortfolioIncrementalRequestError(
      "PORTFOLIO_INCREMENTAL_INVALID_INTENT",
      400,
    );
  }
  return Object.freeze({
    portfolioId: "default",
    currentFingerprint: value.currentFingerprint,
    comparisonId: value.comparisonId,
  });
}
