import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/adminSession";
import { expireVipGifts } from "@/lib/vipGiftService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeLimit(value: unknown) {
  return Math.min(Math.max(Number(value || 300), 1), 500);
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  try {
    return NextResponse.json(
      await expireVipGifts(safeLimit(req.nextUrl.searchParams.get("limit")))
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Erro ao expirar presentes VIP." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!isAdminAuthorized(req, body)) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  try {
    return NextResponse.json(await expireVipGifts(safeLimit(body?.limit)));
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Erro ao expirar presentes VIP." },
      { status: 500 }
    );
  }
}
