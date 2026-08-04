import {
  createPremiumDiscoveryEvent,
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
  constructor(
    private readonly repository: PremiumDiscoveryRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly correlationId: () => string = () => crypto.randomUUID(),
  ) {}

  async status(
    subject: PremiumDiscoverySubject,
    entitlement: PremiumDiscoveryEntitlement,
    origin: PremiumDiscoveryRequest["origin"],
  ): Promise<PremiumDiscoveryStatus> {
    const access = entitlement?.access
      ?? (await this.repository.hasInterest(subject.uid) ? "requested" : "eligible");
    await this.repository.appendEvent(
      subject.uid,
      createPremiumDiscoveryEvent("premium_discovery_viewed", origin, this.correlationId(), this.now()),
    );
    if (access === "beta") {
      await this.repository.appendEvent(
        subject.uid,
        createPremiumDiscoveryEvent("premium_beta_accessed", origin, this.correlationId(), this.now()),
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
      createPremiumDiscoveryEvent("premium_interest_requested", request.origin, this.correlationId(), this.now()),
    );
    return premiumDiscoveryStatus("requested", true);
  }
}
