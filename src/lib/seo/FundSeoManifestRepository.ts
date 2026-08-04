import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { REGULATORY_COLLECTIONS } from "@/lib/regulatory/RegulatoryTypes";
import type { FundSeoManifest } from "./FundSeoManifest";
import { validateFundSeoManifest } from "./FundSeoManifestValidation";

const FIRESTORE_SAFE_DOCUMENT_BYTES = 900_000;

export class FundSeoManifestRepository {
  async getCurrent(): Promise<FundSeoManifest | null> {
    const snapshot = await adminDb.collection(REGULATORY_COLLECTIONS.seoManifests).doc("current").get();
    if (!snapshot.exists) return null;
    const manifest = snapshot.data() as FundSeoManifest;
    validateFundSeoManifest(manifest);
    return manifest;
  }

  async saveCurrent(manifest: FundSeoManifest, actor: string) {
    if (!actor.trim()) throw new Error("Ator do manifesto SEO obrigatório.");
    validateFundSeoManifest(manifest);
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
