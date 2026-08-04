import type {
  PremiumDiscoveryEvent,
  PremiumDiscoveryMotivation,
  PremiumDiscoveryOrigin,
} from "./PremiumDiscovery";

export type PremiumDiscoverySubject = Readonly<{
  uid: string;
  email: string;
}>;

export type PremiumInterestRecord = Readonly<{
  subject: PremiumDiscoverySubject;
  origin: PremiumDiscoveryOrigin;
  motivation: PremiumDiscoveryMotivation;
  requestedAt: string;
}>;

export interface PremiumDiscoveryRepository {
  hasInterest(uid: string): Promise<boolean>;
  saveInterest(record: PremiumInterestRecord): Promise<void>;
  appendEvent(uid: string, event: PremiumDiscoveryEvent): Promise<void>;
}
