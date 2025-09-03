import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, fiiCode, isPremium, percentUp, percentDown } = body;

        if (!email || !fiiCode || typeof isPremium !== "boolean") {
            return NextResponse.json(
                { error: "Email, FII e isPremium são obrigatórios." },
                { status: 400 }
            );
        }

        // Identificação pelo cookie de sessão
        const cookieStore = await cookies();
        const anonId = cookieStore.get("anonId")?.value;

        if (!anonId) {
            return NextResponse.json(
                { error: "Usuário não possui cookie de sessão." },
                { status: 400 }
            );
        }

        const userRef = adminDb.collection("User").doc(anonId);

        // Ler documento existente
        const doc = await userRef.get();

        // Estrutura de monitoramento: lista de FIIs
        let monitoredData: any[] = [
            {
                fiiCode,
                percentUp: Number(percentUp ?? 3),
                percentDown: Number(percentDown ?? -3),
            },
        ];

        if (doc.exists) {
            const existing = Array.isArray(doc.data()?.monitored)
                ? doc.data()?.monitored
                : [];

            if (isPremium) {
                // Premium → pode monitorar vários FIIs
                const alreadyExists = existing.find((f: any) => f.fiiCode === fiiCode);

                if (alreadyExists) {
                    // Atualiza o FII já monitorado
                    monitoredData = existing.map((f: any) =>
                        f.fiiCode === fiiCode
                            ? {
                                ...f,
                                percentUp: Number(percentUp ?? f.percentUp),
                                percentDown: Number(percentDown ?? f.percentDown),
                            }
                            : f
                    );
                } else {
                    // Adiciona novo FII
                    monitoredData = [
                        ...existing,
                        {
                            fiiCode,
                            percentUp: Number(percentUp ?? 3),
                            percentDown: Number(percentDown ?? -3),
                        },
                    ];
                }
            } else {
                // Free → só pode monitorar 1 FII
                monitoredData = [
                    {
                        fiiCode,
                        percentUp: Number(percentUp ?? 3),
                        percentDown: Number(percentDown ?? -3),
                    },
                ];
            }
        }

        // Atualiza ou cria documento no Firestore
        await userRef.set(
            {
                email,
                isPremium,
                monitored: monitoredData,
            },
            { merge: true }
        );

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("Erro ao adicionar alert:", err);
        return NextResponse.json(
            { error: err.message || "Erro desconhecido" },
            { status: 500 }
        );
    }
}
