import type { ProductEventName } from "./ProductEvent";

const EMAIL_KEY = "dados-fii-wallet-email";
const TOKEN_KEY = "dados-fii-wallet-session";

export async function trackProductEvent(name: ProductEventName): Promise<void> {
  if (typeof window === "undefined") return;
  const email = String(window.localStorage.getItem(EMAIL_KEY) || "").trim().toLowerCase();
  const token = String(window.localStorage.getItem(TOKEN_KEY) || "");
  if (!email || !token) return;

  await fetch("/api/product/events", {
    method: "POST",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
      "x-wallet-email": email,
      "x-wallet-session": token,
    },
    body: JSON.stringify({ name }),
  }).catch(() => undefined);
}
