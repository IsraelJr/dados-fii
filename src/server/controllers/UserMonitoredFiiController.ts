import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET() {
    try {
        const cookieStore = await cookies();
        const anonId = cookieStore.get("anonId")?.value;

        if (!anonId) {
            return NextResponse.json({ error: "No anonId found" }, { status: 400 });
        }

        const ref = adminDb.collection("User").doc(anonId);
        const snap = await ref.get();

        if (!snap.exists) {
            return NextResponse.json({ monitored: null });
        }

        const monitored = snap.data()?.monitored || null;

        return NextResponse.json({ monitored });
    } catch (err: any) {
        console.error("Error fetching monitored FIIs:", err);
        return NextResponse.json({ error: "Não foi possível carregar o fundo acompanhado." }, { status: 500 });
    }
}
