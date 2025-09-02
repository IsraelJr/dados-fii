import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, fiiCode, isPremium } = body;

        if (!email || !fiiCode || typeof isPremium !== "boolean") {
            return NextResponse.json({ error: "Email, FII e isPremium são obrigatórios." }, { status: 400 });
        }

        // Pegar cookie do usuário
        const cookieStore = await cookies();
        const anonId = cookieStore.get("anonId")?.value;
        
        if (!anonId) {
            return NextResponse.json({ error: "Usuário não possui cookie de sessão." }, { status: 400 });
        }

        const userRef = adminDb.collection("User").doc(anonId);

        // Ler documento existente
        const doc = await userRef.get();
        let monitoredData: any = {
            listFiis: [fiiCode],
            percentUp: 3,
            percentDown: -3,
            phone: "+5511999999999"
        };

        if (doc.exists) {
            const existing = doc.data()?.monitored || {};
            if (isPremium) {
                const listFiis = Array.isArray(existing.listFiis) ? [...existing.listFiis] : [];
                if (!listFiis.includes(fiiCode)) listFiis.push(fiiCode);

                monitoredData = {
                    ...existing,
                    listFiis,
                    percentUp: existing.percentUp ?? 3,
                    percentDown: existing.percentDown ?? -3,
                    phone: existing.phone ?? "+5511999999999",
                };
            } else {
                monitoredData = {
                    ...existing,
                    listFiis: [fiiCode],
                    percentUp: existing.percentUp ?? 3,
                    percentDown: existing.percentDown ?? -3,
                    phone: existing.phone ?? "+5511999999999",
                };
            }
        }

        // Atualiza ou cria documento
        await userRef.set(
            {
                email,
                monitored: monitoredData
            },
            { merge: true }
        );

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("Erro ao adicionar alert:", err);
        return NextResponse.json({ error: err.message || "Erro desconhecido" }, { status: 500 });
    }
}
