import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";

export async function POST(req: Request) {
    const { type } = await req.json(); // "visit" ou "search"
    const ref = doc(db, "SiteDadosFii", "stats");

    if (!["visit", "search"].includes(type)) {
        return Response.json({ error: "Invalid type" }, { status: 400 });
    }

    await updateDoc(ref, {
        [type]: increment(1),
    });

    return Response.json({ success: true });
}

export async function GET() {
    const ref = doc(db, "SiteDadosFii", "stats");
    const snap = await getDoc(ref);

    if (!snap.exists()) {
        return Response.json({ error: "Stats not found" }, { status: 404 });
    }

    return Response.json(snap.data());
}
