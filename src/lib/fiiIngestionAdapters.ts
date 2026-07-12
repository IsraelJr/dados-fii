import type { IngestionAdapterId } from "@/lib/fiiIngestionConfig";

type MonthlyIngestionInput = {
  runId: string;
  ticker: string;
  cnpj: string;
  year: number;
};

export async function runMonthlyIngestionAdapter(
  adapterId: IngestionAdapterId,
  input: MonthlyIngestionInput
) {
  switch (adapterId) {
    case "cvm-fii-v2": {
      const { importMonthlyCvmDataV2 } = await import("@/lib/cvmMonthlyIngestion");
      return importMonthlyCvmDataV2(input);
    }
    case "cvm-fiagro-v2": {
      const { importFiagroMonthlyData } = await import("@/lib/cvmFiagroMonthlyIngestion");
      return importFiagroMonthlyData(input);
    }
    default: {
      const exhaustive: never = adapterId;
      throw new Error(`Adaptador de ingestão não implementado: ${exhaustive}.`);
    }
  }
}
