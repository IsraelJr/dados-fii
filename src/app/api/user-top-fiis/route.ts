// app/api/user-top-fiis/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebaseAdmin";

function normalizeTicker(value: unknown) {
    return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const anonId = cookieStore.get("anonId")?.value;

        if (!anonId) {
            return NextResponse.json({ error: "No anonId found" }, { status: 400 });
        }

        const exclude = new Set(
            String(req.nextUrl.searchParams.get("exclude") || "")
                .split(",")
                .map(normalizeTicker)
                .filter(Boolean)
        );
        const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") || 3), 1), 10);

        const ref = adminDb.collection("User").doc(anonId);
        const snap = await ref.get();

        if (!snap.exists) {
            return NextResponse.json({ topFiis: [] });
        }

        const searches = snap.data()?.searches || {};

        const topFiis = Object.entries(searches)
            .map(([name, count]) => ({ ticker: normalizeTicker(name), count: Number(count || 0) }))
            .filter((item) => item.ticker && !exclude.has(item.ticker))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit)
            .map((item) => item.ticker);

        return NextResponse.json({ topFiis, excluded: Array.from(exclude) });
    } catch (err: any) {
        console.error("Error fetching top FIIs:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
