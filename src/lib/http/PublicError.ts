export type PublicError = {
  status: number;
  message: string;
  code: string;
};

function statusOf(error: unknown) {
  const value = Number((error as { status?: unknown })?.status);
  return Number.isInteger(value) && value >= 400 && value <= 599 ? value : 500;
}

function codeOf(error: unknown) {
  const value = String((error as { code?: unknown })?.code || "");
  return /^[A-Z0-9_:-]{2,80}$/i.test(value) ? value : "internal_error";
}

export function publicError(error: unknown, fallback: string): PublicError {
  const status = statusOf(error);
  const domainMessage = error instanceof Error
    ? error.message.replace(/\s+/g, " ").trim().slice(0, 240)
    : "";
  return {
    status,
    message: status < 500 && domainMessage ? domainMessage : fallback,
    code: status < 500 ? codeOf(error) : "internal_error",
  };
}
