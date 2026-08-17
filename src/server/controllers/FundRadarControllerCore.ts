import { FundRadarError } from "@/lib/fund-radar/FundRadar";
import { FundRadarIdentityError } from "@/lib/fund-radar/FundRadarIdentity";
import { FundRadarRateLimitError } from "@/lib/fund-radar/FundRadarRateLimitError";
import type { FundRadarService } from "@/lib/fund-radar/FundRadarService";
import type { FundRadarSubject } from "@/lib/fund-radar/FundRadarRepository";
import {
  FundRadarRequestError,
  readFundRadarFollowIntent,
  readFundRadarNotificationIntent,
} from "@/lib/security/FundRadarRequestPolicy";

const HEADERS = Object.freeze({
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
});

export type FundRadarTelemetryEvent = "radar_follow_started" | "radar_follow_removed" | "radar_limit_reached" | "radar_update_opened";

export type FundRadarControllerDependencies = Readonly<{
  enabled(): boolean;
  sameOrigin(request: Request): boolean;
  resolveSubject(request: Request): Promise<FundRadarSubject>;
  consumeRateLimit(ownerId: string): Promise<void>;
  service: Pick<FundRadarService, "list" | "follow" | "remove" | "setNotifications" | "refresh">;
  telemetry(event: FundRadarTelemetryEvent, subject: FundRadarSubject): Promise<void>;
}>;

function json(payload: unknown, status = 200, extra: Readonly<Record<string, string>> = {}) {
  return Response.json(payload, { status, headers: { ...HEADERS, ...extra } });
}

function disabled() {
  return json({ ok: false, code: "FUND_RADAR_DISABLED", error: "Radar temporariamente indisponível." }, 404);
}

function originAllowed(request: Request, dependencies: FundRadarControllerDependencies) {
  return !request.headers.get("origin") || dependencies.sameOrigin(request);
}

function publicFailure(error: unknown) {
  if (error instanceof FundRadarIdentityError) {
    return json({ ok: false, code: error.code, error: error.status === 401 ? "Sessão verificada obrigatória." : "Acesso não autorizado." }, error.status);
  }
  if (error instanceof FundRadarRequestError) {
    const messages: Record<FundRadarRequestError["code"], string> = {
      FUND_RADAR_INVALID_CONTENT_TYPE: "A solicitação deve usar JSON.",
      FUND_RADAR_PAYLOAD_TOO_LARGE: "Solicitação acima do limite permitido.",
      FUND_RADAR_INVALID_JSON: "Payload JSON inválido.",
      FUND_RADAR_INVALID_PAYLOAD: "Solicitação inválida.",
    };
    return json({ ok: false, code: error.code, error: messages[error.code] }, error.status);
  }
  if (error instanceof FundRadarRateLimitError) {
    return json({
      ok: false,
      code: error.code,
      error: error.status === 429 ? "Muitas alterações no Radar. Aguarde antes de tentar novamente." : "Controle de solicitações temporariamente indisponível.",
    }, error.status, error.retryAfter === null ? {} : { "Retry-After": String(error.retryAfter) });
  }
  if (error instanceof FundRadarError) {
    const messages: Record<FundRadarError["code"], string> = {
      FUND_RADAR_INVALID_TICKER: "Ticker inválido.",
      FUND_RADAR_FUND_NOT_FOUND: "Fundo não encontrado.",
      FUND_RADAR_FUND_INACTIVE: "Este fundo não está ativo para acompanhamento.",
      FUND_RADAR_FUND_IN_PORTFOLIO: "Este fundo já faz parte da carteira e é acompanhado pela Inteligência da Carteira.",
      FUND_RADAR_LIMIT_REACHED: "O limite do seu plano foi atingido.",
      FUND_RADAR_FOLLOW_NOT_FOUND: "Fundo não encontrado no Radar.",
      FUND_RADAR_OBSERVATION_STALE: "O Radar foi atualizado por outra solicitação. Tente novamente.",
    };
    return json({ ok: false, code: error.code, error: messages[error.code] }, error.status);
  }
  return json({ ok: false, code: "FUND_RADAR_INTERNAL_ERROR", error: "Não foi possível processar o Radar." }, 500);
}

async function subject(request: Request, dependencies: FundRadarControllerDependencies, mutation: boolean) {
  if (!originAllowed(request, dependencies)) throw new FundRadarIdentityError("FUND_RADAR_AUTH_FORBIDDEN", 403);
  const resolved = await dependencies.resolveSubject(request);
  if (mutation) await dependencies.consumeRateLimit(resolved.ownerId);
  return resolved;
}

export function createFundRadarHandlers(dependencies: FundRadarControllerDependencies) {
  return Object.freeze({
    async GET(request: Request) {
      if (!dependencies.enabled()) return disabled();
      try {
        const resolved = await subject(request, dependencies, false);
        const result = await dependencies.service.list(resolved);
        return json({ ok: true, ...result });
      } catch (error) {
        return publicFailure(error);
      }
    },
    async POST(request: Request) {
      if (!dependencies.enabled()) return disabled();
      try {
        const resolved = await subject(request, dependencies, true);
        const intent = await readFundRadarFollowIntent(request);
        const result = await dependencies.service.follow(resolved, intent.ticker);
        await dependencies.telemetry("radar_follow_started", resolved);
        return json({ ok: true, ...result }, result.created ? 201 : 200);
      } catch (error) {
        if (error instanceof FundRadarError && error.code === "FUND_RADAR_LIMIT_REACHED") {
          try {
            const resolved = await dependencies.resolveSubject(request);
            await dependencies.telemetry("radar_limit_reached", resolved);
          } catch {
            // Telemetria não pode alterar a resposta funcional nem expor identidade.
          }
        }
        return publicFailure(error);
      }
    },
    async PATCH(request: Request) {
      if (!dependencies.enabled()) return disabled();
      try {
        const resolved = await subject(request, dependencies, true);
        const intent = await readFundRadarNotificationIntent(request);
        const result = await dependencies.service.setNotifications(resolved, intent.ticker, intent.notificationsEnabled);
        return json({ ok: true, ...result });
      } catch (error) {
        return publicFailure(error);
      }
    },
    async DELETE(request: Request) {
      if (!dependencies.enabled()) return disabled();
      try {
        const resolved = await subject(request, dependencies, true);
        const intent = await readFundRadarFollowIntent(request);
        const result = await dependencies.service.remove(resolved, intent.ticker);
        if (result.removed) await dependencies.telemetry("radar_follow_removed", resolved);
        return json({ ok: true, ...result });
      } catch (error) {
        return publicFailure(error);
      }
    },
    async REFRESH(request: Request) {
      if (!dependencies.enabled()) return disabled();
      try {
        const resolved = await subject(request, dependencies, true);
        const result = await dependencies.service.refresh(resolved);
        return json({ ok: true, ...result });
      } catch (error) {
        return publicFailure(error);
      }
    },
  });
}
