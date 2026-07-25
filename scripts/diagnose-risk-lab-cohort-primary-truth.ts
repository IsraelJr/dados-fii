import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { CvmEventualDocumentDiscovery } from "@/lib/risk-lab/CvmEventualDocumentDiscovery";
import { AutomaticCreditEventScreeningService } from "@/lib/risk-lab/AutomaticCreditEventScreeningService";
import type { AutomaticDocumentEvidence, AutomaticSourceSummary } from "@/types/riskLabAutomatic";

// Sonda temporária e determinística da verdade-terreno primária da coorte 3.5-C.
const cases = [
  { ticker: "DEVA11", cnpj: "37087810000137", from: "2021-01-01T00:00:00-03:00", until: "2026-07-22T23:59:59-03:00" },
  { ticker: "VSLH11", cnpj: "36244015000142", from: "2021-01-01T00:00:00-03:00", until: "2026-07-22T23:59:59-03:00" },
  { ticker: "KNCR11", cnpj: "16706958000132", from: "2022-01-01T00:00:00-03:00", until: "2025-12-31T23:59:59-03:00" },
  { ticker: "KNSC11", cnpj: "35325769000178", from: "2022-01-01T00:00:00-03:00", until: "2025-12-31T23:59:59-03:00" },
  { ticker: "MCCI11", cnpj: "35275408000119", from: "2022-01-01T00:00:00-03:00", until: "2025-12-31T23:59:59-03:00" },
  { ticker: "RBRY11", cnpj: "30166700000111", from: "2022-01-01T00:00:00-03:00", until: "2025-12-31T23:59:59-03:00" },
] as const;

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

function years(from: string, until: string) {
  const first = Number(from.slice(0, 4));
  const last = Number(until.slice(0, 4));
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

async function discoverAll(discovery: CvmEventualDocumentDiscovery, cnpj: string, selectedYears: number[]) {
  const documents = new Map<string, AutomaticDocumentEvidence>();
  const sources = new Map<number, AutomaticSourceSummary>();
  const issues = [];
  for (let offset = 0; offset < selectedYears.length; offset += 4) {
    const result = await discovery.discover(cnpj, selectedYears.slice(offset, offset + 4));
    result.documents.forEach((item) => documents.set(item.documentId, item));
    result.sources.forEach((item) => sources.set(item.year, item));
    issues.push(...result.issues);
  }
  return {
    documents: [...documents.values()].sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt)),
    sources: [...sources.values()].sort((a, b) => a.year - b.year),
    issues,
  };
}

const discovery = new CvmEventualDocumentDiscovery();
const screening = new AutomaticCreditEventScreeningService({ now: () => new Date("2026-07-25T00:00:00-03:00") });
const output = [];
for (const item of cases) {
  const found = await discoverAll(discovery, item.cnpj, years(item.from, item.until));
  const screen = await screening.screen(item.ticker, found.documents, found.sources, item.from, item.until);
  output.push({
    identity: item,
    sources: found.sources,
    discoveryIssues: found.issues,
    documents: found.documents,
    screen,
    sourceHash: hash(found.sources),
    documentsHash: hash(found.documents),
    screenHash: hash(screen),
  });
  console.log(`${item.ticker}: ${screen.status}; documentos=${found.documents.length}; eventos=${screen.verifiedEvents.length}; ambiguidades=${screen.ambiguousDocuments.length}`);
}
const artifact = {
  schemaVersion: 1,
  generatedAt: "2026-07-25T00:00:00-03:00",
  cases: output,
};
writeFileSync("risk-lab-cohort-primary-truth-diagnostic.json", `${JSON.stringify({ ...artifact, artifactHash: hash(artifact) }, null, 2)}\n`);
