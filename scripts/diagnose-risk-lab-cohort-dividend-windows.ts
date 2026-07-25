import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dividendStressWindowEngine } from "@/lib/risk-lab/DividendStressWindowEngine";
import { derivePrimaryStressTruth } from "@/lib/risk-lab/CohortPrimaryVerificationService";
import type { VerifiedDividendNotice } from "@/types/riskLabDividendStress";

const indices = [
  "docs/production-evidence/risk-lab/deva11-phase-a/index.json",
  "docs/production-evidence/risk-lab/vslh11-phase-b1/index.json",
  "docs/production-evidence/risk-lab/kncr11-phase-b2/index.json",
  "docs/production-evidence/risk-lab/knsc11-phase-b3/index.json",
  "docs/production-evidence/risk-lab/mcci11-phase-b4/index.json",
  "docs/production-evidence/risk-lab/rbry11-phase-b5/index.json",
];

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => [key, stable(item)]));
}
function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(stable(value)), "utf8").digest("hex");
}
function load(path: string) { return JSON.parse(readFileSync(path, "utf8")); }

const cases = [];
for (const indexPath of indices) {
  const index = load(indexPath);
  const observations = index.observationFiles.flatMap((descriptor: { file: string; observationsHash: string }) => {
    const payload = load(descriptor.file);
    if (hash(payload.observations) !== descriptor.observationsHash) throw new Error(`Hash anual divergente: ${descriptor.file}`);
    return payload.observations;
  });
  if (hash(observations) !== index.combinedObservationsHash) throw new Error(`Hash combinado divergente: ${index.identity.ticker}`);
  const notices: VerifiedDividendNotice[] = observations.map((item: Record<string, unknown>) => ({
    ticker: String(item.ticker),
    competenceMonth: String(item.competenceMonth),
    amountPerShare: Number(item.amountPerShare),
    announcedAt: String(item.announcedAt),
    source: {
      documentId: String(item.documentId),
      sourceUrl: String(item.sourceUrl),
      sourceType: "primary_regulatory",
      reviewMethod: "automatic_regulatory_validation",
      reviewedBy: "risk-lab-frozen-dividend-phase-c",
      reviewedAt: String(item.receivedAt || item.announcedAt),
      page: Number(item.page || 1),
      excerpt: String(item.excerpt),
      sourceHash: String(item.sourceHash),
      sourceVersion: String(item.sourceVersion),
      protocolHash: String(item.protocolHash),
      protocolVersion: Number(item.protocolVersion),
    },
  }));
  const full = dividendStressWindowEngine.detect(notices);
  const truth = derivePrimaryStressTruth(notices);
  const sequential = [];
  let firstSignalAt: string | null = null;
  for (const asOf of [...new Set(notices.map((item) => item.announcedAt))].sort()) {
    const known = notices.filter((item) => Date.parse(item.announcedAt) <= Date.parse(asOf));
    if (known.length < 9) continue;
    const result = dividendStressWindowEngine.detect(known);
    if (!firstSignalAt && result.status !== "no_qualifying_stress") firstSignalAt = result.stressDetectedAt || asOf;
    sequential.push({ asOf, known: known.length, status: result.status, stressDetectedAt: result.stressDetectedAt, recoveryDetectedAt: result.recoveryDetectedAt });
  }
  cases.push({
    ticker: index.identity.ticker,
    role: index.identity.role,
    observations: notices.length,
    firstMonth: notices[0]?.competenceMonth || null,
    lastMonth: notices.at(-1)?.competenceMonth || null,
    missingMonths: index.result.missingMonths,
    full,
    truth,
    firstSignalAt,
    sequential,
    combinedObservationsHash: index.combinedObservationsHash,
  });
  console.log(index.identity.ticker, index.identity.role, full.status, full.stressDetectedAt, full.recoveryDetectedAt, "first", firstSignalAt);
}
const output = { schemaVersion: 1, cases };
writeFileSync("risk-lab-cohort-dividend-windows.json", `${JSON.stringify({ ...output, artifactHash: hash(output) }, null, 2)}\n`);
