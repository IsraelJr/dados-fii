import type { NextApiRequest, NextApiResponse } from "next";
import admin from "firebase-admin";

// Inicializa o Firebase Admin apenas uma vez
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS!)),
  });
}


const db = admin.firestore();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { ticker } = req.query; // /api/fii?ticker=MXRF11

    if (!ticker || typeof ticker !== "string") {
      return res.status(400).json({ error: "Ticker é obrigatório" });
    }

    const doc = await db.collection("Fiis").doc(ticker).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "FII não encontrado" });
    }

    res.status(200).json(doc.data());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
