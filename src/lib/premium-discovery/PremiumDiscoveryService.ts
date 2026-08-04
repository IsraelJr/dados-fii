import {
  createPremiumDiscoveryEvent,
  premiumDiscoveryAudience,
  premiumDiscoveryStatus,
  type PremiumDiscoveryAccess,
  type PremiumDiscoveryRequest,
  type PremiumDiscoveryStatus,
} from "./PremiumDiscovery";
import type {
  PremiumDiscoveryRepository,
  PremiumDiscoverySubject,
} from "./PremiumDiscoveryRepository";

export type PremiumDiscoveryEntitlement = Readonly<{
  access: Exclude<PremiumDiscoveryAccess, "eligible" | "requested">;
}> | null;

export class PremiumDiscoveryService {
  private readonly repository: PremiumDiscoveryRepository;
  private readonly now: () => Date;
  private readonly correlationId: () => string;

  constructor(
    repository: PremiumDiscoveryRepository,
    now: () => Date = () => new Date(),
    correlationId: () => string = () => crypto.randomUUID(),
  ) {
    this.repository = repository;
    this.now = now;
    this.correlationId = correlationId;
  }

  async status(
    subject: PremiumDiscoverySubject,
    entitlement: PremiumDiscoveryEntitlement,
    origin: PremiumDiscoveryRequest["origin"],
  ): Promise<PremiumDiscoveryStatus> {
    const access = entitlement?.access
      ?? (await this.repository.hasInterest(subject.uid) ? "requested" : "eligible");
    const audience = premiumDiscoveryAudience(access);
    const correlationId = this.correlationId();
    await this.repository.appendEvent(
      subject.uid,
      createPremiumDiscoveryEvent("premium_discovery_viewed", origin, audience, correlationId, this.now()),
    );
    if (access === "beta") {
      await this.repository.appendEvent(
        subject.uid,
        createPremiumDiscoveryEvent("premium_beta_accessed", origin, audience, correlationId, this.now()),
      );
    }
    return premiumDiscoveryStatus(access, access === "requested");
  }

  async requestAccess(
    subject: PremiumDiscoverySubject,
    entitlement: PremiumDiscoveryEntitlement,
    request: PremiumDiscoveryRequest,
  ): Promise<PremiumDiscoveryStatus> {
    if (entitlement) {
      return premiumDiscoveryStatus(entitlement.access);
    }
    const requestedAt = this.now().toISOString();
    await this.repository.saveInterest({
      subject,
      origin: request.origin,
      motivation: request.motivation,
      requestedAt,
    });
    await this.repository.appendEvent(
      subject.uid,
      createPremiumDiscoveryEvent(
        "premium_interest_requested",
        request.origin,
        "external",
        this.correlationId(),
        this.now(),
      ),
    );
    return premiumDiscoveryStatus("requested", true);
  }
}
