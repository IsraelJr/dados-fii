export const REGISTERED_USER_EMAIL_KEY = "dados-fii-wallet-email";
export const REGISTERED_USER_SESSION_KEY = "dados-fii-wallet-session";

export function readRegisteredUserCredentials() {
  if (typeof window === "undefined") return { email: "", sessionToken: "" };
  return {
    email: String(window.localStorage.getItem(REGISTERED_USER_EMAIL_KEY) || "").trim().toLowerCase(),
    sessionToken: String(window.localStorage.getItem(REGISTERED_USER_SESSION_KEY) || "").trim(),
  };
}

export function hasRegisteredUserCredentials() {
  const credentials = readRegisteredUserCredentials();
  return Boolean(credentials.email && credentials.sessionToken);
}
