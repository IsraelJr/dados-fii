import { extractPilotInsights } from "@/lib/cvmIngestion";

function normalizeUrl(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export async function extractPilotInsightsV2(input: {
  runId: string;
  ticker: string;
  documents: Array<Record<string, unknown>>;
}) {
  const selectedDocuments = input.documents
    .filter((document) => document.documentUrl)
    .slice(0, 8);
  const submittedUrls = selectedDocuments
    .map((document) => normalizeUrl(document.documentUrl))
    .filter(Boolean);
  const base = await extractPilotInsights({
    ...input,
    documents: selectedDocuments,
  });

  if (base.status !== "completed") {
    return {
      ...base,
      documentsSubmitted: submittedUrls.length,
      sourceUrlsUsed: 0,
      sourceCoverage: 0,
      quality: "incomplete",
    };
  }

  const extraction = (base as any).extraction || {};
  const usedUrls = Array.isArray(extraction.sourceUrls)
    ? [...new Set(extraction.sourceUrls.map(normalizeUrl).filter(Boolean))]
    : [];
  const sourceCoverage = submittedUrls.length
    ? Number(((usedUrls.length / submittedUrls.length) * 100).toFixed(1))
    : 0;
  const completeEnough = sourceCoverage >= 50;

  return {
    ...base,
    status: completeEnough ? "completed" : "partial",
    reason: completeEnough
      ? null
      : `Cobertura documental insuficiente: ${usedUrls.length} de ${submittedUrls.length} documentos utilizados.`,
    documentsSubmitted: submittedUrls.length,
    submittedUrls,
    sourceUrlsUsed: usedUrls.length,
    usedUrls,
    sourceCoverage,
    quality: completeEnough ? "reviewable" : "partial",
  };
}
