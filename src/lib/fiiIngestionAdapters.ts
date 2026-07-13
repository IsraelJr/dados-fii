import type { IngestionAdapterId } from "@/lib/fiiIngestionConfig";

export type MonthlyIngestionInput = {
  runId: string;
  ticker: string;
  cnpj: string;
  year: number;
};

export type IngestionAdapterDefinition = {
  id: IngestionAdapterId;
  parserVersion: number;
  regulatoryFamily: "FII" | "FIAGRO";
  capabilities: {
    monthlyData: true;
    officialDocuments: true;
    reconciliation: true;
    sourceEvidence: true;
  };
  collectMonthlyData(input: MonthlyIngestionInput): Promise<any>;
};

const ADAPTERS: Record<IngestionAdapterId, IngestionAdapterDefinition> = {
  "cvm-fii-v2": {
    id: "cvm-fii-v2",
    parserVersion: 2,
    regulatoryFamily: "FII",
    capabilities: {
      monthlyData: true,
      officialDocuments: true,
      reconciliation: true,
      sourceEvidence: true,
    },
    async collectMonthlyData(input) {
      const { importMonthlyCvmDataV2 } = await import("@/lib/cvmMonthlyIngestion");
      return importMonthlyCvmDataV2(input);
    },
  },
  "cvm-fiagro-v2": {
    id: "cvm-fiagro-v2",
    parserVersion: 2,
    regulatoryFamily: "FIAGRO",
    capabilities: {
      monthlyData: true,
      officialDocuments: true,
      reconciliation: true,
      sourceEvidence: true,
    },
    async collectMonthlyData(input) {
      const { importFiagroMonthlyData } = await import("@/lib/cvmFiagroMonthlyIngestion");
      return importFiagroMonthlyData(input);
    },
  },
};

export function getIngestionAdapter(adapterId: IngestionAdapterId) {
  const adapter = ADAPTERS[adapterId];
  if (!adapter) throw new Error(`Adaptador de ingestão não implementado: ${adapterId}.`);
  return adapter;
}

export function listIngestionAdapters() {
  return Object.values(ADAPTERS).map((adapter) => ({
    id: adapter.id,
    parserVersion: adapter.parserVersion,
    regulatoryFamily: adapter.regulatoryFamily,
    capabilities: adapter.capabilities,
  }));
}

export async function runMonthlyIngestionAdapter(
  adapterId: IngestionAdapterId,
  input: MonthlyIngestionInput
) {
  return getIngestionAdapter(adapterId).collectMonthlyData(input);
}
