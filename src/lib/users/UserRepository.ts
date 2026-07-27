import { createHash } from "node:crypto";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import type { ProductPlan } from "@/lib/productPlans";

export type UserRecord = {
  id: string;
  ref: FirebaseFirestore.DocumentReference;
  data: Record<string, unknown>;
};

export type MonitoredFund = {
  fiiCode: string;
  percentUp: number;
  percentDown: number;
};

function hash(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function expired(value: unknown) {
  if (!value) return true;
  const date = typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate(): Date }).toDate()
    : new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) || date.getTime() <= Date.now();
}

export class UserRepository {
  private readonly users = adminDb.collection("User");

  async verifyWalletSession(email: string, token: string) {
    const snapshot = await adminDb.collection("WalletSessions").doc(hash(`${email}:${token}`)).get();
    if (!snapshot.exists) return false;
    const data = snapshot.data() || {};
    return data.email === email && !expired(data.expiresAt);
  }

  async find(options: { uid?: string | null; email?: string | null; anonId?: string | null }): Promise<UserRecord> {
    const directIds = Array.from(new Set([options.uid, options.anonId, options.email].filter(Boolean) as string[]));
    for (const id of directIds) {
      const snapshot = await this.users.doc(id).get();
      if (snapshot.exists) return { id: snapshot.id, ref: snapshot.ref, data: snapshot.data() || {} };
    }
    if (options.email) {
      for (const field of ["email", "walletSyncEmail"]) {
        const query = await this.users.where(field, "==", options.email).limit(1).get();
        if (!query.empty) {
          const snapshot = query.docs[0];
          return { id: snapshot.id, ref: snapshot.ref, data: snapshot.data() || {} };
        }
      }
    }
    const id = options.uid || options.anonId || options.email;
    if (!id) throw new Error("Não foi possível resolver o usuário.");
    return { id, ref: this.users.doc(id), data: {} };
  }

  async upsertAuthenticatedProfile(input: { uid: string; email: string; anonId?: string | null }) {
    const target = this.users.doc(input.uid);
    const legacy = input.anonId && input.anonId !== input.uid ? this.users.doc(input.anonId) : null;
    await adminDb.runTransaction(async (transaction) => {
      const [targetSnapshot, legacySnapshot] = await Promise.all([
        transaction.get(target),
        legacy ? transaction.get(legacy) : Promise.resolve(null),
      ]);
      const legacyData = legacySnapshot?.exists ? legacySnapshot.data() || {} : {};
      const targetData = targetSnapshot.exists ? targetSnapshot.data() || {} : {};
      transaction.set(target, {
        ...legacyData,
        ...targetData,
        uid: input.uid,
        email: input.email,
        emailVerified: true,
        linkedAnonId: input.anonId || null,
        updatedAt: adminFieldValue.serverTimestamp(),
        createdAt: targetData.createdAt || legacyData.createdAt || adminFieldValue.serverTimestamp(),
      }, { merge: true });
      if (legacy) {
        transaction.set(legacy, {
          linkedUid: input.uid,
          email: input.email,
          updatedAt: adminFieldValue.serverTimestamp(),
        }, { merge: true });
      }
    });
  }

  async upsertMonitoredFund(
    user: UserRecord,
    input: {
      email: string;
      plan: ProductPlan;
      fund: MonitoredFund;
      limit: number;
    },
  ) {
    return adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(user.ref);
      const current = snapshot.exists && Array.isArray(snapshot.data()?.monitored)
        ? snapshot.data()!.monitored as MonitoredFund[]
        : [];
      const normalized = current
        .filter((item) => item && typeof item === "object" && /^[A-Z0-9]{4,8}$/.test(String(item.fiiCode || "")))
        .map((item) => ({
          fiiCode: String(item.fiiCode).toUpperCase(),
          percentUp: Number(item.percentUp),
          percentDown: Number(item.percentDown),
        }));
      const existingIndex = normalized.findIndex((item) => item.fiiCode === input.fund.fiiCode);
      let monitored: MonitoredFund[];
      if (input.plan === "free") {
        if (existingIndex < 0 && normalized.length >= input.limit) {
          return { ok: false as const, code: "monitoring_limit_reached" as const, monitored: normalized };
        }
        monitored = [input.fund];
      } else if (existingIndex >= 0) {
        monitored = normalized.map((item, index) => index === existingIndex ? input.fund : item);
      } else {
        if (normalized.length >= input.limit) {
          return { ok: false as const, code: "monitoring_limit_reached" as const, monitored: normalized };
        }
        monitored = [...normalized, input.fund];
      }
      transaction.set(user.ref, {
        email: input.email,
        isPremium: input.plan !== "free",
        plan: input.plan,
        monitored,
        updatedAt: adminFieldValue.serverTimestamp(),
      }, { merge: true });
      return { ok: true as const, monitored, created: existingIndex < 0 };
    });
  }
}

export const userRepository = new UserRepository();
