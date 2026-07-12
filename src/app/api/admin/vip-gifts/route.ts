import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized, readAdminSession } from "@/lib/adminSession";
import { createVipGift } from "@/lib/vipGiftService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!isAdminAuthorized(req, body)) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  try {
    const session = readAdminSession(req);
    const result = await createVipGift({
      email: body?.email,
      durationDays: body?.durationDays,
      claimWindowDays: body?.claimWindowDays,
      message: body?.message,
      createdBy: session?.user || body?.createdBy || "admin",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Erro ao criar presente VIP." },
      { status: 400 }
    );
  }
}
