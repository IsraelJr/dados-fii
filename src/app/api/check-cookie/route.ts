// app/api/check-cookie/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
    try {
        const cookieStore = await cookies();
        const anonId = cookieStore.get("anonId")?.value;

        return NextResponse.json({ hasCookie: !!anonId });
    } catch (err: any) {
        console.error("Erro ao verificar cookie:", err);
        return NextResponse.json({ hasCookie: false, error: "Não foi possível consultar a sessão." }, { status: 500 });
    }
}
