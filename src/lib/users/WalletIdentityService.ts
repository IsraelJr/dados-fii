import admin from "@/lib/firebaseAdmin";
import { isAllowedAdminEmail } from "@/lib/adminSecurity";
import { paidPlanFromRecord, type ProductPlan } from "@/lib/productPlans";
import { userRepository, type UserRecord, type UserRepository } from "@/lib/users/UserRepository";
import type { NextRequest } from "next/server";

export type WalletIdentity = {
  uid: string | null;
  email: string;
  plan: ProductPlan;
  source: "firebase" | "wallet_session";
  actor: string;
  user: UserRecord;
};

export type WalletAuthorization =
  | { ok: true; identity: WalletIdentity }
  | { ok: false; status: 400 | 401 | 403; error: string };

function normalizedEmail(value: unknown) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function bearer(request: NextRequest) {
  const match = (request.headers.get("authorization") || "").match(/^Bearer ([^\s]+)$/);
  return match?.[1] || "";
}

export class WalletIdentityService {
  constructor(private readonly repository: UserRepository = userRepository) {}

  async require(request: NextRequest, claimedEmail?: unknown): Promise<WalletAuthorization> {
    const token = bearer(request);
    if (!token) return { ok: false, status: 401, error: "Sessão verificada obrigatória." };
    const requestedEmail = normalizedEmail(claimedEmail);

    try {
      const decoded = await admin.auth().verifyIdToken(token, true);
      const email = normalizedEmail(decoded.email);
      if (!decoded.email_verified || !email) return { ok: false, status: 403, error: "E-mail autenticado e verificado é obrigatório." };
      if (requestedEmail && requestedEmail !== email) return { ok: false, status: 403, error: "O e-mail informado não pertence à sessão." };
      const anonId = request.cookies.get("anonId")?.value || null;
      const user = await this.repository.find({ uid: decoded.uid, email, anonId });
      const plan = isAllowedAdminEmail(email) ? "super_premium" : paidPlanFromRecord(user.data) || "free";
      return {
        ok: true,
        identity: {
          uid: decoded.uid,
          email,
          plan,
          source: "firebase",
          actor: `user:${decoded.uid}`,
          user,
        },
      };
    } catch {
      if (!requestedEmail) return { ok: false, status: 400, error: "E-mail da carteira é obrigatório para esta sessão." };
      if (!await this.repository.verifyWalletSession(requestedEmail, token)) {
        return { ok: false, status: 401, error: "Sessão da carteira inválida ou expirada." };
      }
      const user = await this.repository.find({
        email: requestedEmail,
        anonId: request.cookies.get("anonId")?.value || null,
      });
      return {
        ok: true,
        identity: {
          uid: null,
          email: requestedEmail,
          plan: paidPlanFromRecord(user.data) || "free",
          source: "wallet_session",
          actor: `wallet:${user.id}`,
          user,
        },
      };
    }
  }
}

export const walletIdentityService = new WalletIdentityService();
