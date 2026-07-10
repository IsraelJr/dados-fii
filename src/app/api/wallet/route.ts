import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { normalizeWallet } from "@/lib/walletSnapshots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveAnonId() {
  const cookieStore = await cookies();
  return cookieStore.get("anonId")?.value || randomUUID();
}

function withAnonCookie(response: NextResponse, anonId: string) {
  response.cookies.set("anonId", anonId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export async function GET() {
  try {
    const anonId = await resolveAnonId();
    const userRef = adminDb.collection("User").doc(anonId);
    const snap = await userRef.get();
    const data = snap.exists ? snap.data() || {} : {};
    const wallet = normalizeWallet(data.wallet || data.walletWeb || []);

    if (!snap.exists) {
      await userRef.set({ createdAt: adminFieldValue.serverTimestamp(), source: "web" }, { merge: true });
    }

    return withAnonCookie(NextResponse.json({ ok: true, anonId, wallet }), anonId);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao buscar carteira." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const anonId = await resolveAnonId();
    const body = await req.json().catch(() => ({}));
    const wallet = normalizeWallet(body?.wallet || []);

    await adminDb.collection("User").doc(anonId).set(
      {
        wallet,
        walletUpdatedAt: adminFieldValue.serverTimestamp(),
        source: "web",
      },
      { merge: true }
    );

    return withAnonCookie(NextResponse.json({ ok: true, anonId, wallet }), anonId);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao salvar carteira." }, { status: 500 });
  }
}
