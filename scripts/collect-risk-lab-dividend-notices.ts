import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { FrozenDividendNoticeCollector } from "../src/lib/risk-lab/FrozenDividendNoticeCollector";
import type {
  FrozenDividendCohortIdentity,
} from "../src/lib/risk-lab/FrozenDividendNoticeCollector";
import type {
  FrozenDividendCollectionCheckpoint,
  FrozenDividendNoticeDataset,
} from "../src/types/riskLabFrozenDividendDataset";

interface IdentityResponse {
  ok?: boolean;
  releaseCommit?: string;
  identities?: FrozenDividendCohortIdentity[];
}

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) || null;
}

function required(name: string, environmentName: string) {
  const value = argument(name) || process.env[environmentName] || "";
  if (!value.trim()) throw new Error(`${environmentName} é obrigatório.`);
  return value.trim();
}

async function atomicJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

async function loadCheckpoint(path: string): Promise<FrozenDividendCollectionCheckpoint | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as FrozenDividendCollectionCheckpoint;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function fetchIdentities(endpoint: string, releaseCommit: string) {
  const response = await fetch(endpoint, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "DadosFII-RiskLab/1.0 (+frozen-primary-dividend-collector)",
    },
  });
  if (!response.ok) throw new Error(`Endpoint de identidades respondeu HTTP ${response.status}.`);
  const payload = await response.json() as IdentityResponse;
  if (!payload.ok || payload.releaseCommit !== releaseCommit || !Array.isArray(payload.identities)) {
    throw new Error("Endpoint de identidades não corresponde ao deployment exato.");
  }
  if (payload.identities.length !== 6 || new Set(payload.identities.map((item) => item.ticker)).size !== 6) {
    throw new Error("Endpoint de identidades não retornou seis casos únicos.");
  }
  return payload.identities;
}

function summary(dataset: FrozenDividendNoticeDataset) {
  const observations = dataset.cases.reduce((sum, item) => sum + item.observations.length, 0);
  const pending = dataset.cases.reduce((sum, item) => sum + item.pendingDocumentIds.length, 0);
  const failures = dataset.cases.reduce((sum, item) => sum + item.failures.length, 0);
  const conflicts = dataset.cases.reduce((sum, item) => sum + item.conflicts.length, 0);
  const lines = [
    "# Sprint 3.5 — Dataset congelado de avisos de dividendos",
    "",
    `- Status: \`${dataset.status}\``,
    `- Release de coleta: \`${dataset.releaseCommit}\``,
    `- Dataset: \`${dataset.datasetId}@${dataset.datasetVersion}\``,
    `- Coletor: \`${dataset.collectorVersion}\``,
    `- Casos: \`${dataset.cases.length}\``,
    `- Observações primárias: \`${observations}\``,
    `- Documentos pendentes: \`${pending}\``,
    `- Falhas: \`${failures}\``,
    `- Conflitos: \`${conflicts}\``,
    `- Hash: \`${dataset.datasetHash}\``,
    "- Premium integrado: `false`",
    "- Notificações enviadas: `false`",
    "",
    "A série foi coletada sequencialmente no GitHub Actions a partir de avisos estruturados e protocolos oficiais do Fundos.NET. O Informe Mensal da CVM permanece apenas como reconciliação contábil auxiliar.",
    "",
    "## Casos",
    "",
    "| Fundo | Papel | Status | Observações | Pendências | Maior sequência |",
    "|---|---|---:|---:|---:|---:|",
    ...dataset.cases.map((item) =>
      `| ${item.ticker} | ${item.role} | ${item.status} | ${item.observations.length} | ${item.pendingDocumentIds.length} | ${item.longestContiguousSequence} |`),
    "",
  ];
  return lines.join("\n");
}

async function main() {
  const releaseCommit = required("release", "RELEASE_COMMIT");
  if (!/^[a-f0-9]{40}$/.test(releaseCommit)) throw new Error("RELEASE_COMMIT inválido.");
  const endpoint = required("identities-endpoint", "IDENTITIES_ENDPOINT");
  const outputPath = resolve(argument("output") || process.env.OUTPUT_PATH || "src/lib/risk-lab/frozen-dividend-notices-v0.1.json");
  const checkpointPath = resolve(argument("checkpoint") || process.env.CHECKPOINT_PATH || ".tmp/risk-lab-dividend-notices-checkpoint.json");
  const summaryPath = resolve(argument("summary") || process.env.SUMMARY_PATH || "docs/risk-lab/sprint-3-5-frozen-dividend-notices.md");

  const identities = await fetchIdentities(endpoint, releaseCommit);
  const existing = await loadCheckpoint(checkpointPath);
  const collector = new FrozenDividendNoticeCollector();
  const { dataset } = await collector.collect(
    identities,
    releaseCommit,
    existing,
    (checkpoint) => atomicJson(checkpointPath, checkpoint),
  );
  await atomicJson(outputPath, dataset);
  await mkdir(dirname(summaryPath), { recursive: true });
  await writeFile(summaryPath, `${summary(dataset)}\n`, "utf8");
  console.log(JSON.stringify({
    status: dataset.status,
    cases: dataset.cases.length,
    observations: dataset.cases.reduce((sum, item) => sum + item.observations.length, 0),
    pending: dataset.cases.reduce((sum, item) => sum + item.pendingDocumentIds.length, 0),
    datasetHash: dataset.datasetHash,
  }));
  if (dataset.status !== "complete") process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
