import type { ProductPlan } from "@/lib/productPlans";
import type { FundRadarUpdate } from "./FundRadar";
import type { FundRadarRepository, FundRadarSubject } from "./FundRadarRepository";

export type FundRadarBatchOwner = Readonly<{
  ownerId: string;
  email: string | null;
  plan: ProductPlan;
}>;

export interface FundRadarOwnerSource {
  list(limit: number): Promise<readonly FundRadarBatchOwner[]>;
}

export interface FundRadarBatchService {
  refresh(subject: FundRadarSubject): Promise<Readonly<{ processed: number; createdUpdates: readonly FundRadarUpdate[] }>>;
}

export interface FundRadarEmailGateway {
  send(email: string, updates: readonly FundRadarUpdate[]): Promise<boolean>;
}

function email(value: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

export class FundRadarBatchProcessor {
  private readonly owners: FundRadarOwnerSource;
  private readonly repository: FundRadarRepository;
  private readonly service: FundRadarBatchService;
  private readonly mail: FundRadarEmailGateway;
  private readonly now: () => Date;

  constructor(
    owners: FundRadarOwnerSource,
    repository: FundRadarRepository,
    service: FundRadarBatchService,
    mail: FundRadarEmailGateway,
    now: () => Date = () => new Date(),
  ) {
    this.owners = owners;
    this.repository = repository;
    this.service = service;
    this.mail = mail;
    this.now = now;
  }

  async run(limit = 40) {
    const boundedLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
    const owners = await this.owners.list(boundedLimit);
    const totals = { owners: owners.length, processedFunds: 0, updates: 0, emailsSent: 0, skippedEmail: 0, errors: 0 };

    for (const owner of owners) {
      const subject = Object.freeze({ ownerId: owner.ownerId, plan: owner.plan });
      try {
        const refreshed = await this.service.refresh(subject);
        totals.processedFunds += refreshed.processed;
        totals.updates += refreshed.createdUpdates.length;
        const now = this.now();
        const claimed = await this.repository.claimPendingEmailUpdates({
          subject,
          now: now.toISOString(),
          leaseUntil: new Date(now.getTime() + 10 * 60_000).toISOString(),
          maximum: 20,
        });
        if (!claimed.length) continue;
        const recipient = email(owner.email);
        if (!recipient) {
          totals.skippedEmail += claimed.length;
          await this.repository.completeEmailDelivery({
            subject,
            fingerprints: claimed.map((item) => item.fingerprint),
            sent: false,
            now: this.now().toISOString(),
          });
          continue;
        }
        const sent = await this.mail.send(recipient, claimed);
        await this.repository.completeEmailDelivery({
          subject,
          fingerprints: claimed.map((item) => item.fingerprint),
          sent,
          now: this.now().toISOString(),
        });
        if (sent) totals.emailsSent += 1;
        else totals.skippedEmail += claimed.length;
      } catch {
        totals.errors += 1;
      }
    }
    return Object.freeze({ ok: totals.errors === 0, limit: boundedLimit, ...totals });
  }
}
