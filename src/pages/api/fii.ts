import type { NextApiRequest, NextApiResponse } from "next";
import admin from "firebase-admin";

// Inicializa o Firebase Admin apenas uma vez
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS!)
    ),
  });
}

const db = admin.firestore();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { ticker } = req.query; // /api/fii?ticker=TGAR11

    if (!ticker || typeof ticker !== "string") {
      return res.status(400).json({ error: "Ticker é obrigatório" });
    }

    // Busca pelo campo 'code'
    const querySnapshot = await db
      .collection("Fiis")
      .where("code", "==", (ticker as string).toUpperCase())
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return res.status(404).json({ error: "FII não encontrado" });
    }

    const docData = querySnapshot.docs[0].data();

    res.status(200).json(docData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
