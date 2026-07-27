// app/api/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
    try {
        const { fii } = await req.json();

        const cookieStore = await cookies();
        const anonId = cookieStore.get("anonId")?.value;

        if (!anonId) {
            return NextResponse.json({ error: "No anonId found" }, { status: 400 });
        }

        if (!fii) {
            return NextResponse.json({ error: "No FII provided" }, { status: 400 });
        }

        const ref = adminDb.collection("User").doc(anonId);

        // Atualiza ou cria o documento
        await ref.set(
            {
                searches: {
                    [fii.toUpperCase().trim()]: adminFieldValue.increment(1), // usa FieldValue do singleton adminDb
                },
                lastSearch: new Date().toISOString(),
            },
            { merge: true }
        );

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("Firestore error:", err);
        return NextResponse.json({ error: "Não foi possível registrar a busca." }, { status: 500 });
    }
}
