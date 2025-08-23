import type { NextRequest } from "next/server";
import admin from "firebase-admin";

// Inicializa o Firebase Admin apenas uma vez
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(
            JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)
        ),
    });
}

const db = admin.firestore();
const STATS_DOC = db.collection("SiteDadosFii").doc("stats");

export async function POST(req: NextRequest) {
    try {
        const { type } = await req.json();
        
        if (!["visit", "search"].includes(type)) {
            return new Response(JSON.stringify({ error: "Invalid type" }), { status: 400 });
        }

        await STATS_DOC.update({
            [type]: admin.firestore.FieldValue.increment(1),
        });

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
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
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
