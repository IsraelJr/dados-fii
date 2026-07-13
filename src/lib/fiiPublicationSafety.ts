import { createHash } from "crypto";
import { stableRegulatoryJson } from "./fiiPrePublication.ts";

export function hashStablePayload(value: unknown) {
  return createHash("sha256").update(stableRegulatoryJson(value)).digest("hex");
}

export function proposalHashPrefix(proposalHash: unknown) {
  return String(proposalHash || "").trim().toLowerCase().slice(0, 12);
}

export function buildPublicationConfirmation(ticker: unknown, proposalHash: unknown) {
  return `PUBLICAR ${String(ticker || "").trim().toUpperCase()} ${proposalHashPrefix(proposalHash)}`;
}

export function buildRollbackConfirmation(ticker: unknown, proposalHash: unknown) {
  return `REVERTER ${String(ticker || "").trim().toUpperCase()} ${proposalHashPrefix(proposalHash)}`;
}

export function publicationWriteEnabled() {
  return String(process.env.FII_INGESTION_PUBLICATION_ENABLED || "").trim().toLowerCase() === "true";
}

export function rollbackWriteEnabled() {
  return String(process.env.FII_INGESTION_ROLLBACK_ENABLED || "").trim().toLowerCase() === "true";
}

export function normalizedConfirmation(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
}
