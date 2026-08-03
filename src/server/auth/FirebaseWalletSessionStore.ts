import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import {
  WalletSessionStore,
  type WalletSessionDatabase,
} from "@/server/auth/WalletSessionStore";

export const walletSessionStore = new WalletSessionStore(
  adminDb as unknown as WalletSessionDatabase,
  () => adminFieldValue.serverTimestamp(),
);
