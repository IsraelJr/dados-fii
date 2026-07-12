import { NextResponse } from "next/server";
import { acceptVipGift, declineVipGift, listVipGifts } from "@/lib/vipGiftService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "list").trim().toLowerCase();

    if (action === "list" || action === "status") {
      const result = await listVipGifts(body?.email, body?.sessionToken);
      return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "accept") {
      const result = await acceptVipGift({ email: body?.email, sessionToken: body?.sessionToken, giftId: body?.giftId });
      return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "decline" || action === "ignore") {
      const result = await declineVipGift({ email: body?.email, sessionToken: body?.sessionToken, giftId: body?.giftId });
      return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({ ok: false, error: "Ação inválida." }, { status: 400 });
  } catch (error: any) {
    const message = error?.message || "Erro ao processar presente VIP.";
    const status = message.toLowerCase().includes("sessão expirada") ? 401 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
