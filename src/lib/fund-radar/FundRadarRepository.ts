import type { ProductPlan } from "@/lib/productPlans";
import type {
  FundRadarAccount,
  FundRadarObservation,
  FundRadarUpdate,
} from "./FundRadar";

export type FundRadarSubject = Readonly<{
  ownerId: string;
  plan: ProductPlan;
}>;

export interface FundRadarRepository {
  reconcile(subject: FundRadarSubject, now: string): Promise<FundRadarAccount>;
  start(input: Readonly<{
    subject: FundRadarSubject;
    ticker: string;
    observation: FundRadarObservation;
    now: string;
  }>): Promise<Readonly<{ account: FundRadarAccount; created: boolean }>>;
  remove(input: Readonly<{
    subject: FundRadarSubject;
    ticker: string;
    now: string;
  }>): Promise<Readonly<{ account: FundRadarAccount; removed: boolean }>>;
  setNotifications(input: Readonly<{
    subject: FundRadarSubject;
    ticker: string;
    enabled: boolean;
    now: string;
  }>): Promise<FundRadarAccount>;
  recordObservation(input: Readonly<{
    subject: FundRadarSubject;
    ticker: string;
    expectedPreviousFingerprint: string | null;
    observation: FundRadarObservation;
    updates: readonly FundRadarUpdate[];
    now: string;
  }>): Promise<Readonly<{ account: FundRadarAccount; createdUpdates: readonly FundRadarUpdate[] }>>;
  claimPendingEmailUpdates(input: Readonly<{
    subject: FundRadarSubject;
    now: string;
    leaseUntil: string;
    maximum: number;
  }>): Promise<readonly FundRadarUpdate[]>;
  completeEmailDelivery(input: Readonly<{
    subject: FundRadarSubject;
    fingerprints: readonly string[];
    sent: boolean;
    now: string;
  }>): Promise<void>;
}
