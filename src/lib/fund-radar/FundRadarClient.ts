"use client";

import type { User } from "firebase/auth";

const EMAIL_KEY = "dados-fii-wallet-email";
const SESSION_KEY = "dados-fii-wallet-session";

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function fundRadarAuthorizationHeaders(user: User | null) {
  if (user) {
    const token = await user.getIdToken();
    return Object.freeze({ Authorization: `Bearer ${token}` });
  }
  try {
    const email = String(window.localStorage.getItem(EMAIL_KEY) || "").trim().toLowerCase();
    const session = String(window.localStorage.getItem(SESSION_KEY) || "");
    if (validEmail(email) && session) {
      return Object.freeze({ "x-wallet-email": email, "x-wallet-session": session });
    }
  } catch {
    return null;
  }
  return null;
}

export async function fundRadarRequest(
  user: User | null,
  path: string,
  options: Readonly<{ method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown }> = {},
) {
  const authorization = await fundRadarAuthorizationHeaders(user);
  if (!authorization) {
    const error = new Error("Confirme seu acesso para usar o Radar.");
    error.name = "FUND_RADAR_AUTH_REQUIRED";
    throw error;
  }
  const method = options.method || "GET";
  const response = await fetch(path, {
    method,
    headers: {
      ...authorization,
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const error = new Error(String(payload.error || "Não foi possível acessar o Radar."));
    error.name = String(payload.code || "FUND_RADAR_REQUEST_FAILED");
    throw error;
  }
  return payload;
}
