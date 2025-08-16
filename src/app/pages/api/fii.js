import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  try {
    const { ticker } = req.query; // /api/fii?ticker=MXRF11
    if (!ticker) {
      return res.status(400).json({ error: "Ticker é obrigatório" });
    }

    const doc = await db.collection("Fiis").doc(ticker).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "FII não encontrado" });
    }

    res.status(200).json(doc.data());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
