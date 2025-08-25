// app/api/user-top-fiis/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

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
            return NextResponse.json({ topFiis: [] });
        }

        const searches = snap.data()?.searches || {};

        const topFiis = Object.entries(searches)
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .slice(0, 3)
            .map(([name]) => name);

        return NextResponse.json({ topFiis });
    } catch (err: any) {
        console.error("Error fetching top FIIs:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
