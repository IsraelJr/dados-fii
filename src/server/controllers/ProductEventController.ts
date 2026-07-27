import { NextResponse } from "next/server";
import { createProductEvent, ProductEventValidationError } from "@/lib/product/ProductEvent";
import { resolveWalletIdentity, WalletIdentityError } from "@/server/auth/WalletIdentityResolver";
import { FirestoreProductEventRepository } from "@/server/repositories/FirestoreProductEventRepository";

const repository = new FirestoreProductEventRepository();

export async function POST(request: Request) {
  try {
    const identity = await resolveWalletIdentity(request);
    const body = await request.json().catch(() => ({}));
    const event = createProductEvent((body as { name?: unknown }).name);
    await repository.append(identity.ownerId, event);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof WalletIdentityError) {
      return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
    }
    if (error instanceof ProductEventValidationError) {
      return NextResponse.json({ ok: false, code: "INVALID_PRODUCT_EVENT", error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Erro interno ao registrar evento." }, { status: 500 });
  }
}
