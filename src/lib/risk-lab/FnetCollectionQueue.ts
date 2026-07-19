export const FNET_COLLECTION_QUEUE_LIMIT = 20;

export interface ParsedFnetCollectionQueue {
  documentIds: string[];
  rejectedTokens: string[];
  truncated: boolean;
}

export interface FnetCollectionQueueItem {
  documentId: string;
  alreadyImported: boolean;
}

export function parseFnetCollectionQueue(raw: string): ParsedFnetCollectionQueue {
  const tokens = raw
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const accepted: string[] = [];
  const rejectedTokens: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    if (!/^\d{1,12}$/.test(token)) {
      rejectedTokens.push(token);
      continue;
    }
    if (seen.has(token)) continue;
    seen.add(token);
    accepted.push(token);
  }

  return {
    documentIds: accepted.slice(0, FNET_COLLECTION_QUEUE_LIMIT),
    rejectedTokens,
    truncated: accepted.length > FNET_COLLECTION_QUEUE_LIMIT,
  };
}

export function buildFnetCollectionQueue(
  documentIds: string[],
  importedDocumentIds: Iterable<string>,
): FnetCollectionQueueItem[] {
  const imported = new Set(importedDocumentIds);
  return documentIds.map((documentId) => ({
    documentId,
    alreadyImported: imported.has(documentId),
  }));
}
