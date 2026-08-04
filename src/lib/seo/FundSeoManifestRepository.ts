import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { REGULATORY_COLLECTIONS } from "@/lib/regulatory/RegulatoryTypes";
import type { FundSeoManifest } from "./FundSeoManifest";

const FIRESTORE_SAFE_DOCUMENT_BYTES = 900_000;
const MAX_MANIFEST_ENTRIES = 2_000;
const VALID_DECISIONS = new Set(["index", "noindex", "not-found"]);

function validIsoDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function validateManifest(manifest: FundSeoManifest) {
  if (manifest.schemaVersion !== 1) throw new Error("Versão do manifesto SEO inválida.");
  if (!validIsoDate(manifest.generatedAt)) throw new Error("Data de geração do manifesto SEO inválida.");
  if (!Array.isArray(manifest.entries) || manifest.entries.length > MAX_MANIFEST_ENTRIES) {
    throw new Error("Quantidade de entradas do manifesto SEO inválida.");
  }
  if (!Number.isInteger(manifest.total) || manifest.total !== manifest.entries.length) {
    throw new Error("Total do manifesto SEO inconsistente.");
  }
  if (!Number.isInteger(manifest.indexableTotal)
    || manifest.indexableTotal !== manifest.entries.filter((entry) => entry.indexable).length) {
    throw new Error("Total indexável do manifesto SEO inconsistente.");
  }

  for (const entry of manifest.entries) {
    if (!/^[A-Z]{4}\d{2}$/.test(entry.ticker)) throw new Error("Manifesto SEO contém ticker inválido.");
    if (!VALID_DECISIONS.has(entry.decision)) throw new Error("Manifesto SEO contém decisão inválida.");
    if (!Number.isInteger(entry.score) || entry.score < 0 || entry.score > 100) {
      throw new Error("Manifesto SEO contém score inválido.");
    }
    if (!Array.isArray(entry.blockers) || !Array.isArray(entry.warnings)) {
      throw new Error("Manifesto SEO contém diagnóstico inválido.");
    }
    if (entry.canonicalPath !== `/fii/${entry.ticker}`) {
      throw new Error("Manifesto SEO contém canonical incompatível.");
    }
    if (entry.lastModified !== null && !validIsoDate(entry.lastModified)) {
      throw new Error("Manifesto SEO contém data de modificação inválida.");
    }
    if (entry.indexable !== (entry.decision === "index")) {
      throw new Error("Manifesto SEO contém estado indexável inconsistente.");
    }
    if (entry.indexable && !entry.lastModified) {
      throw new Error("Entrada indexável do manifesto SEO não possui data de modificação.");
    }
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
