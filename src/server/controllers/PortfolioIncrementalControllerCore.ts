import type {
  PortfolioIncrementalComparison,
} from "@/lib/portfolio-intelligence/PortfolioIntelligenceIncremental";
import type {
  PortfolioIncrementalAnalysisResult,
} from "@/lib/portfolio-intelligence/PortfolioIntelligenceIncrementalService";
import {
  buildPortfolioIncrementalExplanationInput,
  type PortfolioIncrementalExplanation,
  type PortfolioIncrementalExplanationInput,
} from "@/lib/portfolio-intelligence/PortfolioIntelligenceIncrementalExplanation";
import {
  PortfolioIncrementalRateLimitError,
} from "@/lib/security/PortfolioIncrementalRateLimit";
import {
  PortfolioIncrementalRequestError,
  readPortfolioIncrementalExplanationIntent,
  readPortfolioIncrementalIntent,
} from "@/lib/security/PortfolioIncrementalRequestPolicy";

const RESPONSE_HEADERS = Object.freeze({
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
});

type Identity = Readonly<{ ownerId: string }>;

type CodedError = Readonly<{
  code?: unknown;
  status?: unknown;
}>;

export type PortfolioIncrementalAnalysisControllerDependencies = Readonly<{
  enabled(): boolean;
  sameOrigin(request: Request): boolean;
  resolveIdentity(request: Request): Promise<Identity>;
  compareAndStore(input: Readonly<{
    ownerId: string;
    portfolioId: "default";
  }>): Promise<PortfolioIncrementalAnalysisResult>;
}>;

export type PortfolioIncrementalExplanationControllerDependencies = Readonly<{
  enabled(): boolean;
  sameOrigin(request: Request): boolean;
  resolveIdentity(request: Request): Promise<Identity>;
  consumeRateLimit(ownerId: string, request: Request): Promise<void>;
  loadComparison(input: Readonly<{
    ownerId: string;
    portfolioId: "default";
    currentFingerprint: string;
    comparisonId: string;
  }>): Promise<PortfolioIncrementalComparison>;
  generate(input: PortfolioIncrementalExplanationInput): Promise<PortfolioIncrementalExplanation>;
  fallback(input: PortfolioIncrementalExplanationInput): PortfolioIncrementalExplanation;
}>;

export type PortfolioIncrementalAvailabilityControllerDependencies = Readonly<{
  enabled(): boolean;
}>;

function json(
  payload: unknown,
  status: number,
  extraHeaders: Readonly<Record<string, string>> = {},
) {
  return Response.json(payload, {
    status,
    headers: { ...RESPONSE_HEADERS, ...extraHeaders },
  });
}

function disabled() {
  return json({
    ok: false,
    code: "PORTFOLIO_INCREMENTAL_DISABLED",
    error: "Relatório incremental temporariamente indisponível.",
  }, 404);
}

export function createPortfolioIncrementalAvailabilityHandler(
  dependencies: PortfolioIncrementalAvailabilityControllerDependencies,
) {
  return function handlePortfolioIncrementalAvailability() {
    if (!dependencies.enabled()) return disabled();
    return new Response(null, { status: 204, headers: RESPONSE_HEADERS });
  };
}

function forbiddenOrigin() {
  return json({
    ok: false,
    code: "PORTFOLIO_INCREMENTAL_ORIGIN_FORBIDDEN",
    error: "Origem da solicitação não permitida.",
  }, 403);
}

function requestError(error: PortfolioIncrementalRequestError) {
  const messages: Record<PortfolioIncrementalRequestError["code"], string> = {
    PORTFOLIO_INCREMENTAL_INVALID_CONTENT_TYPE: "A solicitação deve usar JSON.",
    PORTFOLIO_INCREMENTAL_PAYLOAD_TOO_LARGE: "Solicitação acima do limite permitido.",
    PORTFOLIO_INCREMENTAL_INVALID_JSON: "Payload JSON inválido.",
    PORTFOLIO_INCREMENTAL_INVALID_INTENT: "Solicitação incremental inválida.",
  };
  return json({ ok: false, code: error.code, error: messages[error.code] }, error.status);
}

function codedError(error: unknown): CodedError {
  return error && typeof error === "object" ? error as CodedError : {};
}

