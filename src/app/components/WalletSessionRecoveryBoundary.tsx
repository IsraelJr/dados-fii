"use client";

import { useEffect } from "react";
import { installWalletUnauthorizedObserver } from "@/lib/users/WalletSessionRecoveryClient";

export default function WalletSessionRecoveryBoundary() {
  useEffect(() => installWalletUnauthorizedObserver(), []);
  return null;
}
