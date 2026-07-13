import { hashStablePayload } from "./fiiPublicationSafety.ts";

export type PostPublicationValidationInput = {
  runId: string;
  ticker: string;
  proposalHash: string;
  publication: Record<string, any> | null;
  officialDocumentExists: boolean;
  officialDocument: Record<string, any> | null;
};

export function validatePostPublication(input: PostPublicationValidationInput) {
  const publication = input.publication || {};
  const officialDocument = input.officialDocument || {};
  const regulatoryData = officialDocument.regulatoryData || null;
  const monthlyHistory = Array.isArray(regulatoryData?.monthlyHistory) ? regulatoryData.monthlyHistory : [];
  const documents = Array.isArray(regulatoryData?.documents) ? regulatoryData.documents : [];
  const officialDocumentHash = hashStablePayload(input.officialDocumentExists ? officialDocument : null);
  const regulatoryDataHash = hashStablePayload(regulatoryData);

  const checks = [
    {
      id: "publication-record",
      passed: Boolean(publication && publication.status === "published"),
      detail: publication?.status === "published" ? "Registro de publicação encontrado." : "Registro de publicação ausente ou inválido.",
    },
    {
      id: "official-document",
      passed: input.officialDocumentExists,
      detail: input.officialDocumentExists ? "Documento oficial existe." : "Documento oficial não encontrado.",
    },
    {
      id: "ticker-consistency",
      passed: String(regulatoryData?.ticker || "").toUpperCase() === String(input.ticker || "").toUpperCase(),
      detail: `Ticker publicado: ${regulatoryData?.ticker || "ausente"}.`,
    },
    {
      id: "run-consistency",
      passed: regulatoryData?.publication?.runId === input.runId,
      detail: `Run publicado: ${regulatoryData?.publication?.runId || "ausente"}.`,
    },
    {
      id: "proposal-hash",
      passed: String(regulatoryData?.publication?.proposalHash || "").toLowerCase() === String(input.proposalHash || "").toLowerCase(),
      detail: "Hash da proposta no documento oficial deve corresponder ao aprovado.",
    },
    {
      id: "document-hash",
      passed: Boolean(publication?.publishedDocumentHash && publication.publishedDocumentHash === officialDocumentHash),
      detail: "Hash integral do documento oficial deve corresponder ao registro de publicação.",
    },
    {
      id: "regulatory-hash",
      passed: Boolean(publication?.publishedRegulatoryDataHash && publication.publishedRegulatoryDataHash === regulatoryDataHash),
      detail: "Hash do namespace regulatoryData deve corresponder ao registro de publicação.",
    },
    {
      id: "monthly-history",
      passed: monthlyHistory.length > 0,
      detail: `${monthlyHistory.length} competências regulatórias publicadas.`,
    },
    {
      id: "monthly-uniqueness",
      passed: new Set(monthlyHistory.map((item: any) => item?.referenceDate).filter(Boolean)).size === monthlyHistory.length,
      detail: "O histórico deve conter uma única linha por competência.",
    },
    {
      id: "latest-snapshot",
      passed: Boolean(regulatoryData?.latestSnapshot?.referenceDate),
      detail: `Última competência: ${regulatoryData?.latestSnapshot?.referenceDate || "ausente"}.`,
    },
    {
      id: "quality",
      passed: Number(regulatoryData?.quality?.qaScore || 0) === 100
        && Number(regulatoryData?.quality?.conflictCount || 0) === 0,
      detail: `QA ${regulatoryData?.quality?.qaScore ?? "ausente"}; conflitos ${regulatoryData?.quality?.conflictCount ?? "ausente"}.`,
    },
  ];

  const failures = checks.filter((check) => !check.passed);
  return {
    version: "post-publication-validation-v1",
    runId: input.runId,
    ticker: input.ticker,
    status: failures.length ? "failed" : "passed",
    passed: failures.length === 0,
    score: Math.round(((checks.length - failures.length) / checks.length) * 100),
    counts: {
      monthlySnapshots: monthlyHistory.length,
      documents: documents.length,
      checks: checks.length,
      failures: failures.length,
    },
    hashes: {
      officialDocumentHash,
      regulatoryDataHash,
      expectedDocumentHash: publication?.publishedDocumentHash || null,
      expectedRegulatoryDataHash: publication?.publishedRegulatoryDataHash || null,
    },
    checks,
    failures,
  };
}
