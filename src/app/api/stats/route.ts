import { db } from "@/lib/firebase"; // Firestore Client SDK
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";

export async function POST(req: Request) {
    try {
        const { type } = await req.json(); // "visit" ou "search"
        if (!["visit", "search"].includes(type)) {
            return new Response(JSON.stringify({ error: "Invalid type" }), { status: 400 });
        }

        const ref = doc(db, "SiteDadosFii", "stats");
        await updateDoc(ref, { [type]: increment(1) });

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}

export async function GET() {
    try {
        const ref = doc(db, "SiteDadosFii", "stats");
        const snap = await getDoc(ref);

        if (!snap.exists()) {
            return new Response(JSON.stringify({ error: "Stats not found" }), { status: 404 });
        }

        return new Response(JSON.stringify(snap.data()), { status: 200 });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
