import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { validatePilotRunV2 } from "@/lib/cvmMonthlyIngestion";

export async function validateOperationalRun(input: {
  runId: string;
  ticker: string;
  cnpj: string;
  monthly: any;
  documents: any;
  ai: any;
}) {
  const base = await validatePilotRunV2(input);
  const aiDisabled = input.ai?.enabled === false || input.ai?.status === "disabled";

  if (!aiDisabled) {
    return {
      ...base,
      aiMode: "enabled",
      aiOptional: true,
    };
  }

  const warnings = Array.isArray(base.warnings)
    ? base.warnings.filter((warning: unknown) => {
        const text = String(warning || "").toLowerCase();
        return !text.includes("extração por ia") && !text.includes("a ia utilizou");
      })
    : [];

  const result = {
    ...base,
    warnings,
    aiMode: "disabled",
    aiOptional: true,
    aiSourceCoverage: null,
  };

  await adminDb.collection("FiiIngestionStaging").doc(input.runId).set({
    validation: result,
    aiMode: "disabled",
    updatedAt: adminFieldValue.serverTimestamp(),
  }, { merge: true });

  return result;
}
