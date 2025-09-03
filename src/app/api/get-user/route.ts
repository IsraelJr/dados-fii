import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";

export async function GET() {
    try {
        const cookieStore = await cookies();
        const anonId = cookieStore.get("anonId")?.value;

        if (!anonId) {
            return NextResponse.json(
                { error: "Usuário não possui cookie de sessão." },
                { status: 400 }
            );
        }

        const userRef = adminDb.collection("User").doc(anonId);
        const doc = await userRef.get();

        if (!doc.exists) {
            return NextResponse.json(
                { error: "Usuário não encontrado." },
                { status: 404 }
            );
        }

        return NextResponse.json(doc.data(), { status: 200 });
    } catch (err: any) {
        console.error("Erro ao buscar usuário:", err);
        return NextResponse.json(
            { error: err.message || "Erro desconhecido" },
            { status: 500 }
        );
    }
}
