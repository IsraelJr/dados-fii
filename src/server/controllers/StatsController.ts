// Controlador de aplicação; o Route Handler permanece sem acesso à persistência.
import type { NextRequest } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

const STATS_DOC = adminDb.collection("SiteDadosFii").doc("stats");

export async function POST(req: NextRequest) {
    try {
        const { type } = await req.json();

        if (!["visit", "search"].includes(type)) {
            return new Response(JSON.stringify({ error: "Invalid type" }), { status: 400 });
        }

        await STATS_DOC.update({
            [type]: adminFieldValue.increment(1),
        });

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: "Não foi possível atualizar as estatísticas." }), { status: 500 });
    }
}

export async function GET() {
    try {
        const snap = await STATS_DOC.get();

        if (!snap.exists) {
            return new Response(JSON.stringify({ error: "Stats not found" }), { status: 404 });
        }

        return new Response(JSON.stringify(snap.data()), { status: 200 });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: "Não foi possível carregar as estatísticas." }), { status: 500 });
    }
}
