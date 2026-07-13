import { createHash } from "crypto";
import { adminDb } from "@/lib/firebaseAdmin";

export type RegisteredUserAccessInput = {
  email?: unknown;
  sessionToken?: unknown;
};

export type RegisteredUserAccess = {
  email: string;
  userDocId: string;
  user: Record<string, any>;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeRegisteredUserEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function isRegisteredUserEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isExpired(value: any) {
  if (!value) return true;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return !date || Number.isNaN(date.getTime()) || date.getTime() < Date.now();
}

async function validateWalletSession(email: string, sessionToken: unknown) {
  const token = String(sessionToken || "").trim();
  if (!token) return false;
  const snapshot = await adminDb
    .collection("WalletSessions")
    .doc(sha256(`${email}:${token}`))
    .get();
  if (!snapshot.exists) return false;
  const data = snapshot.data() || {};
  return normalizeRegisteredUserEmail(data.email) === email && !isExpired(data.expiresAt);
}

async function findRegisteredUser(email: string) {
  const users = adminDb.collection("User");
  const direct = await users.doc(email).get();
  if (direct.exists) return { userDocId: direct.id, user: direct.data() || {} };

  const query = await users.where("email", "==", email).limit(1).get();
  if (query.empty) return null;
  const document = query.docs[0];
  return { userDocId: document.id, user: document.data() || {} };
}

export async function requireRegisteredUserAccess(
  input: RegisteredUserAccessInput
): Promise<RegisteredUserAccess> {
  const email = normalizeRegisteredUserEmail(input.email);
  if (!isRegisteredUserEmail(email)) {
    throw Object.assign(new Error("Informe um e-mail cadastrado válido."), { status: 400 });
  }
  if (!(await validateWalletSession(email, input.sessionToken))) {
    throw Object.assign(new Error("Sessão inválida ou expirada. Confirme novamente seu e-mail no site."), { status: 401 });
  }

  const registered = await findRegisteredUser(email);
  if (!registered) {
    throw Object.assign(new Error("Usuário não cadastrado no site."), { status: 403 });
  }

  return { email, ...registered };
}

export function registeredUserErrorStatus(error: any) {
  const status = Number(error?.status);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
}
