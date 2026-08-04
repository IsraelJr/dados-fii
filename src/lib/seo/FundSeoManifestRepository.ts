import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { REGULATORY_COLLECTIONS } from "@/lib/regulatory/RegulatoryTypes";
import type { FundSeoManifest } from "./FundSeoManifest";

const FIRESTORE_SAFE_DOCUMENT_BYTES = 900_000;

function validateManifest(manifest: FundSeoManifest) {
  if (manifest.schemaVersion !== 1) throw new Error("Versão do manifesto SEO inválida.");
  if (!Number.isInteger(manifest.total) || manifest.total !== manifest.entries.length) {
    throw new Error("Total do manifesto SEO inconsistente.");
  }
  if (!Number.isInteger(manifest.indexableTotal)
    || manifest.indexableTotal !== manifest.entries.filter((entry) => entry.indexable).length) {
    throw new Error("Total indexável do manifesto SEO inconsistente.");
  }
  const tickers = manifest.entries.map((entry) => entry.ticker);
  if (new Set(tickers).size !== tickers.length) throw new Error("Manifesto SEO contém tickers duplicados.");
  if (tickers.some((ticker, index) => index > 0 && ticker.localeCompare(tickers[index - 1]) < 0)) {
    throw new Error("Manifesto SEO deve estar ordenado por ticker.");
  }
}

export class FundSeoManifestRepository {
  async getCurrent(): Promise<FundSeoManifest | null> {
    const snapshot = await adminDb.collection(REGULATORY_COLLECTIONS.seoManifests).doc("current").get();
    if (!snapshot.exists) return null;
    const manifest = snapshot.data() as FundSeoManifest;
    validateManifest(manifest);
    return manifest;
  }

  async saveCurrent(manifest: FundSeoManifest, actor: string) {
    if (!actor.trim()) throw new Error("Ator do manifesto SEO obrigatório.");
    validateManifest(manifest);
    const sizeBytes = Buffer.byteLength(JSON.stringify(manifest), "utf8");
    if (sizeBytes > FIRESTORE_SAFE_DOCUMENT_BYTES) {
      throw new Error("Manifesto SEO excedeu o limite operacional seguro do Firestore.");
    }

    const batch = adminDb.batch();
    batch.set(adminDb.collection(REGULATORY_COLLECTIONS.seoManifests).doc("current"), {
      ...manifest,
      updatedAt: adminFieldValue.serverTimestamp(),
      updatedBy: actor,
      sizeBytes,
    }, { merge: false });
    batch.set(adminDb.collection(REGULATORY_COLLECTIONS.auditLogs).doc(), {
      action: "seo-manifest",
      actor,
      ticker: null,
      createdAt: adminFieldValue.serverTimestamp(),
      metadata: {
        schemaVersion: manifest.schemaVersion,
        generatedAt: manifest.generatedAt,
        total: manifest.total,
        indexableTotal: manifest.indexableTotal,
        sizeBytes,
      },
    });
    await batch.commit();
    return { ...manifest, sizeBytes };
  }
}

export const fundSeoManifestRepository = new FundSeoManifestRepository();
