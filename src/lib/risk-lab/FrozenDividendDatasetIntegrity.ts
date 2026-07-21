import { createHash } from "node:crypto";
import type {
  FrozenDividendNoticeCase,
  FrozenDividendNoticeDataset,
} from "@/types/riskLabFrozenDividendDataset";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

export function sha256Text(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashFrozenDividendCase(value: Omit<FrozenDividendNoticeCase, "caseHash">) {
  return sha256Text(JSON.stringify(stableValue(value)));
}

export function hashFrozenDividendDataset(value: Omit<FrozenDividendNoticeDataset, "datasetHash">) {
  return sha256Text(JSON.stringify(stableValue(value)));
}

export function verifyFrozenDividendDatasetHash(dataset: FrozenDividendNoticeDataset) {
  if (!dataset.datasetHash || !/^[a-f0-9]{64}$/.test(dataset.datasetHash)) return false;
  const { datasetHash: _datasetHash, ...withoutHash } = dataset;
  return hashFrozenDividendDataset(withoutHash) === dataset.datasetHash;
}
