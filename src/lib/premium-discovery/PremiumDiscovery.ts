export const PREMIUM_DISCOVERY_VERSION = "premium-discovery-v1" as const;
export const PREMIUM_DISCOVERY_RETENTION_DAYS = 90 as const;

export const PREMIUM_DISCOVERY_ORIGINS = [
  "portfolio_intelligence",
  "fund_report",
  "premium_page",
] as const;

export const PREMIUM_DISCOVERY_MOTIVATIONS = [
  "portfolio_analysis",
  "risk_lab",
  "fund_monitoring",
  "incremental_report",
] as const;

export const PREMIUM_DISCOVERY_EVENT_NAMES = [
  "premium_discovery_viewed",
  "premium_interest_requested",
  "premium_beta_accessed",
] as const;

export const PREMIUM_DISCOVERY_AUDIENCES = [
  "external",
  "beta",
  "premium",
  "owner",
] as const;

export type PremiumDiscoveryOrigin = (typeof PREMIUM_DISCOVERY_ORIGINS)[number];
export type PremiumDiscoveryMotivation = (typeof PREMIUM_DISCOVERY_MOTIVATIONS)[number];
export type PremiumDiscoveryEventName = (typeof PREMIUM_DISCOVERY_EVENT_NAMES)[number];
export type PremiumDiscoveryAudience = (typeof PREMIUM_DISCOVERY_AUDIENCES)[number];
export type PremiumDiscoveryAccess = "eligible" | "requested" | "beta" | "premium" | "owner";

export type PremiumDiscoveryRequest = Readonly<{
  origin: PremiumDiscoveryOrigin;
  motivation: PremiumDiscoveryMotivation;
}>;

export type PremiumDiscoveryStatus = Readonly<{
  version: typeof PREMIUM_DISCOVERY_VERSION;
  phase: "validation";
  access: PremiumDiscoveryAccess;
  hasPremiumAccess: boolean;
  canRequestAccess: boolean;
  interestRequested: boolean;
  message: string;
}>;

export type PremiumDiscoveryEvent = Readonly<{
  name: PremiumDiscoveryEventName;
  schemaVersion: 1;
  origin: PremiumDiscoveryOrigin;
  audience: PremiumDiscoveryAudience;
  correlationId: string;
  retentionDays: typeof PREMIUM_DISCOVERY_RETENTION_DAYS;
  occurredAt: string;
}>;

export class PremiumDiscoveryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PremiumDiscoveryValidationError";
  }
}

function memberOf<const T extends readonly string[]>(values: T, value: unknown): T[number] | null {
  const normalized = String(value ?? "").trim();
  return values.includes(normalized as T[number]) ? normalized as T[number] : null;
}

export function createPremiumDiscoveryRequest(value: unknown): PremiumDiscoveryRequest {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const origin = memberOf(PREMIUM_DISCOVERY_ORIGINS, input.origin);
  const motivation = memberOf(PREMIUM_DISCOVERY_MOTIVATIONS, input.motivation);
  if (!origin || !motivation) {
    throw new PremiumDiscoveryValidationError("Pedido de acesso beta inválido.");
  }
  return Object.freeze({ origin, motivation });
}

export function premiumDiscoveryAudience(access: PremiumDiscoveryAccess): PremiumDiscoveryAudience {
  if (access === "beta") return "beta";
  if (access === "premium") return "premium";
  if (access === "owner") return "owner";
  return "external";
}

export function createPremiumDiscoveryEvent(
  name: PremiumDiscoveryEventName,
  origin: PremiumDiscoveryOrigin,
  audience: PremiumDiscoveryAudience,
  correlationId: string,
  now = new Date(),
): PremiumDiscoveryEvent {
  if (!PREMIUM_DISCOVERY_EVENT_NAMES.includes(name)) {
    throw new PremiumDiscoveryValidationError("Evento de descoberta Premium inválido.");
  }
  if (!PREMIUM_DISCOVERY_AUDIENCES.includes(audience)) {
    throw new PremiumDiscoveryValidationError("Audiência do evento inválida.");
  }
  const normalizedCorrelationId = String(correlationId || "").trim();
  if (!/^[a-zA-Z0-9-]{16,128}$/.test(normalizedCorrelationId)) {
    throw new PremiumDiscoveryValidationError("Correlação do evento inválida.");
  }
  return Object.freeze({
    name,
    schemaVersion: 1,
    origin,
    audience,
    correlationId: normalizedCorrelationId,
    retentionDays: PREMIUM_DISCOVERY_RETENTION_DAYS,
    occurredAt: now.toISOString(),
  });
}

export function premiumDiscoveryStatus(
  access: PremiumDiscoveryAccess,
  interestRequested = false,
): PremiumDiscoveryStatus {
  const hasPremiumAccess = access === "beta" || access === "premium" || access === "owner";
  const messages: Record<PremiumDiscoveryAccess, string> = {
    eligible: "Você pode solicitar participação no beta controlado.",
    requested: "Seu interesse foi registrado. O acesso não é liberado automaticamente.",
    beta: "Seu acesso ao beta Premium está liberado.",
    premium: "Sua conta já possui acesso Premium.",
    owner: "Acesso administrativo reconhecido pelo servidor.",
  };
  return Object.freeze({
    version: PREMIUM_DISCOVERY_VERSION,
    phase: "validation",
    access,
    hasPremiumAccess,
    canRequestAccess: !hasPremiumAccess && access !== "requested",
    interestRequested: interestRequested || access === "requested",
    message: messages[access],
  });
}
