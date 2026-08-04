import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createEditorialEvent, EditorialEventValidationError } from "@/lib/editorial/EditorialEvent";
import { FirestoreEditorialEventRepository } from "@/server/repositories/FirestoreEditorialEventRepository";

const repository = new FirestoreEditorialEventRepository();
const RATE_LIMIT = 30;
const WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(forwarded).digest("hex");
}

function isRateLimited(key: string, now = Date.now()) {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT;
}

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || 0) > 2048) {
      return NextResponse.json({ ok: false, code: "PAYLOAD_TOO_LARGE" }, { status: 413 });
    }
    if (isRateLimited(clientKey(request))) {
      return NextResponse.json({ ok: false, code: "RATE_LIMITED" }, { status: 429 });
    }
    const body = await request.json().catch(() => ({}));
    const event = createEditorialEvent(body, randomUUID());
    await repository.append(event);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof EditorialEventValidationError) {
      return NextResponse.json({ ok: false, code: "INVALID_EDITORIAL_EVENT", error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Erro interno ao registrar evento editorial." }, { status: 500 });
  }
}
