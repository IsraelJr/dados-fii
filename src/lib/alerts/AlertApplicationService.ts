import { monitoredFundLimit, type ProductPlan } from "@/lib/productPlans";
import { normalizeTicker } from "@/lib/regulatory/RegulatoryNormalizer";
import type { MonitoredFund, UserRecord } from "@/lib/users/UserRepository";

export class AlertConfigurationError extends Error {
  readonly status: 400 | 404 | 422 | 503;
  readonly code: string;

  constructor(
    message: string,
    status: 400 | 404 | 422 | 503,
    code: string,
  ) {
    super(message);
    this.name = "AlertConfigurationError";
    this.status = status;
    this.code = code;
  }
}

export type AlertIdentity = {
  email: string;
  plan: ProductPlan;
  user: UserRecord;
};

export type AlertRepository = {
  upsertMonitoredFund(
    user: UserRecord,
    input: {
      email: string;
      plan: ProductPlan;
      fund: MonitoredFund;
      limit: number;
    },
  ): Promise<
    | { ok: true; monitored: MonitoredFund[]; created: boolean }
    | { ok: false; code: "monitoring_limit_reached"; monitored: MonitoredFund[] }
  >;
};

export type AlertFundDirectory = {
  getByTicker(ticker: string): Promise<unknown | null>;
};

function threshold(value: unknown, fallback: number, direction: "up" | "down") {
  const parsed = Number(value ?? fallback);
  const valid = direction === "up"
    ? Number.isFinite(parsed) && parsed >= 1 && parsed <= 20
    : Number.isFinite(parsed) && parsed <= -1 && parsed >= -20;
  if (!valid) {
    throw new AlertConfigurationError(
      "Percentuais devem ficar entre 1% e 20%, respeitando a direção do alerta.",
      422,
      "invalid_threshold",
    );
  }
  return parsed;
}

export class AlertApplicationService {
  private readonly repository: AlertRepository;
  private readonly fundDirectory: AlertFundDirectory;

  constructor(
    repository: AlertRepository,
    fundDirectory: AlertFundDirectory,
  ) {
    this.repository = repository;
    this.fundDirectory = fundDirectory;
  }

  async configure(
    identity: AlertIdentity,
    input: { fiiCode?: unknown; percentUp?: unknown; percentDown?: unknown },
  ) {
    const ticker = normalizeTicker(input.fiiCode);
    if (!ticker) {
      throw new AlertConfigurationError("Ticker ausente ou inválido.", 400, "invalid_ticker");
    }
    const fund = await this.fundDirectory.getByTicker(ticker).catch(() => {
      throw new AlertConfigurationError(
        "O catálogo de fundos está temporariamente indisponível.",
        503,
        "fund_directory_unavailable",
      );
    });
    if (!fund) {
      throw new AlertConfigurationError("Fundo não encontrado.", 404, "fund_not_found");
    }

    const paid = identity.plan !== "free";
    const percentUp = threshold(paid ? input.percentUp : 3, 3, "up");
    const percentDown = threshold(paid ? input.percentDown : -3, -3, "down");
    const limit = monitoredFundLimit(identity.plan);
    const result = await this.repository.upsertMonitoredFund(identity.user, {
      email: identity.email,
      plan: identity.plan,
      fund: { fiiCode: ticker, percentUp, percentDown },
      limit,
    });
    if (!result.ok) {
      throw new AlertConfigurationError(
        `Seu plano permite acompanhar até ${limit} fundo${limit === 1 ? "" : "s"}.`,
        422,
        result.code,
      );
    }
    return {
      ticker,
      plan: identity.plan,
      monitoredCount: result.monitored.length,
      limit,
      created: result.created,
    };
  }
}