function publicFailure(error: unknown) {
  if (error instanceof PortfolioIncrementalRequestError) return requestError(error);
  if (error instanceof PortfolioIncrementalRateLimitError) {
    const headers: Record<string, string> = error.retryAfter === null
      ? {}
      : { "Retry-After": String(error.retryAfter) };
    return json({
      ok: false,
      code: error.code,
      error: error.status === 429
        ? "Muitas solicitações de explicação. Aguarde antes de tentar novamente."
        : "Controle de solicitações temporariamente indisponível.",
    }, error.status, headers);
  }

  const { code, status } = codedError(error);
  if (code === "WALLET_SESSION_REQUIRED") {
    return json({
      ok: false,
      code,
      error: "Sessão verificada da carteira obrigatória.",
    }, 401);
  }
  if (code === "USER_NOT_FOUND" || code === "PORTFOLIO_INCREMENTAL_SOURCE_NOT_FOUND") {
    return json({
      ok: false,
      code,
      error: "Carteira identificada não encontrada.",
    }, 404);
  }
  if (code === "PORTFOLIO_INCREMENTAL_REFERENCE_NOT_FOUND") {
    return json({
      ok: false,
      code,
      error: "Referência incremental não encontrada.",
    }, 404);
  }
  if (
    code === "PORTFOLIO_INCREMENTAL_REFERENCE_STALE"
    || code === "PORTFOLIO_INCREMENTAL_REFERENCE_FINGERPRINT_MISMATCH"
  ) {
    return json({
      ok: false,
      code,
      error: "A referência solicitada ficou desatualizada.",
    }, 409);
  }
  if (code === "PORTFOLIO_INCREMENTAL_REFERENCE_CONFLICT") {
    return json({
      ok: false,
      code,
      error: "Conflito entre referências da mesma data-base.",
    }, 409);
  }
  if (
    code === "PORTFOLIO_INCREMENTAL_PORTFOLIO_UNSUPPORTED"
    || code === "PORTFOLIO_INCREMENTAL_OWNER_INVALID"
  ) {
    return json({
      ok: false,
      code,
      error: "Solicitação incremental inválida.",
    }, 400);
  }
  if (typeof status === "number" && status === 401) {
    return json({
      ok: false,
      code: "WALLET_SESSION_REQUIRED",
      error: "Sessão verificada da carteira obrigatória.",
    }, 401);
  }
  return json({
    ok: false,
    code: "PORTFOLIO_INCREMENTAL_INTERNAL_ERROR",
    error: "Não foi possível processar o relatório incremental.",
  }, 500);
}

export function createPortfolioIncrementalAnalysisHandler(
  dependencies: PortfolioIncrementalAnalysisControllerDependencies,
) {
  return async function handlePortfolioIncrementalAnalysis(request: Request) {
    if (!dependencies.enabled()) return disabled();
    if (!dependencies.sameOrigin(request)) return forbiddenOrigin();
    try {
      const identity = await dependencies.resolveIdentity(request);
      const intent = await readPortfolioIncrementalIntent(request);
      const output = await dependencies.compareAndStore({
        ownerId: identity.ownerId,
        portfolioId: intent.portfolioId,
      });
      return json({ ok: true, ...output }, output.persistence.stored ? 201 : 200);
    } catch (error) {
      return publicFailure(error);
    }
  };
}

export function createPortfolioIncrementalExplanationHandler(
  dependencies: PortfolioIncrementalExplanationControllerDependencies,
) {
  return async function handlePortfolioIncrementalExplanation(request: Request) {
    if (!dependencies.enabled()) return disabled();
    if (!dependencies.sameOrigin(request)) return forbiddenOrigin();
    try {
      const identity = await dependencies.resolveIdentity(request);
      await dependencies.consumeRateLimit(identity.ownerId, request);
      const intent = await readPortfolioIncrementalExplanationIntent(request);
      const comparison = await dependencies.loadComparison({
        ownerId: identity.ownerId,
        portfolioId: intent.portfolioId,
        currentFingerprint: intent.currentFingerprint,
        comparisonId: intent.comparisonId,
      });
      if (
        comparison.current.fingerprint !== intent.currentFingerprint
        || comparison.comparisonId !== intent.comparisonId
      ) {
        return publicFailure({ code: "PORTFOLIO_INCREMENTAL_REFERENCE_STALE" });
      }
      let input: PortfolioIncrementalExplanationInput;
      try {
        input = buildPortfolioIncrementalExplanationInput(comparison);
      } catch {
        return json({
          ok: false,
          code: "PORTFOLIO_INCREMENTAL_EXPLANATION_UNAVAILABLE",
          error: "Não há mudanças materiais verificadas para explicar.",
        }, 409);
      }

      let explanation: PortfolioIncrementalExplanation;
      let degraded = false;
      try {
        explanation = await dependencies.generate(input);
        degraded = explanation.source !== "ai";
      } catch {
        explanation = dependencies.fallback(input);
        degraded = true;
      }
      return json(
        { ok: true, explanation, degraded },
        200,
        degraded ? { "X-Dados-FII-AI-Fallback": "1" } : {},
      );
    } catch (error) {
      return publicFailure(error);
    }
  };
}
